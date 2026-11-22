export type Role = 'citizen' | 'admin'
export interface User { id: string; name: string; email: string; dui: string; role: Role }
export interface Attachment { name: string; size: number; type: string; category: string }
export interface Event { title: string; detail: string; date: string }
export type Status = 'Borrador' | 'En revisión' | 'Corrección de datos' | 'Pendiente de especificaciones' | 'Pendiente de material' | 'Revisión de material' | 'Requiere corrección' | 'Habilitada para pago' | 'Pago registrado' | 'Visita programada' | 'En ejecución' | 'Finalizada'
export interface Request {
  id: string; owner: string; service: string; status: Status; createdAt: string
  nis: string; phone: string; address: string; reference: string; reason: string
  mode: string; files: Attachment[]; history: Event[]; observation: string
  verified: boolean; diameter: string; specification: string; paid: boolean
  visitDate: string; coordination: string; physical: string; result: string
}
export type UpdateRequest = (id: string, patch: Partial<Request>, title: string, detail?: string) => void
export const services = [
  { id: 'medidor', name: 'Instalación de medidor', description: 'Instalación del equipo de medición de tu servicio.', price: 6.78, material: true, piece: 'Medidor de agua potable' },
  { id: 'caja', name: 'Caja de medidor', description: 'Colocación de protección para el medidor.', price: 15.82, material: true, piece: 'Caja de protección para medidor' },
  { id: 'valvula', name: 'Válvula de control', description: 'Instalación del accesorio de control indicado.', price: 4.52, material: true, piece: 'Válvula de control' },
  { id: 'reconexion', name: 'Reconexión de servicio', description: 'Restablecimiento del suministro suspendido.', price: 13.56, material: false, piece: '' },
  { id: 'desconexion', name: 'Desconexión a solicitud', description: 'Suspensión temporal o desconexión definitiva.', price: 13.56, material: false, piece: '' },
  { id: 'fuga', name: 'Detección de fuga interna', description: 'Inspección y localización de una posible fuga.', price: 25.83, material: false, piece: '' },
]
export const demoUsers: User[] = [
  { id: 'citizen-demo', name: 'Usuario de prueba', email: 'ciudadano@example.com', dui: '00000001-0', role: 'citizen' },
  { id: 'admin-demo', name: 'Administrador demo', email: 'admin@example.com', dui: '00000002-0', role: 'admin' },
]
export const DEMO_PASSWORD = 'DemoANDA2026'
export const statuses: Status[] = ['Borrador', 'En revisión', 'Corrección de datos', 'Pendiente de especificaciones', 'Pendiente de material', 'Revisión de material', 'Requiere corrección', 'Habilitada para pago', 'Pago registrado', 'Visita programada', 'En ejecución', 'Finalizada']
export const money = (value: number) => `$${value.toFixed(2)}`
export const serviceFor = (id: string) => services.find(s => s.id === id) ?? services[0]
export const now = () => new Date().toLocaleString('es-SV')
export function blankRequest(owner: string, service: string): Request {
  return {
    id: '', owner, service, status: 'En revisión', createdAt: new Date().toISOString().slice(0, 10),
    nis: '', phone: '', address: '', reference: '', reason: '', mode: 'Temporal',
    files: [], history: [], observation: '', verified: false, diameter: '', specification: '',
    paid: false, visitDate: '', coordination: '', physical: 'Pendiente de comprobación', result: '',
  }
}
export const seedRequests: Request[] = [
  { ...blankRequest('citizen-demo', 'medidor'), id: 'SOL-DEMO-001', nis: 'NIS-DEMO-001', phone: '7000-0000', address: 'Colonia de prueba, San Salvador', reference: 'Frente al parque de prueba', reason: 'Solicito la instalación de un medidor nuevo.', verified: true, diameter: '½ pulgada', specification: 'Medidor metálico para agua potable. Referencia académica ISO 4064; confirmar compatibilidad en domicilio.', status: 'Pendiente de material', history: [{ title: 'Solicitud recibida', detail: 'Datos ficticios registrados', date: '10/11/2026' }, { title: 'Cuenta revisada', detail: 'Verificación manual simulada completada', date: '11/11/2026' }, { title: 'Especificaciones enviadas', detail: 'Ficha disponible para compra de prueba', date: '11/11/2026' }] },
  { ...blankRequest('citizen-demo', 'fuga'), id: 'SOL-DEMO-002', nis: 'NIS-DEMO-002', phone: '7000-0000', address: 'Dirección ficticia del inmueble', reason: 'Revisar posible fuga interna.', verified: true, paid: true, status: 'Visita programada', visitDate: '2026-11-20T09:00', coordination: 'Contacto de prueba: disponible por la mañana.', history: [{ title: 'Solicitud recibida', detail: 'Datos registrados', date: '12/11/2026' }, { title: 'Pago simulado registrado', detail: 'Sin cargos reales', date: '13/11/2026' }, { title: 'Visita programada', detail: 'Fecha tentativa por coordinar', date: '14/11/2026' }] },
  { ...blankRequest('citizen-demo', 'reconexion'), id: 'SOL-DEMO-003', nis: 'NIS-DEMO-003', phone: '7000-0000', address: 'Dirección ficticia del inmueble', reason: 'Solicito restablecer el servicio.', status: 'En revisión', history: [{ title: 'Solicitud recibida', detail: 'Pendiente de revisión manual simulada', date: '15/11/2026' }] },
  { ...blankRequest('citizen-demo', 'desconexion'), id: 'SOL-DEMO-004', nis: 'NIS-DEMO-004', phone: '7000-0000', address: 'Dirección ficticia del inmueble', reason: 'Inmueble deshabitado temporalmente.', status: 'En revisión', files: [{ name: 'Identificacion_demo.pdf', size: 2048, type: 'application/pdf', category: 'Identificación del solicitante' }], history: [{ title: 'Solicitud recibida', detail: 'Documentación ficticia pendiente de revisión', date: '15/11/2026' }] },
  ...['caja', 'valvula'].map((service, i): Request => ({ ...blankRequest('citizen-demo', service), id: `SOL-DEMO-00${i + 5}`, nis: `NIS-DEMO-00${i + 5}`, address: 'Dirección ficticia del inmueble', status: 'Finalizada', verified: true, paid: true, result: 'Trabajo de prueba finalizado.', history: [{ title: 'Solicitud finalizada', detail: 'Ejemplo histórico simulado', date: '01/11/2026' }] })),
]
export function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}
export function downloadText(name: string, text: string) {
  saveBlob(name, new Blob([text], { type: 'text/plain;charset=utf-8' }))
}
function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
// Small, dependency-free PDF. Only ASCII text is emitted so PDF offsets stay correct.
export function downloadPdf(name: string, lines: string[]) {
  const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/([\\()])/g, '\\$1')
  const stream = `BT /F1 12 Tf 45 790 Td 18 TL ${lines.map((s, i) => `${i ? 'T* ' : ''}(${ascii(s)}) Tj`).join('\n')} ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  saveBlob(name, new Blob([pdf], { type: 'application/pdf' }))
}
export function receipt(request: Request) {
  downloadPdf(`Comprobante-SIMULADO-${request.id}.pdf`, ['ANDA - PROTOTIPO ACADEMICO', 'COMPROBANTE SIMULADO - SIN VALIDEZ FISCAL', 'No acredita pago ni tramite institucional.', '', `Solicitud: ${request.id}`, `Servicio: ${serviceFor(request.service).name}`, `Total de referencia con IVA: ${money(serviceFor(request.service).price)}`, `Estado: ${request.paid ? 'Pago simulado registrado' : 'EJEMPLO - no pagado'}`, `Fecha de descarga: ${now()}`, '', 'No se han realizado cargos ni procesado tarjetas.'])
}
