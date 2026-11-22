import test from 'node:test'
import assert from 'node:assert/strict'
import { blankRequest } from '../src/data.ts'
import { mergeCitizenEdit } from '../src/requestEditing.ts'

const original = () => ({ ...blankRequest('citizen-demo', 'medidor'), id: 'SOL-DEMO-100', status: 'Corrección de datos', observation: 'Corrige la dirección', history: [{ title: 'Corrección solicitada', date: 'hoy', detail: 'Dirección' }] })
test('corrección actualizada aplica solo campos ciudadanos y preserva pago y especificaciones', () => {
  const current = { ...original(), paid: true, diameter: '½ pulgada', specification: 'Especificación vigente' }
  const submitted = { ...current, status: 'En revisión', address: 'Dirección corregida', paid: false, diameter: '', specification: '' }
  const result = mergeCitizenEdit(current, submitted, current.owner)
  assert.equal(result.address, 'Dirección corregida')
  assert.equal(result.status, 'En revisión')
  assert.equal(result.observation, '')
  assert.equal(result.paid, true)
  assert.equal(result.specification, current.specification)
  assert.equal(result.diameter, current.diameter)
})
test('rechaza edición obsoleta, ajena o cuando expediente ha avanzado', () => {
  const current = original()
  const submitted = { ...current, status: 'En revisión' }
  assert.equal(mergeCitizenEdit({ ...current, status: 'Habilitada para pago' }, submitted, current.owner), undefined)
  assert.equal(mergeCitizenEdit({ ...current, history: [...current.history, { title: 'Nueva revisión' }] }, submitted, current.owner), undefined)
  assert.equal(mergeCitizenEdit(current, submitted, 'otro-ciudadano'), undefined)
})
