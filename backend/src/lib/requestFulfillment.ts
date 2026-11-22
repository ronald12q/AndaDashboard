import { PhysicalCheck, ServiceType } from '@prisma/client';
import type { Prisma, ServiceRequest } from '@prisma/client';
import { hasMaterial, RequestError } from './requestRules.js';
import type { WorkflowAction } from './requestRules.js';

const fee: Record<ServiceType, number> = {
  MEDIDOR: 678, CAJA: 1582, VALVULA: 452, RECONEXION: 1356, DESCONEXION: 1356, FUGA: 2583,
};
export const feeCents = (service: ServiceType): number => fee[service];

function text(value: unknown, maximum: number, label: string): string {
  if (typeof value !== 'string' || value.trim().length > maximum || value.includes('\0')) {
    throw new RequestError(400, `${label}: escribe hasta ${maximum} caracteres.`);
  }
  return value.trim();
}

export function fulfillmentFields(request: ServiceRequest, action: WorkflowAction, body: Record<string, unknown>): Prisma.ServiceRequestUpdateManyMutationInput {
  switch (action) {
    case 'simulate-payment': {
      if (Object.keys(body).some(key => key !== 'version')) {
        throw new RequestError(400, 'El pago simulado no admite importes, tarjetas ni datos financieros.');
      }
      return { paidAt: new Date(), paymentCents: feeCents(request.service) };
    }
    case 'schedule-visit': {
      const date = typeof body.visitDate === 'string' ? body.visitDate : '';
      const visitDate = new Date(date);
      if (Number.isNaN(visitDate.getTime()) || visitDate.toISOString() !== date || visitDate.getUTCFullYear() < 2000 || visitDate.getUTCFullYear() > 2100) {
        throw new RequestError(400, 'Indica una fecha y hora tentativa válida en UTC (ISO 8601).');
      }
      const coordination = text(body.coordination, 600, 'Coordinación');
      if (!coordination) throw new RequestError(400, 'Indica cómo se coordinó la visita.');
      return { visitDate, coordination, ...(request.physical === PhysicalCheck.REQUIERE_SUSTITUCION ? { result: null } : {}) };
    }
    case 'visit-progress': {
      const result = text(body.result ?? '', 1200, 'Resultado');
      const physical = hasMaterial(request.service) ? body.physical ?? PhysicalCheck.PENDIENTE : null;
      if (hasMaterial(request.service) && !Object.values(PhysicalCheck).includes(physical as PhysicalCheck)) {
        throw new RequestError(400, 'Indica el resultado de la comprobación física.');
      }
      if (physical === PhysicalCheck.REQUIERE_SUSTITUCION && !result) {
        throw new RequestError(400, 'Describe por qué el material requiere sustitución.');
      }
      return { result, physical: physical as PhysicalCheck | null };
    }
    case 'close-visit':
      if (!request.visitDate || !request.coordination || !request.result ||
          (hasMaterial(request.service) && request.physical !== PhysicalCheck.COMPATIBLE)) {
        throw new RequestError(422, 'Para finalizar, guarda el resultado y confirma la compatibilidad física del material cuando corresponda.');
      }
      return { completedAt: new Date() };
    default: return {};
  }
}

export function paymentReceipt(number: number, paidAt: Date, amount: number): Buffer {
  // The receipt uses ASCII and persisted numeric/date values only (never user input).
  const lines = [
    'ANDA - PROTOTIPO ACADEMICO', 'COMPROBANTE SIMULADO - SIN VALIDEZ FISCAL',
    `Solicitud: SOL-${String(number).padStart(6, '0')}`, `Registrado (UTC): ${paidAt.toISOString()}`,
    `Importe de referencia: USD ${(amount / 100).toFixed(2)}`,
    'Sin cargos reales. No acredita pago ante ANDA.',
  ];
  const stream = `BT /F1 12 Tf 48 780 Td 22 TL ${lines.map((line, index) => `${index ? 'T* ' : ''}(${line.replace(/[()\\]/g, '\\$&')}) Tj`).join('\n')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}
