import { AttachmentCategory, RequestStatus, ServiceType } from '@prisma/client';
import type { ServiceRequest } from '@prisma/client';
import { RequestError } from './requestRules.js';

export const maxUploadBytes = 5 * 1024 * 1024;
export const requiredDocuments = [AttachmentCategory.IDENTIFICACION, AttachmentCategory.ESCRITURA, AttachmentCategory.CARTA];

export function validateCategory(request: ServiceRequest, category: AttachmentCategory): void {
  const editable = category === AttachmentCategory.EVIDENCIA
    ? request.status === RequestStatus.PENDIENTE_MATERIAL || request.status === RequestStatus.CORRECCION_MATERIAL
    : request.service === ServiceType.DESCONEXION &&
      (request.status === RequestStatus.BORRADOR || request.status === RequestStatus.CORRECCION_DATOS);
  if (!editable) throw new RequestError(409, 'No se pueden cambiar adjuntos de esa categoría en esta etapa.');
}

export function parseAttachment(content: unknown, filename: unknown, category: unknown) {
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 160 || /[/\\\x00-\x1f\x7f]/.test(filename)) {
    throw new RequestError(400, 'Nombre de archivo inválido.');
  }
  if (typeof category !== 'string' || !Object.values(AttachmentCategory).includes(category as AttachmentCategory)) {
    throw new RequestError(400, 'Categoría de adjunto inválida.');
  }
  if (!Buffer.isBuffer(content) || !content.length || content.length > maxUploadBytes) {
    throw new RequestError(400, 'Envía un archivo de hasta 5 MB.');
  }
  const matches = (prefix: number[]) => prefix.every((byte, index) => content[index] === byte);
  const ext = filename.toLowerCase().split('.').pop();
  const mime = ext === 'pdf' && content.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : ext === 'png' && matches([137, 80, 78, 71, 13, 10, 26, 10]) ? 'image/png'
      : (ext === 'jpg' || ext === 'jpeg') && matches([255, 216, 255]) ? 'image/jpeg'
        : ext === 'webp' && content.subarray(0, 4).toString() === 'RIFF' && content.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
  if (!mime) throw new RequestError(415, 'El archivo debe ser PDF, PNG, JPEG o WEBP con extensión y firma coincidentes.');
  return { filename: filename.trim(), category: category as AttachmentCategory, mime, size: content.length, content: Uint8Array.from(content) };
}
