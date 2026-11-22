import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticateDemo } from '../src/auth.ts'
import { DEMO_PASSWORD, demoUsers } from '../src/data.ts'

test('ciudadano usa DUI y administrador correo, siempre con rol coincidente', () => {
  assert.equal(authenticateDemo(demoUsers, 'citizen', '00000001-0', DEMO_PASSWORD)?.role, 'citizen')
  assert.equal(authenticateDemo(demoUsers, 'admin', ' ADMIN@EXAMPLE.COM ', DEMO_PASSWORD)?.role, 'admin')
  assert.equal(authenticateDemo(demoUsers, 'admin', '00000002-0', DEMO_PASSWORD), undefined)
  assert.equal(authenticateDemo(demoUsers, 'citizen', 'admin@example.com', DEMO_PASSWORD), undefined)
  assert.equal(authenticateDemo(demoUsers, 'admin', 'ciudadano@example.com', DEMO_PASSWORD), undefined)
  assert.equal(authenticateDemo(demoUsers, 'citizen', 'ciudadano@example.com', DEMO_PASSWORD), undefined)
  assert.equal(authenticateDemo(demoUsers, 'admin', 'admin@example.com', 'incorrecta'), undefined)
})
