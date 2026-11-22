import type { Role } from '../data'

export const serviceCodes = {
  medidor: 'MEDIDOR', caja: 'CAJA', valvula: 'VALVULA', reconexion: 'RECONEXION',
  desconexion: 'DESCONEXION', fuga: 'FUGA',
} as const
export type ServiceCode = typeof serviceCodes[keyof typeof serviceCodes]
export type Status = 'BORRADOR' | 'EN_REVISION' | 'CORRECCION_DATOS' | 'PENDIENTE_ESPECIFICACIONES' | 'PENDIENTE_MATERIAL' | 'REVISION_MATERIAL' | 'CORRECCION_MATERIAL' | 'HABILITADA_PAGO' | 'PAGO_REGISTRADO' | 'VISITA_PROGRAMADA' | 'EN_EJECUCION' | 'FINALIZADA'
export const statusLabels: Record<Status, string> = {
  BORRADOR: 'Borrador', EN_REVISION: 'En revisión', CORRECCION_DATOS: 'Corrección de datos',
  PENDIENTE_ESPECIFICACIONES: 'Pendiente de especificaciones', HABILITADA_PAGO: 'Habilitada para pago',
  PENDIENTE_MATERIAL: 'Pendiente de material', REVISION_MATERIAL: 'Revisión de material', CORRECCION_MATERIAL: 'Corrección de material',
  PAGO_REGISTRADO: 'Pago registrado', VISITA_PROGRAMADA: 'Visita programada', EN_EJECUCION: 'En ejecución', FINALIZADA: 'Finalizada',
}
export const categories = {
  IDENTIFICACION: 'Identificación del solicitante', ESCRITURA: 'Escritura del inmueble', CARTA: 'Carta justificativa',
  REPRESENTACION: 'Representación (si aplica)', EVIDENCIA: 'Evidencia de material',
} as const
export type Category = keyof typeof categories
export type Attachment = { id: string; filename: string; category: Category; size: number }
export type Diameter = 'MEDIA_PULGADA' | 'TRES_CUARTOS'
export type Draft = { nis: string; phone: string; address: string; reference: string; reason: string; mode: string | null }
export type RecordSummary = Draft & { id: string; number: number; service: ServiceCode; version: number; status: Status }
export type PhysicalCheck = 'PENDIENTE' | 'COMPATIBLE' | 'REQUIERE_SUSTITUCION'
export type RecordDetail = RecordSummary & {
  specification: string | null; diameter: Diameter | null; attachments: Attachment[]
  simulatedFeeCents: number; paymentCents: number | null; paidAt: string | null
  visitDate: string | null; coordination: string | null; physical: PhysicalCheck | null; result: string | null; completedAt: string | null
  history: { version: number; action: string; actorRole: string; note: string | null; createdAt: string }[]
}
type Account = { id: string; name: string; email: string }
export type Credentials = { role: Role; token: string }
export type Session = Credentials & { account: Account }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const host = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
async function send(path: string, options: { token?: string; method?: string; body?: unknown; file?: Blob; signal?: AbortSignal } = {}): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${host}/api/${path}`, {
      method: options.method ?? (options.body || options.file ? 'POST' : 'GET'),
      signal: options.signal,
      headers: {
        ...(options.file ? { 'Content-Type': 'application/octet-stream' } : options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.file ?? (options.body ? JSON.stringify(options.body) : undefined),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(0, 'No se pudo conectar con la API. Comprueba que esté en ejecución.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, typeof data?.error === 'string' ? data.error : 'La API no pudo completar la operación.')
  }
  return response
}
async function call<T>(path: string, options?: Parameters<typeof send>[1]): Promise<T> {
  const data = await (await send(path, options)).json().catch(() => null)
  if (!data || typeof data !== 'object') throw new ApiError(0, 'La respuesta no es válida. Revisa la URL de la API.')
  return data as T
}
export async function authenticate(role: Role, identifier: string, password: string, registration?: { name: string; email: string }) {
  const data = await call<{ token: string; citizen?: Account; administrator?: Account }>(
    registration ? 'auth/register' : role === 'admin' ? 'auth/admin/login' : 'auth/login',
    { body: registration ? { ...registration, dui: identifier, password } : role === 'admin' ? { email: identifier, password } : { dui: identifier, password } },
  )
  return { role, token: data.token, account: role === 'admin' ? data.administrator! : data.citizen! }
}
export async function restore(credentials: Credentials, signal: AbortSignal): Promise<Session> {
  const data = await call<{ citizen?: Account; administrator?: Account }>(credentials.role === 'admin' ? 'auth/admin/me' : 'auth/me', { ...credentials, signal })
  return { ...credentials, account: credentials.role === 'admin' ? data.administrator! : data.citizen! }
}
const collection = (session: Credentials) => session.role === 'admin' ? 'admin/requests' : 'requests'
export const askOrientador = (session: Credentials, pregunta: string, signal: AbortSignal) =>
  call<{ respuesta: string }>('chat', { token: session.token, body: { pregunta }, signal })
export type Filters = { query?: string; service?: string; status?: string; date?: string; queue?: 'reviews' | 'visits' }
export const list = (session: Credentials, before: number | null, signal: AbortSignal, filters: Filters = {}) => {
  const query = new URLSearchParams()
  if (before) query.set('before', String(before))
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  return call<{ items: RecordSummary[]; nextBefore: number | null }>(`${collection(session)}?${query}`, { ...session, signal })
}
export const overview = (session: Credentials, signal: AbortSignal) =>
  call<{ counts: Partial<Record<Status, number>>; recent: RecordSummary[] }>(`${collection(session)}/overview`, { ...session, signal })
export const detail = (session: Credentials, id: string, signal: AbortSignal) =>
  call<{ request: RecordDetail }>(`${collection(session)}/${encodeURIComponent(id)}`, { ...session, signal })
export const create = (session: Credentials, body: Omit<Draft, 'mode'> & { mode?: Draft['mode']; service: ServiceCode }) =>
  call<{ request: RecordDetail }>('requests', { ...session, body })
export const edit = (session: Credentials, id: string, version: number, body: Partial<Draft>) =>
  call<{ request: RecordDetail }>(`requests/${encodeURIComponent(id)}`, { ...session, method: 'PATCH', body: { ...body, version } })
export const act = (session: Credentials, record: RecordDetail, action: 'submit' | 'correct' | 'approve' | 'submit-evidence' | 'correct-evidence' | 'approve-evidence', note?: string) =>
  call<{ request: RecordDetail }>(`${collection(session)}/${encodeURIComponent(record.id)}/${action}`, { ...session, body: { version: record.version, note } })
const filesPath = (session: Credentials, record: RecordDetail) => `${collection(session)}/${encodeURIComponent(record.id)}/attachments`
export const specify = (session: Credentials, record: RecordDetail, specification: string, diameter: string | null) =>
  call<{ request: RecordDetail }>(`admin/requests/${encodeURIComponent(record.id)}/specifications`, { ...session, body: { version: record.version, specification, diameter } })
export const upload = (session: Credentials, record: RecordDetail, category: Category, file: File) =>
  call<{ request: RecordDetail }>(`${filesPath(session, record)}?${new URLSearchParams({ category, filename: file.name, version: String(record.version) })}`, { ...session, file })
export const remove = (session: Credentials, record: RecordDetail, file: Attachment) =>
  call<{ request: RecordDetail }>(`${filesPath(session, record)}/${encodeURIComponent(file.id)}`, { ...session, method: 'DELETE', body: { version: record.version } })
async function downloadAs(path: string, session: Credentials, filename: string) {
  const response = await send(path, session)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const download = (session: Credentials, record: RecordDetail, file: Attachment) =>
  downloadAs(`${filesPath(session, record)}/${encodeURIComponent(file.id)}`, session, file.filename)
export const receipt = (session: Credentials, record: RecordDetail) =>
  downloadAs(`${collection(session)}/${encodeURIComponent(record.id)}/receipt`, session, `Comprobante-SIMULADO-SOL-${String(record.number).padStart(6, '0')}.pdf`)
export const fulfillment = (session: Credentials, record: RecordDetail, action: 'simulate-payment' | 'schedule-visit' | 'visit-progress' | 'close-visit', fields: { visitDate?: string; coordination?: string; physical?: string; result?: string } = {}) =>
  call<{ request: RecordDetail }>(`${collection(session)}/${encodeURIComponent(record.id)}/${action}`, { ...session, body: { ...fields, version: record.version } })
