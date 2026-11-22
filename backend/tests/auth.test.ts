import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/app.js';
import type { AuthStore } from '../src/lib/authStore.js';
import { hashPassword } from '../src/lib/password.js';
import { signAuthToken, verifyAuthToken, validateJwtConfiguration } from '../src/lib/jwt.js';
import { validPassword, isInstitutionalEmail } from '../src/lib/validation.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ADMIN_EMAIL_DOMAINS = 'institution.test';
process.env.NODE_ENV = 'test';
delete process.env.TRUST_LOCAL_PROXY;
delete process.env.RAG_URL;

// Explicit in-memory repository doubles; no Prisma query or database connection.
const fixture = async () => {
  const passwordHash = await hashPassword('test-password-2026');
  const citizen = { id: 'citizen-id', name: 'Persona Test', email: 'person@example.test',
    dui: '12345678-9', passwordHash, active: true, createdAt: new Date(), updatedAt: new Date() };
  const admin = { id: 'admin-id', name: 'Admin Test', email: 'admin@institution.test',
    passwordHash, active: true, createdAt: new Date(), updatedAt: new Date() };
  let fail = false;
  const delegate = (account: typeof admin | typeof citizen) => ({
    findUnique: async ({ where }: { where: Record<string, string> }) => {
      if (fail) throw new Error('PRIVATE DATABASE SECRET');
      return Object.entries(where).every(([key, value]) => account[key as keyof typeof account] === value) ? account : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (data.email === citizen.email) throw { code: 'P2002' };
      return { ...citizen, ...data };
    },
  });
  const store = { citizen: delegate(citizen), administrator: delegate(admin) } as unknown as AuthStore;
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (path: string, body?: unknown, token?: string, raw = false, forwarded?: string) => {
    const response = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}) },
      body: body === undefined ? undefined : raw ? String(body) : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { citizen, admin, request, setFailure: () => { fail = true; },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
};

test('JWT HS256 validates shape, expiry and role; rejects legacy and other algorithms', () => {
  const secret = process.env.JWT_SECRET!;
  assert.deepEqual(verifyAuthToken(signAuthToken({ sub: '123', role: 'admin' })), { sub: '123', role: 'admin' });
  for (const payload of [{ sub: '123', dui: '12345678-9' }, { sub: '', role: 'admin' }, { sub: '123', role: 'root' }]) {
    assert.throws(() => verifyAuthToken(jwt.sign(payload, secret, { expiresIn: '1h' })));
  }
  assert.throws(() => verifyAuthToken(jwt.sign({ sub: '123', role: 'admin' }, secret, { algorithm: 'HS384', expiresIn: '1h' })));
  assert.throws(() => verifyAuthToken(jwt.sign({ sub: '123', role: 'admin' }, secret, { expiresIn: -1 })));
  assert.throws(() => verifyAuthToken(jwt.sign({ sub: '123', role: 'admin' }, secret)));
  process.env.JWT_SECRET = 'placeholder';
  assert.throws(validateJwtConfiguration, /JWT_SECRET/);
  process.env.JWT_SECRET = secret;
});

test('limiter ignores forwarded addresses by default and separates clients behind an opt-in local proxy', async () => {
  for (const trusted of [false, true]) {
    process.env.TRUST_LOCAL_PROXY = String(trusted);
    const f = await fixture();
    try {
      for (let i = 0; i < 10; i++) {
        assert.equal((await f.request('auth/login', {}, undefined, false, '192.0.2.10')).status, 400);
      }
      // If a chain reaches Express, the nearest untrusted hop determines the bucket.
      assert.equal((await f.request('auth/login', {}, undefined, false, '192.0.2.99, 192.0.2.10')).status, 429);
      assert.equal((await f.request('auth/login', {}, undefined, false, '192.0.2.11')).status, trusted ? 400 : 429);
    } finally { delete process.env.TRUST_LOCAL_PROXY; await f.close(); }
  }
});

test('password UTF-8 byte limits and institutional domain exact match', () => {
  assert.equal(validPassword('a'.repeat(72)), true);
  assert.equal(validPassword('a'.repeat(73)), false);
  assert.equal(validPassword('á'.repeat(37)), false);
  assert.equal(isInstitutionalEmail(' ADMIN@INSTITUTION.TEST '), true);
  assert.equal(isInstitutionalEmail('admin@sub.institution.test'), false);
  assert.equal(isInstitutionalEmail('admin@institution.test.evil'), false);
});

