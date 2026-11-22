import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// No application state/session injection: every change is made through the UI.
const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName)
const base = process.env.BASE_URL || 'http://127.0.0.1:5175'
const artifacts = process.env.E2E_ARTIFACTS || '/tmp/opencode/anda-e2e'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const services = ['medidor', 'caja', 'valvula', 'reconexion', 'desconexion', 'fuga']
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
const pdf = Buffer.from('%PDF-1.4\n% DOCUMENTO FICTICIO E2E SIN DATOS PERSONALES\n%%EOF\n')
const file = (name, type = 'application/pdf') => ({ name, mimeType: type, buffer: type === 'image/png' ? png : pdf })

try {
  for (const service of services) {
    const context = await browser.newContext({ acceptDownloads: true })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const jsErrors = []
    page.on('pageerror', error => jsErrors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') jsErrors.push(message.text()) })
    let stage = 'login'
    const button = name => page.getByRole('button', { name, exact: true })
    const route = async path => { await page.goto(`${base}/#/${path}`); await page.locator('h1').waitFor() }
    const visible = async locator => { await locator.waitFor({ state: 'visible' }); assert.equal(await locator.isVisible(), true) }
    const disabled = async locator => assert.equal(await locator.isDisabled(), true)
    const login = async admin => {
      if (await button('Cerrar sesión').count()) await button('Cerrar sesión').click()
      await visible(button('Ingresar'))
      if (admin) await button('Personal administrativo').click()
      await page.getByLabel(admin ? 'Correo institucional de prueba' : 'DUI de prueba', { exact: true }).fill(admin ? 'admin@example.com' : '00000001-0')
      await page.getByLabel('Contraseña demo', { exact: true }).fill('DemoANDA2026')
      await button('Ingresar').click()
      await visible(button('Cerrar sesión'))
    }
    const badge = async status => visible(page.locator('.page-heading .badge').filter({ hasText: status }))
    const historyCount = title => page.locator('.timeline li strong').filter({ hasText: new RegExp(`^${title}$`) }).count()
    const downloadReceipt = async name => {
      const pending = page.waitForEvent('download')
      await button(name).click()
      const download = await pending
      assert.match(download.suggestedFilename(), /^Comprobante-SIMULADO-SOL-DEMO-\d+\.pdf$/)
      const stream = await download.createReadStream()
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk)
      const content = Buffer.concat(chunks).toString()
      assert.ok(content.startsWith('%PDF-1.4'))
      assert.match(content, /SIN VALIDEZ FISCAL/)
      assert.match(content, /Pago simulado registrado/)
      await download.saveAs(`${artifacts}/${service}-${download.suggestedFilename()}`)
    }
    try {
      await route('login')
      await login(false)
      stage = 'crear y enviar'
      await route(`crear/${service}`)
      await page.getByLabel('NIS / cuenta del servicio', { exact: true }).fill(`NIS-E2E-${service}`)
      await page.getByLabel('Teléfono de contacto ficticio', { exact: true }).fill('7000-0000')
      await page.getByLabel('Dirección del inmueble ficticio', { exact: true }).fill('Inmueble ficticio E2E, San Salvador')
      await page.getByLabel('Referencias para ubicar el inmueble', { exact: true }).fill('Referencia ficticia')
      await page.getByLabel(service === 'desconexion' ? 'Justificación' : 'Motivo de la solicitud', { exact: true }).fill(`Solicitud ficticia E2E de ${service}`)
      if (service === 'desconexion') {
        await button('Enviar solicitud').click()
        await visible(page.getByRole('alert').filter({ hasText: 'Adjunta los tres documentos ficticios requeridos.' }))
        for (const category of ['Identificación del solicitante', 'Escritura del inmueble', 'Carta justificativa']) {
          await page.getByLabel(category, { exact: false }).setInputFiles(file(`${category}.pdf`))
        }
      }
      await button('Enviar solicitud').click()
      await badge('En revisión')
      const id = new URL(page.url()).hash.split('/').pop()
      assert.match(id, /^SOL-DEMO-\d+$/)
      stage = 'pago bloqueado y revisión inicial'
      await route(`pago/${id}`)
      await disabled(button('Simular pago'))
      await login(true)
      await route(`visita/${id}`)
      await disabled(button('Guardar avance'))
      await disabled(button('Finalizar solicitud'))
      await route(`revision/${id}`)
      if (service === 'desconexion') {
        await button('Ver archivos adjuntos').click()
        for (const category of ['Identificación del solicitante', 'Escritura del inmueble', 'Carta justificativa']) {
          await visible(page.getByText(`${category}.pdf`, { exact: true }))
        }
      }
      await button('Continuar').click()
      const material = ['medidor', 'caja', 'valvula'].includes(service)
      if (material) {
        stage = 'especificaciones'
        await visible(button('Enviar especificaciones'))
        if (service !== 'caja') await page.getByLabel('Diámetro residencial confirmado por administrador').selectOption(service === 'valvula' ? '¾ pulgada' : '½ pulgada')
        await page.getByLabel('Características y ficha de referencia').fill(`Compatibilidad ficticia E2E para ${service}; comprobar en domicilio.`)
        await button('Enviar especificaciones').click()
        await disabled(button('Habilitar pago'))
        await login(false)
        await route(`solicitud/${id}`)
        await badge('Pendiente de material')
        await page.getByRole('link', { name: 'Ya compré el material', exact: true }).click()
        stage = 'evidencia y corrección preliminar'
        await button('Enviar a revisión').click()
        await visible(page.getByRole('alert'))
        await page.locator('input[type=file]').setInputFiles([file('pieza-demo.png', 'image/png'), file('ficha-demo.pdf')])
        await button('Enviar a revisión').click()
        await badge('Revisión de material')
        await route(`pago/${id}`)
        await disabled(button('Simular pago'))
        await login(true)
        await route(`material/${id}`)
        await page.getByRole('tab', { name: 'Evidencia', exact: true }).click()
        await button('Pedir corrección').click()
        await visible(page.getByRole('alert').filter({ hasText: 'Describe la corrección requerida.' }))
        await page.getByLabel('Observación de la revisión de evidencia').fill('Adjunta una fotografía ficticia más cercana.')
        await button('Pedir corrección').click()
        await disabled(button('Habilitar pago'))
        await login(false)
        await route(`solicitud/${id}`)
        await badge('Requiere corrección')
        await page.getByRole('link', { name: 'Corregir evidencia', exact: true }).click()
        await page.locator('input[type=file]').setInputFiles(file('pieza-corregida-demo.png', 'image/png'))
        await button('Enviar a revisión').click()
        await badge('Revisión de material')
        await login(true)
        await route(`material/${id}`)
        await page.getByRole('tab', { name: 'Evidencia', exact: true }).click()
        await button('Habilitar pago').click()
        await disabled(button('Habilitar pago'))
      }
      stage = 'pago único y PDF real'
      await login(false)
      await route(`solicitud/${id}`)
      await badge('Habilitada para pago')
      await page.getByRole('link', { name: 'Ir al pago simulado', exact: true }).click()
      await button('Simular pago').click()
      await badge('Pago registrado')
      assert.equal(await historyCount('Pago simulado registrado'), 1)
      await downloadReceipt('Ver comprobante simulado')
      await route(`pago/${id}`)
      await disabled(button('Pago simulado registrado'))
      await page.reload()
      await disabled(button('Pago simulado registrado'))
      await login(true)
      stage = 'visita y validación de cierre'
      await route(`visita/${id}`)
      await button('Finalizar solicitud').click()
      await visible(page.getByRole('alert').filter({ hasText: 'Indica una fecha tentativa' }))
      await page.getByLabel('Fecha y hora tentativa').fill('2026-12-15T09:30')
      await page.getByLabel('Coordinación con el usuario').fill('Coordinación ficticia E2E: usuario disponible en domicilio.')
      await button('Finalizar solicitud').click()
      await visible(page.getByRole('alert').filter({ hasText: 'Para finalizar registra el resultado' }))
      await button('Guardar avance').click()
      await page.reload()
      assert.equal(await page.getByLabel('Fecha y hora tentativa').inputValue(), '2026-12-15T09:30')
      if (material) {
        stage = 'sustitución presencial sin nuevo cobro'
        await page.getByLabel('Resultado del trabajo').fill('Pieza incompatible; sustitución pendiente en domicilio.')
        await button('Finalizar solicitud').click()
        await visible(page.getByRole('alert').filter({ hasText: 'Para finalizar registra el resultado' }))
        await page.getByLabel('Verificación física del material').selectOption('Requiere sustitución')
        await button('Finalizar solicitud').click()
        await visible(page.getByRole('alert').filter({ hasText: 'Si requiere sustitución, guarda el avance sin cerrar.' }))
        await visible(page.getByText('El pago simulado ya registrado se conserva', { exact: false }))
        await page.getByRole('combobox', { name: /^Estado/ }).selectOption('En ejecución')
        await button('Guardar avance').click()
        await page.reload()
        assert.equal(await page.getByLabel('Verificación física del material').inputValue(), 'Requiere sustitución')
        await login(false)
        await route(`seguimiento/${id}`)
        await badge('En ejecución')
        assert.equal(await historyCount('Pago simulado registrado'), 1)
        await route(`pago/${id}`)
        await disabled(button('Pago simulado registrado'))
        await downloadReceipt('Descargar comprobante simulado')
        await login(true)
        await route(`visita/${id}`)
        await page.getByLabel('Verificación física del material').selectOption('Compatible, comprobado en domicilio')
      }
      stage = 'finalizar e inmutabilidad'
      await page.getByLabel('Resultado del trabajo').fill(`Trabajo ficticio ${service} finalizado E2E.`)
      await button('Guardar avance').click()
      await button('Finalizar solicitud').click()
      await disabled(button('Finalizar solicitud'))
      await disabled(button('Guardar avance'))
      await page.reload()
      for (const label of ['Fecha y hora tentativa', 'Coordinación con el usuario', 'Resultado del trabajo']) await disabled(page.getByLabel(label))
      await disabled(page.getByRole('combobox', { name: /^Estado/ }))
      if (material) await disabled(page.getByLabel('Verificación física del material'))
      await route(`revision/${id}`)
      await disabled(button('Continuar'))
      if (material) {
        await route(`material/${id}`)
        await disabled(button('Enviar especificaciones'))
        await disabled(button('Habilitar pago'))
      }
      await login(false)
      await route(`seguimiento/${id}`)
      await badge('Finalizada')
      await visible(page.getByRole('heading', { name: 'Resultado de la visita', exact: true }))
      await visible(page.locator('dd').filter({ hasText: `Trabajo ficticio ${service} finalizado E2E.` }))
      assert.equal(await historyCount('Solicitud finalizada'), 1)
      assert.equal(await historyCount('Pago simulado registrado'), 1)
      await route(`pago/${id}`)
      await disabled(button('Pago simulado registrado'))
      stage = 'ausencia de errores JavaScript/console (recorrido funcional completado)'
      assert.deepEqual(jsErrors, [], 'Errores JavaScript/console en el navegador')
      results.push({ service, status: 'PASS', jsErrors })
      console.log(`PASS ${service}`)
    } catch (error) {
      await page.screenshot({ path: `${artifacts}/${service}-failure.png`, fullPage: true }).catch(() => {})
      results.push({ service, status: 'FAIL', stage, error: error.message, jsErrors })
      console.error(`FAIL ${service} [${stage}]: ${error.message}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(results, null, 2))
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1
