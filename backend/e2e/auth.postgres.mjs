import assert from 'node:assert/strict'
import { randomBytes, randomInt } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

// Opt-in: never migrate, truncate or seed the normal development/production URL.
const url = process.env.ANDA_TEST_DATABASE_URL
if (!url) throw new Error('Define ANDA_TEST_DATABASE_URL apuntando a una base local cuyo nombre termine en _test.')
const parsed = new URL(url)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
  throw new Error('Solo se permite una base PostgreSQL local terminada en _test.')
}
const cwd = fileURLToPath(new URL('../', import.meta.url))
const suffix = randomBytes(8).toString('hex')
const password = randomBytes(24).toString('hex')
const env = {
  ...process.env, DATABASE_URL: url,
  JWT_SECRET: randomBytes(48).toString('hex'), JWT_EXPIRES_IN: '1h',
  ADMIN_EMAIL_DOMAINS: 'institution.test', NODE_ENV: 'test', PORT: '3001', HOST: '127.0.0.1',
}
function command(args, additions = {}, expected = 0) {
  const result = spawnSync('pnpm', args, { cwd, env: { ...env, ...additions }, encoding: 'utf8' })
  assert.equal(result.status, expected, `Falló pnpm ${args.join(' ')}; revisa configuración y build sin publicar credenciales.`)
  return result.stdout
}
// This is an explicitly selected, disposable local test database.
command(['exec', 'prisma', 'migrate', 'deploy'])
command(['account:create-admin'], {
  ADMIN_NAME: 'Administrador de prueba', ADMIN_EMAIL: `admin-${suffix}@institution.test`, ADMIN_PASSWORD: password,
})
let api
async function startApi() {
  const child = spawn(process.execPath, ['dist/index.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  api = child
  child.stderr.resume()
  let timer
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('La API no arrancó en 15 segundos.')), 15000)
      child.stdout.on('data', data => { if (String(data).includes('API lista')) resolve() })
      child.once('exit', () => reject(new Error('La API terminó antes de arrancar.')))
      child.once('error', reject)
    })
  } finally { clearTimeout(timer) }
}
async function stopApi() {
  if (api?.pid && api.exitCode === null && api.signalCode === null) {
    const exit = once(api, 'exit')
    api.kill('SIGTERM')
    await exit
  }
}
try {
  await startApi()
  const request = async (path, { body, token, method, file } = {}) => {
    const res = await fetch(`http://127.0.0.1:3001/api/${path}`, {
      method: method ?? (body || file ? 'POST' : 'GET'),
      headers: { ...(file ? { 'Content-Type': 'application/octet-stream' } : body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file ?? (body ? JSON.stringify(body) : undefined),
    })
    return { status: res.status, headers: res.headers, body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer()) }
  }
  assert.equal((await request('health')).status, 200)
  assert.equal((await request('health/db')).status, 200)
  const citizenData = {
    name: 'Ciudadano ficticio', email: `citizen-${suffix}@example.test`,
    dui: `${String(randomInt(10000000, 100000000))}-${randomInt(10)}`, password, role: 'admin',
  }
  const registration = await request('auth/register', { body: citizenData })
  assert.equal(registration.status, 201)
  assert.equal(registration.body.citizen.passwordHash, undefined)
  assert.equal((await request('auth/register', { body: citizenData })).status, 409)
  const citizen = await request('auth/login', { body: { dui: citizenData.dui, password } })
  assert.equal(citizen.status, 200)
  assert.equal((await request('auth/me', { token: citizen.body.token })).status, 200)
  assert.equal((await request('auth/admin/me', { token: citizen.body.token })).status, 403)
  const admin = await request('auth/admin/login', { body: { email: ` ADMIN-${suffix.toUpperCase()}@INSTITUTION.TEST `, password } })
  assert.equal(admin.status, 200)
  assert.equal(admin.body.administrator.passwordHash, undefined)
  assert.equal((await request('auth/admin/me', { token: admin.body.token })).status, 200)
  assert.equal((await request('auth/me', { token: admin.body.token })).status, 403)
  assert.equal((await request('auth/admin/register', { method: 'POST' })).status, 404)
  const jwtPayload = JSON.parse(Buffer.from(admin.body.token.split('.')[1], 'base64url').toString())
  assert.equal(jwtPayload.role, 'admin')
  assert.equal(jwtPayload.email, undefined)
  assert.equal(jwtPayload.dui, undefined)
  const citizenToken = citizen.body.token
  const adminToken = admin.body.token
  const second = await request('auth/register', { body: {
    ...citizenData, email: `other-${suffix}@example.test`,
    dui: `${(Number(citizenData.dui.slice(0, 8)) ^ 1).toString().padStart(8, '0')}-${randomInt(10)}`,
  } })
  assert.equal(second.status, 201)
  const fields = { nis: `NIS-DEMO-${suffix}`, phone: '7000-0000', address: 'Dirección ficticia', reason: 'Solicitud ficticia de integración' }
  const created = await request('requests', { token: citizenToken, body: { service: 'MEDIDOR', status: 'HABILITADA_PAGO', citizenId: second.body.citizen.id } })
  assert.equal(created.status, 201)
  const draft = created.body.request
  assert.equal(draft.status, 'BORRADOR')
  assert.equal(draft.citizenId, citizen.body.citizen.id)
  const path = `requests/${draft.id}`
  const adminPath = `admin/${path}`
  assert.equal((await request(path)).status, 401)
  assert.equal((await request(path, { token: second.body.token })).status, 404)
  assert.equal((await request(path, { token: adminToken })).status, 403)
  assert.equal((await request(adminPath, { token: citizenToken })).status, 403)
  assert.equal((await request(adminPath, { token: adminToken })).status, 404)
  const draftOverview = (await request('requests/overview', { token: citizenToken })).body
  assert.equal(draftOverview.counts.BORRADOR, 1)
  assert.equal(draftOverview.recent.length, 0)
  assert.equal((await request('requests?queue=visits', { token: citizenToken })).status, 400)
  assert.equal((await request(`${path}/submit`, { token: citizenToken, body: { version: 1 } })).status, 422)
  assert.equal((await request(path, { token: citizenToken, method: 'PATCH', body: { ...fields, version: 1 } })).status, 200)
  const attempts = await Promise.all([1, 2].map(() => request(`${path}/submit`, { token: citizenToken, body: { version: 2 } })))
  assert.deepEqual(attempts.map(attempt => attempt.status).sort(), [200, 409])
  assert.equal((await request(`${adminPath}/correct`, { token: adminToken, body: { version: 3 } })).status, 400)
  assert.equal((await request(`${adminPath}/correct`, { token: adminToken, body: { version: 3, note: 'Aclarar dirección.' } })).status, 200)
  assert.equal((await request(`${adminPath}/approve`, { token: adminToken, body: { version: 4 } })).status, 409)
  assert.equal((await request(path, { token: second.body.token, method: 'PATCH', body: { version: 4, address: 'Otra dirección' } })).status, 404)
  assert.equal((await request(path, { token: citizenToken, method: 'PATCH', body: { version: 4, address: 'Dirección ficticia corregida' } })).status, 200)
  assert.equal((await request(`${path}/submit`, { token: citizenToken, body: { version: 5 } })).status, 200)
  const approved = await request(`${adminPath}/approve`, { token: adminToken, body: { version: 6 } })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.request.status, 'PENDIENTE_ESPECIFICACIONES')
  const detail = await request(path, { token: citizenToken })
  assert.equal(detail.status, 200)
  assert.deepEqual(detail.body.request.history.map(event => event.action), [
    'CREACION_BORRADOR', 'EDICION', 'ENVIO', 'SOLICITUD_CORRECCION', 'EDICION', 'REENVIO', 'APROBACION_DATOS',
  ])
  assert.equal(detail.body.request.history[3].note, 'Aclarar dirección.')
  assert.equal(detail.body.request.history[3].actorId, undefined)
  assert.ok((await request('requests', { token: citizenToken })).body.items.some(item => item.id === draft.id))
  assert.ok(!(await request('requests', { token: second.body.token })).body.items.some(item => item.id === draft.id))
  const pdf = Buffer.from('%PDF-1.4\n% Ficticio para pruebas\n%%EOF\n')
  const upload = (target, version, category, name = 'prueba.pdf', file = pdf) =>
    request(`${target}/attachments?${new URLSearchParams({ version: String(version), category, filename: name })}`, { token: citizenToken, file })
  const spec = await request(`${adminPath}/specifications`, { token: adminToken, body: {
    version: 7, diameter: 'MEDIA_PULGADA', specification: 'Medidor residencial de prueba.',
  } })
  assert.equal(spec.status, 200)
  assert.equal(spec.body.request.status, 'PENDIENTE_MATERIAL')
  assert.equal((await request(`${path}/submit-evidence`, { token: citizenToken, body: { version: 8 } })).status, 422)
  assert.equal((await upload(path, 8, 'EVIDENCIA', 'declarado.pdf', Buffer.from('<script>'))).status, 415)
  const evidence = await upload(path, 8, 'EVIDENCIA')
  assert.equal(evidence.status, 200)
  const attachment = evidence.body.request.attachments[0]
  assert.equal(attachment.content, undefined)
  assert.equal((await request(`${path}/attachments/${attachment.id}`, { token: second.body.token })).status, 404)
  const downloaded = await request(`${adminPath}/attachments/${attachment.id}`, { token: adminToken })
  assert.equal(downloaded.status, 200)
  assert.deepEqual(downloaded.body, pdf)
  assert.equal(downloaded.headers.get('cache-control'), 'private, no-store')
  assert.match(downloaded.headers.get('content-disposition'), /^attachment/)
  assert.equal((await request(`${path}/submit-evidence`, { token: citizenToken, body: { version: 9 } })).body.request.status, 'REVISION_MATERIAL')
  assert.equal((await request(`${adminPath}/correct-evidence`, { token: adminToken, body: { version: 10, note: 'Adjuntar detalle.' } })).body.request.status, 'CORRECCION_MATERIAL')
  assert.equal((await request(`${path}/submit-evidence`, { token: citizenToken, body: { version: 11 } })).status, 422)
  assert.equal((await request(`${path}/attachments/${attachment.id}`, { token: citizenToken, method: 'DELETE', body: { version: 11 } })).status, 200)
  assert.equal((await upload(path, 12, 'EVIDENCIA', 'corregido.pdf')).status, 200)
  assert.equal((await request(`${path}/submit-evidence`, { token: citizenToken, body: { version: 13 } })).status, 200)
  assert.equal((await request(`${path}/simulate-payment`, { token: citizenToken, body: { version: 14 } })).status, 409)
  assert.equal((await request(`${path}/receipt`, { token: citizenToken })).status, 404)
  assert.equal((await request(`${adminPath}/approve-evidence`, { token: adminToken, body: { version: 14 } })).body.request.status, 'HABILITADA_PAGO')
  assert.equal((await request(`${adminPath}/schedule-visit`, { token: adminToken, body: { version: 15 } })).status, 409)
  assert.equal((await request(`${path}/simulate-payment`, { token: citizenToken, body: { version: 15, amount: 1 } })).status, 400)
  const paymentAttempts = await Promise.all([1, 2].map(() => request(`${path}/simulate-payment`, { token: citizenToken, body: { version: 15 } })))
  assert.deepEqual(paymentAttempts.map(attempt => attempt.status).sort(), [200, 409])
  const paid = paymentAttempts.find(attempt => attempt.status === 200).body.request
  assert.equal(paid.status, 'PAGO_REGISTRADO')
  assert.equal(paid.paymentCents, 678)
  assert.equal((await request(`${path}/simulate-payment`, { token: citizenToken, body: { version: 16 } })).status, 409)
  assert.equal((await request(`${path}/receipt`, { token: second.body.token })).status, 404)
  const receipt = await request(`${path}/receipt`, { token: citizenToken })
  assert.match(receipt.headers.get('content-type'), /^application\/pdf/)
  assert.match(receipt.body.toString(), /COMPROBANTE SIMULADO - SIN VALIDEZ FISCAL/)
  assert.match(receipt.body.toString(), /USD 6\.78/)
  const visitDate = '2026-12-15T15:00:00.000Z'
  const coordination = 'Contacto de prueba coordinado.'
  assert.equal((await request(`${adminPath}/schedule-visit`, { token: adminToken, body: { version: 16, visitDate: '2026-02-31T15:00:00.000Z', coordination } })).status, 400)
  assert.equal((await request(`${adminPath}/schedule-visit`, { token: adminToken, body: { version: 16, visitDate, coordination } })).body.request.status, 'VISITA_PROGRAMADA')
  assert.equal((await request(`${adminPath}/close-visit`, { token: adminToken, body: { version: 17 } })).status, 409)
  assert.equal((await request(`${adminPath}/visit-progress`, { token: adminToken, body: { version: 17, physical: 'REQUIERE_SUSTITUCION', result: 'La pieza de prueba no es compatible.' } })).body.request.status, 'EN_EJECUCION')
  assert.equal((await request(`${adminPath}/close-visit`, { token: adminToken, body: { version: 18, physical: 'COMPATIBLE' } })).status, 422)
  assert.equal((await request(`${adminPath}/schedule-visit`, { token: adminToken, body: { version: 18, visitDate, coordination: 'Nueva visita para comprobar la sustitución.' } })).body.request.result, null)
  assert.equal((await request(`${adminPath}/visit-progress`, { token: adminToken, body: { version: 19, physical: 'COMPATIBLE', result: 'Medidor instalado en simulación.' } })).status, 200)
  const closed = await request(`${adminPath}/close-visit`, { token: adminToken, body: { version: 20 } })
  assert.equal(closed.body.request.status, 'FINALIZADA')
  assert.equal(closed.body.request.paidAt, paid.paidAt)
  assert.ok(closed.body.request.completedAt)
  assert.equal(closed.body.request.history.filter(event => event.action === 'PAGO_SIMULADO_REGISTRADO').length, 1)
  assert.equal((await request(`${adminPath}/visit-progress`, { token: adminToken, body: { version: 21, result: 'Intento de edición' } })).status, 409)
  assert.deepEqual((await request(`${adminPath}/receipt`, { token: adminToken })).body, receipt.body)
  const reconnect = (await request('requests', { token: citizenToken, body: { ...fields, service: 'RECONEXION' } })).body.request
  assert.equal((await request(`requests/${reconnect.id}/submit`, { token: citizenToken, body: { version: 1 } })).status, 200)
  assert.equal((await request(`admin/requests/${reconnect.id}/approve`, { token: adminToken, body: { version: 2 } })).body.request.status, 'HABILITADA_PAGO')
  const reconnectAdmin = `admin/requests/${reconnect.id}`
  assert.equal((await request(`requests/${reconnect.id}/simulate-payment`, { token: citizenToken, body: { version: 3 } })).body.request.paymentCents, 1356)
  assert.equal((await request(`${reconnectAdmin}/schedule-visit`, { token: adminToken, body: { version: 4, visitDate, coordination } })).status, 200)
  assert.equal((await request(`${reconnectAdmin}/visit-progress`, { token: adminToken, body: { version: 5 } })).status, 200)
  assert.equal((await request(`${reconnectAdmin}/close-visit`, { token: adminToken, body: { version: 6 } })).status, 422)
  assert.equal((await request(`${reconnectAdmin}/visit-progress`, { token: adminToken, body: { version: 6, result: 'Reconexión ficticia concluida.' } })).body.request.physical, null)
  assert.equal((await request(`${reconnectAdmin}/close-visit`, { token: adminToken, body: { version: 7 } })).body.request.status, 'FINALIZADA')
  const disconnect = (await request('requests', { token: citizenToken, body: { ...fields, service: 'DESCONEXION', mode: 'TEMPORAL' } })).body.request
  const disconnection = `requests/${disconnect.id}`
  assert.equal((await request(`${disconnection}/submit`, { token: citizenToken, body: { version: 1 } })).status, 422)
  for (const [index, category] of ['IDENTIFICACION', 'ESCRITURA', 'CARTA'].entries()) {
    assert.equal((await upload(disconnection, index + 1, category)).status, 200)
  }
  assert.equal((await request(`${disconnection}/submit`, { token: citizenToken, body: { version: 4 } })).body.request.status, 'EN_REVISION')
  // Force a different API process; only PostgreSQL and the signing key remain.
  await stopApi()
  await startApi()
  assert.equal((await request('health/db')).status, 200)
  const afterRestart = await request(path, { token: citizenToken })
  assert.equal(afterRestart.status, 200)
  assert.deepEqual(afterRestart.body.request, closed.body.request)
  assert.deepEqual((await request(`${path}/receipt`, { token: citizenToken })).body, receipt.body)
  const lookup = `SOL-${String(closed.body.request.number).padStart(6, '0')}`
  const day = new Date(new Date(closed.body.request.createdAt).getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const filters = new URLSearchParams({ query: lookup, queue: 'visits', service: 'MEDIDOR', status: 'FINALIZADA', date: day })
  const filtered = await request(`admin/requests?${filters}`, { token: adminToken })
  assert.equal(filtered.status, 200)
  assert.deepEqual(filtered.body.items.map(item => item.id), [draft.id])
  filters.set('queue', 'reviews')
  assert.deepEqual((await request(`admin/requests?${filters}`, { token: adminToken })).body.items, [])
  const matchNis = await request(`requests?${new URLSearchParams({ query: fields.nis.toLowerCase(), service: 'MEDIDOR' })}`, { token: citizenToken })
  assert.deepEqual(matchNis.body.items.map(item => item.id), [draft.id])
  assert.equal((await request('admin/requests?date=2026-02-31', { token: adminToken })).status, 400)
  const overview = (await request('requests/overview', { token: citizenToken })).body
  assert.equal(overview.counts.FINALIZADA, 2)
  assert.equal(overview.recent.length, 3)
  assert.equal((await request('requests/overview', { token: second.body.token })).body.recent.length, 0)
  const savedDisconnection = (await request(disconnection, { token: citizenToken })).body.request
  assert.equal(savedDisconnection.status, 'EN_REVISION')
  assert.deepEqual((await request(`${disconnection}/attachments/${savedDisconnection.attachments[0].id}`, { token: citizenToken })).body, pdf)
  command(['account:create-admin'], {
    ADMIN_NAME: 'Duplicado no permitido', ADMIN_EMAIL: `admin-${suffix}@institution.test`, ADMIN_PASSWORD: password,
  }, 1)
  for (const [role, account, token, endpoint] of [
    ['admin', admin.body.administrator, admin.body.token, 'auth/admin/me'],
    ['citizen', citizen.body.citizen, citizen.body.token, 'auth/me'],
    ['citizen', second.body.citizen, second.body.token, 'auth/me'],
  ]) {
    command(['account:disable'], { ACCOUNT_ROLE: role, ACCOUNT_ID: account.id, ACCOUNT_CONFIRM_DISABLE: account.id })
    assert.equal((await request(endpoint, { token })).status, 401)
  }
  assert.equal((await request('auth/admin/login', { body: { email: `admin-${suffix}@institution.test`, password } })).status, 401)
  assert.equal((await request('auth/login', { body: { dui: citizenData.dui, password } })).status, 401)
  console.log('PASS PostgreSQL real: autenticación, solicitudes, pago único, visitas y persistencia de historial, adjuntos y PDF después de reiniciar la API.')
} finally {
  await stopApi()
}
