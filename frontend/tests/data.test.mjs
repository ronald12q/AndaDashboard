import test from 'node:test'
import assert from 'node:assert/strict'
import { blankRequest, demoUsers, downloadPdf, money, readStored, seedRequests, services, statuses } from '../src/data.ts'

test('catálogo: seis trámites y tarifas demo con IVA acordadas', () => {
  assert.equal(services.length, 6)
  assert.deepEqual(services.map(s => s.price), [6.78, 15.82, 4.52, 13.56, 13.56, 25.83])
  assert.deepEqual(services.filter(s => s.material).map(s => s.id), ['medidor', 'caja', 'valvula'])
  assert.equal(money(6.78), '$6.78')
})
test('solicitudes iniciales coherentes y cuentas sin contraseñas persistidas', () => {
  assert.equal(new Set(seedRequests.map(r => r.id)).size, seedRequests.length)
  for (const request of seedRequests) {
    assert.ok(statuses.includes(request.status))
    assert.ok(services.some(s => s.id === request.service))
    if (['Visita programada', 'Finalizada'].includes(request.status)) assert.equal(request.paid, true)
  }
  for (const account of demoUsers) {
    assert.ok(!('password' in account))
    assert.ok(!('passwordHash' in account))
  }
  const a = blankRequest('owner', 'medidor'), b = blankRequest('owner', 'medidor')
  a.files.push({ name: 'demo.pdf' })
  assert.equal(b.files.length, 0)
  assert.equal(a.diameter, '')
  assert.equal(a.paid, false)
})
test('persistencia inaccesible o inválida conserva un fallback utilizable', () => {
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true })
  assert.deepEqual(readStored('x', []), [])
  globalThis.localStorage = { getItem: () => '{invalid' }
  assert.equal(readStored('x', 'fallback'), 'fallback')
  globalThis.localStorage = { getItem: () => '{"demo":true}' }
  assert.deepEqual(readStored('x', {}), { demo: true })
  delete globalThis.localStorage
})
test('documentos PDF descargables: cabecera, advertencia y offsets válidos', async () => {
  let downloadedBlob
  let clicked = false
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  URL.createObjectURL = blob => { downloadedBlob = blob; return 'blob:demo' }
  URL.revokeObjectURL = () => {}
  globalThis.document = { createElement: () => ({ click: () => { clicked = true } }) }
  try {
    downloadPdf('demo.pdf', ['COMPROBANTE SIMULADO - SIN VALIDEZ FISCAL', 'Instalación de medidor: $6.78'])
    assert.equal(clicked, true)
    assert.equal(downloadedBlob.type, 'application/pdf')
    const text = await downloadedBlob.text()
    assert.ok(text.startsWith('%PDF-1.4'))
    assert.ok(text.includes('SIN VALIDEZ FISCAL'))
    const offset = Number(text.match(/startxref\n(\d+)/)[1])
    assert.equal(text.slice(offset, offset + 4), 'xref')
    const entries = text.slice(offset).split('\n').slice(3, 8)
    entries.forEach((entry, i) => assert.ok(text.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj`)))
  } finally {
    URL.createObjectURL = originalCreate
    // The async cleanup callback intentionally calls the harmless original function.
    URL.revokeObjectURL = originalRevoke
    delete globalThis.document
  }
})
