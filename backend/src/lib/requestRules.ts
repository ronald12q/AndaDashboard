import { DisconnectionMode, MaterialDiameter, PhysicalCheck, RequestAction, RequestStatus, ServiceType } from '@prisma/client';
import type { ServiceRequest } from '@prisma/client';

export class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function draftFields(body: Record<string, unknown>, service: ServiceType) {
  const fields = { nis: 40, phone: 25, address: 300, reference: 300, reason: 1200 };
  const result: Partial<Record<keyof typeof fields, string>> & { mode?: DisconnectionMode | null } = {};
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    if (!Object.hasOwn(body, key)) continue;
    const value = body[key];
    if (typeof value !== 'string' || value.trim().length > fields[key] || value.includes('\0')) {
      throw new RequestError(400, `Campo ${key} inválido (máximo ${fields[key]} caracteres).`);
    }
    result[key] = value.trim();
  }
  if (Object.hasOwn(body, 'mode')) {
    if (service !== ServiceType.DESCONEXION || (body.mode !== null && !Object.values(DisconnectionMode).includes(body.mode as DisconnectionMode))) {
      throw new RequestError(400, 'Modalidad inválida para este trámite.');
    }
    result.mode = body.mode as DisconnectionMode | null;
  }
  return result;
}

const materialServices: ServiceType[] = [ServiceType.MEDIDOR, ServiceType.CAJA, ServiceType.VALVULA];
export const hasMaterial = (service: ServiceType): boolean => materialServices.includes(service);
export type WorkflowAction = 'edit' | 'submit' | 'correct' | 'approve' | 'specifications' | 'submit-evidence' | 'correct-evidence' | 'approve-evidence' | 'add-file' | 'remove-file' | 'simulate-payment' | 'schedule-visit' | 'visit-progress' | 'close-visit';

export function specificationFields(body: Record<string, unknown>, service: ServiceType) {
  const text = typeof body.specification === 'string' ? body.specification.trim() : '';
  if (text.length < 10 || text.length > 1200 || text.includes('\0')) {
    throw new RequestError(400, 'Indica especificaciones de 10 a 1200 caracteres.');
  }
  if (service === ServiceType.CAJA) {
    if (body.diameter != null) throw new RequestError(400, 'Para la caja indica compatibilidad, no diámetro residencial.');
    return { specification: text, diameter: null };
  }
  if (!Object.values(MaterialDiameter).includes(body.diameter as MaterialDiameter)) {
    throw new RequestError(400, 'Confirma un diámetro residencial de ½ o ¾ de pulgada.');
  }
  return { specification: text, diameter: body.diameter as MaterialDiameter };
}

export function transition(request: ServiceRequest, action: WorkflowAction): { status: RequestStatus; action: RequestAction } {
  const editable = request.status === RequestStatus.BORRADOR || request.status === RequestStatus.CORRECCION_DATOS;
  const acceptsEvidence = request.status === RequestStatus.PENDIENTE_MATERIAL || request.status === RequestStatus.CORRECCION_MATERIAL;
  const paid = request.paidAt !== null && request.paymentCents !== null;
  const allowed: Record<WorkflowAction, boolean> = {
    edit: editable, submit: editable, correct: request.status === RequestStatus.EN_REVISION,
    approve: request.status === RequestStatus.EN_REVISION,
    specifications: materialServices.includes(request.service) && request.status === RequestStatus.PENDIENTE_ESPECIFICACIONES,
    'submit-evidence': acceptsEvidence,
    'correct-evidence': request.status === RequestStatus.REVISION_MATERIAL,
    'approve-evidence': request.status === RequestStatus.REVISION_MATERIAL,
    'add-file': editable || acceptsEvidence, 'remove-file': editable || acceptsEvidence,
    'simulate-payment': !paid && request.paidAt === null && request.paymentCents === null && request.status === RequestStatus.HABILITADA_PAGO,
    'schedule-visit': paid && (request.status === RequestStatus.PAGO_REGISTRADO || request.status === RequestStatus.VISITA_PROGRAMADA ||
      (request.status === RequestStatus.EN_EJECUCION && request.physical === PhysicalCheck.REQUIERE_SUSTITUCION)),
    'visit-progress': paid && (request.status === RequestStatus.VISITA_PROGRAMADA || request.status === RequestStatus.EN_EJECUCION),
    'close-visit': paid && request.status === RequestStatus.EN_EJECUCION,
  };
  if (!allowed[action]) {
    throw new RequestError(409, 'La acción no está disponible en el estado actual.');
  }
  switch (action) {
    case 'edit': return { status: request.status, action: RequestAction.EDICION };
    case 'submit': {
      const digits = request.phone.replace(/\D/g, '').length;
      if (!request.nis || request.address.length < 5 || request.reason.length < 5 ||
          !/^[0-9+ ()-]+$/.test(request.phone) || digits < 8 || digits > 15) {
        throw new RequestError(422, 'Completa el NIS, teléfono, dirección y motivo antes de enviar.');
      }
      return { status: RequestStatus.EN_REVISION, action: request.status === RequestStatus.BORRADOR ? RequestAction.ENVIO : RequestAction.REENVIO };
    }
    case 'correct': return { status: RequestStatus.CORRECCION_DATOS, action: RequestAction.SOLICITUD_CORRECCION };
    case 'approve': return {
      status: materialServices.includes(request.service)
        ? RequestStatus.PENDIENTE_ESPECIFICACIONES : RequestStatus.HABILITADA_PAGO,
      action: RequestAction.APROBACION_DATOS,
    };
    case 'specifications': return { status: RequestStatus.PENDIENTE_MATERIAL, action: RequestAction.ESPECIFICACIONES_ENVIADAS };
    case 'submit-evidence': return { status: RequestStatus.REVISION_MATERIAL, action: RequestAction.EVIDENCIA_ENVIADA };
    case 'correct-evidence': return { status: RequestStatus.CORRECCION_MATERIAL, action: RequestAction.CORRECCION_MATERIAL_SOLICITADA };
    case 'approve-evidence': return { status: RequestStatus.HABILITADA_PAGO, action: RequestAction.EVIDENCIA_APROBADA };
    case 'add-file': return { status: request.status, action: RequestAction.ADJUNTO_AGREGADO };
    case 'remove-file': return { status: request.status, action: RequestAction.ADJUNTO_RETIRADO };
    case 'simulate-payment': return { status: RequestStatus.PAGO_REGISTRADO, action: RequestAction.PAGO_SIMULADO_REGISTRADO };
    case 'schedule-visit': return { status: RequestStatus.VISITA_PROGRAMADA, action: RequestAction.VISITA_PROGRAMADA };
    case 'visit-progress': return { status: RequestStatus.EN_EJECUCION, action: RequestAction.AVANCE_VISITA };
    case 'close-visit': return { status: RequestStatus.FINALIZADA, action: RequestAction.SOLICITUD_FINALIZADA };
  }
}