test('citizen/admin login contracts, role isolation and immediate account deactivation', async () => {
  const f = await fixture();
  try {
    const c = await f.request('auth/login', { dui: f.citizen.dui, password: 'test-password-2026', role: 'admin' });
    const a = await f.request('auth/admin/login', { email: ' ADMIN@INSTITUTION.TEST ', password: 'test-password-2026' });
    assert.equal(c.status, 200); assert.equal(a.status, 200);
    assert.equal(c.body.citizen.passwordHash, undefined);
    assert.deepEqual(Object.keys(a.body.administrator).sort(), ['createdAt', 'email', 'id', 'name']);
    assert.equal(verifyAuthToken(c.body.token).role, 'citizen');
    assert.equal(jwt.decode(c.body.token) && Object.hasOwn(jwt.decode(c.body.token)!, 'dui'), false);
    assert.equal((await f.request('auth/me', undefined, c.body.token)).status, 200);
    assert.equal((await f.request('auth/admin/me', undefined, a.body.token)).status, 200);
    assert.equal((await f.request('auth/me', undefined, a.body.token)).status, 403);
    assert.equal((await f.request('auth/admin/me', undefined, c.body.token)).status, 403);
    assert.equal((await f.request('auth/admin/me', undefined, signAuthToken({ sub: 'deleted-account', role: 'admin' }))).status, 401);
    f.admin.active = false; f.citizen.active = false;
    assert.equal((await f.request('auth/admin/me', undefined, a.body.token)).status, 401);
    assert.equal((await f.request('auth/me', undefined, c.body.token)).status, 401);
    assert.equal((await f.request('auth/admin/login', { email: f.admin.email, password: 'test-password-2026' })).status, 401);
    assert.equal((await f.request('auth/login', { dui: f.citizen.dui, password: 'test-password-2026' })).status, 401);
  } finally { await f.close(); }
});

test('registration always citizen, validates inputs and handles duplicate races', async () => {
  const f = await fixture();
  try {
    for (const body of [null, [], {}, { name: 'abc', email: 'e'.repeat(255), dui: f.citizen.dui, password: 'a'.repeat(73) }]) {
      assert.equal((await f.request('auth/register', body)).status, 400);
    }
    const data = { name: 'New Citizen', email: ' NEW@EXAMPLE.TEST ', dui: '00000001-0', password: 'new-password', role: 'admin', active: false };
    const result = await f.request('auth/register', data);
    assert.equal(result.status, 201);
    assert.equal(result.body.citizen.email, 'new@example.test');
    assert.equal(verifyAuthToken(result.body.token).role, 'citizen');
    assert.equal(result.body.citizen.passwordHash, undefined);
    assert.equal((await f.request('auth/register', { ...data, email: f.citizen.email })).status, 409);
    assert.equal((await f.request('auth/admin/register', data)).status, 404);
  } finally { await f.close(); }
});

test('missing bodies, wrong credentials, JSON errors, generic server errors and rate limiting', async () => {
  const f = await fixture();
  try {
    // POST with no body is represented directly to exercise undefined.
    const serverResponse = await f.request('auth/login', '', undefined, true);
    assert.equal(serverResponse.status, 400);
    assert.equal((await f.request('auth/admin/login', null)).status, 400);
    assert.equal((await f.request('auth/login', { dui: f.citizen.dui, password: 'wrong' })).status, 401);
    assert.equal((await f.request('auth/admin/login', { email: 'x@evil.test', password: 'wrong' })).status, 401);
    assert.equal((await f.request('auth/login', '{broken', undefined, true)).status, 400);
    assert.equal((await f.request('auth/login', { password: 'x'.repeat(17_000) })).status, 413);
    assert.equal((await f.request('auth/me')).status, 401);
    f.setFailure();
    const failure = await f.request('auth/login', { dui: f.citizen.dui, password: 'wrong' });
    assert.equal(failure.status, 500);
    assert.equal(JSON.stringify(failure.body).includes('PRIVATE'), false);
    let last;
    for (let i = 0; i < 10; i++) last = await f.request('auth/login', {});
    assert.equal(last!.status, 429);
    assert.equal((await f.request('health')).body.status, 'ok');
  } finally { await f.close(); }
});

test('provisioning CLI rejects password arguments and invalid domains without DB operations', () => {
  const env = { ...process.env, ADMIN_NAME: 'Admin Test', ADMIN_EMAIL: 'admin@evil.test',
    ADMIN_PASSWORD: 'valid-long-password', ADMIN_EMAIL_DOMAINS: 'institution.test' };
  for (const args of [['create-admin', 'a-password-must-not-appear'], ['create-admin']]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/accounts.ts', ...args], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal((result.stdout + result.stderr).includes('a-password-must-not-appear'), false);
    assert.equal((result.stdout + result.stderr).includes(env.ADMIN_PASSWORD), false);
    assert.match(result.stderr, args.length > 1 ? /Uso:/ : /Correo fuera/);
  }
});

test('chat forwards only general citizen questions, rejects personal identifiers and handles RAG unavailability', async () => {
  const received: unknown[] = [];
  const upstream = createServer(async (req, res) => {
    assert.equal(req.url, '/pregunta');
    assert.equal(req.headers.authorization, undefined);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ respuesta: 'Orientación ficticia.' }));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  process.env.RAG_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const f = await fixture();
  try {
    const question = { pregunta: '  ¿Qué requisitos tiene la reconexión?  ', expediente: 'no reenviar' };
    const token = signAuthToken({ sub: f.citizen.id, role: 'citizen' });
    assert.equal((await f.request('chat', question)).status, 401);
    assert.equal((await f.request('chat', question, signAuthToken({ sub: f.admin.id, role: 'admin' }))).status, 403);
    assert.equal((await f.request('chat', { pregunta: 'Mi DUI es 12345678-9' }, token)).status, 400);
    assert.deepEqual((await f.request('chat', question, token)).body, { respuesta: 'Orientación ficticia.' });
    assert.deepEqual(received, [{ pregunta: question.pregunta.trim() }]);
    await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    assert.equal((await f.request('chat', question, token)).status, 503);
  } finally {
    delete process.env.RAG_URL;
    await f.close();
    if (upstream.listening) await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});
