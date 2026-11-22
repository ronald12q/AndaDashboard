import { services } from '../data'
import { ApiError, serviceCodes } from './api'
import type { RecordSummary, ServiceCode } from './api'

export const serviceName = (code: ServiceCode) => services.find(service => serviceCodes[service.id as keyof typeof serviceCodes] === code)?.name ?? code
export const number = (record: RecordSummary) => `SOL-${String(record.number).padStart(6, '0')}`
export function report(error: unknown, expired: () => void, setError: (message: string) => void) {
  if (error instanceof ApiError && error.status === 401) { expired(); return }
  setError(error instanceof Error ? error.message : 'No se pudo completar la operación.')
}
