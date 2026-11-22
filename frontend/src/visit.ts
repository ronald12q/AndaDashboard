import type { Request } from './data.ts'
import { serviceFor } from './data.ts'

export const PHYSICAL_ACCEPTED = 'Compatible, comprobado en domicilio'
export function canManageVisit(request: Request): boolean {
  return request.paid && ['Pago registrado', 'Visita programada', 'En ejecución'].includes(request.status)
}
export function validateVisit(request: Request, values: Pick<Request, 'visitDate' | 'coordination' | 'physical' | 'result'>, close: boolean): string {
  if (!canManageVisit(request)) return 'La visita requiere un pago simulado registrado y un expediente abierto.'
  if (!values.visitDate || Number.isNaN(new Date(values.visitDate).getTime()) || !values.coordination.trim()) {
    return 'Indica una fecha tentativa válida y la coordinación con el usuario.'
  }
  if (close && (!values.result.trim() || serviceFor(request.service).material && values.physical !== PHYSICAL_ACCEPTED)) {
    return 'Para finalizar registra el resultado y, si aplica, confirma la compatibilidad física del material en domicilio. Si requiere sustitución, guarda el avance sin cerrar.'
  }
  return ''
}
