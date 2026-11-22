import test from 'node:test'
import assert from 'node:assert/strict'
import { blankRequest } from '../src/data.ts'
import { canManageVisit, PHYSICAL_ACCEPTED, validateVisit } from '../src/visit.ts'

const request = service => ({ ...blankRequest('citizen-demo', service), paid: true, status: 'Pago registrado' })
const values = { visitDate: '2026-12-01T09:00', coordination: 'Contacto ficticio coordinado', physical: PHYSICAL_ACCEPTED, result: 'Trabajo simulado realizado' }
test('visitas requieren pago y fase de programación o ejecución; cierre es inmutable', () => {
  assert.equal(canManageVisit(request('medidor')), true)
  assert.equal(canManageVisit({ ...request('medidor'), paid: false }), false)
  for (const status of ['En revisión', 'Pendiente de material', 'Finalizada']) {
    assert.equal(canManageVisit({ ...request('medidor'), status }), false)
  }
})
test('medidor, caja y válvula exigen comprobación física para cierre, no para guardar avance', () => {
  for (const service of ['medidor', 'caja', 'valvula']) {
    const r = request(service)
    assert.equal(validateVisit(r, values, true), '')
    assert.ok(validateVisit(r, { ...values, physical: 'Requiere sustitución' }, true))
    assert.equal(validateVisit(r, { ...values, physical: 'Requiere sustitución' }, false), '')
    assert.ok(validateVisit(r, { ...values, result: '  ' }, true))
  }
})
test('servicios sin material cierran con resultado y coordinación sin comprobación física', () => {
  for (const service of ['reconexion', 'desconexion', 'fuga']) {
    assert.equal(validateVisit(request(service), { ...values, physical: 'No aplica' }, true), '')
  }
  assert.ok(validateVisit(request('fuga'), { ...values, visitDate: 'inválida' }, false))
  assert.ok(validateVisit(request('fuga'), { ...values, coordination: ' ' }, false))
})
