import { raw, Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { AttachmentCategory, RequestAction, RequestActor, RequestStatus, ServiceType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { bodyObject } from '../lib/validation.js';
import { draftFields, RequestError, specificationFields, transition } from '../lib/requestRules.js';
import { maxUploadBytes, parseAttachment, requiredDocuments, validateCategory } from '../lib/requestAttachments.js';
import { feeCents, fulfillmentFields, paymentReceipt } from '../lib/requestFulfillment.js';
import { requireAdmin, requireAuth } from '../middleware/requireAuth.js';
import type { AuthRequest } from '../middleware/requireAuth.js';

const history = {
  orderBy: { version: 'asc' },
  select: { version: true, action: true, status: true, actorRole: true, note: true, createdAt: true },
} as const satisfies Prisma.RequestEventFindManyArgs;
const include = { history, attachments: {
  orderBy: { version: 'asc' },
  select: { id: true, filename: true, category: true, mime: true, size: true, createdAt: true },
} } as const satisfies Prisma.ServiceRequestInclude;
const withFee = <T extends { service: ServiceType; paymentCents: number | null }>(request: T) => ({
  ...request, simulatedFeeCents: request.paymentCents ?? feeCents(request.service),
});

function owner(req: AuthRequest, admin: boolean): Prisma.ServiceRequestWhereInput {
  return admin ? { status: { not: RequestStatus.BORRADOR } } : { citizenId: req.citizen!.id };
}

const queues = {
  reviews: [RequestStatus.EN_REVISION, RequestStatus.CORRECCION_DATOS, RequestStatus.PENDIENTE_ESPECIFICACIONES,
    RequestStatus.PENDIENTE_MATERIAL, RequestStatus.REVISION_MATERIAL, RequestStatus.CORRECCION_MATERIAL],
  visits: [RequestStatus.PAGO_REGISTRADO, RequestStatus.VISITA_PROGRAMADA, RequestStatus.EN_EJECUCION, RequestStatus.FINALIZADA],
};

function dateFilter(date: string) {
  const from = new Date(`${date}T00:00:00.000-06:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(from.getTime()) || from.toISOString().slice(0, 10) !== date) {
    throw new RequestError(400, 'Fecha de registro inválida.');
  }
  return { gte: from, lt: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

function list(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const { before: after, query, service, status, date, queue } = req.query;
    if (after !== undefined && (typeof after !== 'string' || !/^[1-9]\d{0,9}$/.test(after) || Number(after) > 2147483647)) {
      throw new RequestError(400, 'Cursor de solicitudes inválido.');
    }
    if ((query !== undefined && (typeof query !== 'string' || query.length > 80 || query.includes('\0'))) ||
        (service !== undefined && !Object.values(ServiceType).includes(service as ServiceType)) ||
        (status !== undefined && !Object.values(RequestStatus).includes(status as RequestStatus)) ||
        (date !== undefined && typeof date !== 'string') ||
        (queue !== undefined && (!admin || (queue !== 'reviews' && queue !== 'visits')))) {
      throw new RequestError(400, 'Filtros de solicitudes inválidos.');
    }
    const filters: Prisma.ServiceRequestWhereInput[] = [owner(req, admin)];
    if (after) filters.push({ number: { lt: Number(after) } });
    if (service) filters.push({ service: service as ServiceType });
    if (status) filters.push({ status: status as RequestStatus });
    if (date) filters.push({ createdAt: dateFilter(date) });
    if (queue === 'reviews' || queue === 'visits') filters.push({ status: { in: queues[queue] } });
    if (query?.trim()) {
      const q = query.trim();
      const code = /^(?:SOL-)?(\d{1,10})$/i.exec(q);
      const number = code ? Number(code[1]) : 0;
      // Prisma uses LIKE for contains; escape its wildcards to search literal NIS values.
      filters.push({ OR: [{ nis: { contains: q.replace(/[\\_%]/g, '\\$&'), mode: 'insensitive' } },
        ...(number >= 1 && number <= 2147483647 ? [{ number }] : [])] });
    }
    const rows = await prisma.serviceRequest.findMany({
      where: { AND: filters },
      orderBy: { number: 'desc' }, take: 26,
    });
    const items = rows.slice(0, 25);
    res.json({ items, nextBefore: rows.length > 25 ? items.at(-1)!.number : null });
  };
}

function overview(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const scope = owner(req, admin);
    const [counts, recent] = await Promise.all([
      prisma.serviceRequest.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      admin ? [] : prisma.serviceRequest.findMany({ where: { AND: [scope, { status: { not: RequestStatus.BORRADOR } }] }, orderBy: { number: 'desc' }, take: 3 }),
    ]);
    res.json({ counts: Object.fromEntries(counts.map(row => [row.status, row._count._all])), recent });
  };
}

function detail(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId(req), ...owner(req, admin) }, include,
    });
    if (!request) throw new RequestError(404, 'Solicitud no encontrada.');
    res.json({ request: withFee(request) });
  };
}

function requestId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length > 128) throw new RequestError(404, 'Solicitud no encontrada.');
  return id;
}

function attachmentId(req: Request): string {
  const id = req.params.attachmentId;
  if (typeof id !== 'string' || id.length > 128) throw new RequestError(404, 'Adjunto no encontrado.');
  return id;
}

function download(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const file = await prisma.requestAttachment.findFirst({
      where: { id: attachmentId(req), request: { id: requestId(req), ...owner(req, admin) } },
      select: { filename: true, content: true },
    });
    if (!file) throw new RequestError(404, 'Adjunto no encontrado.');
    res.attachment(file.filename);
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': 'application/octet-stream', 'Content-Security-Policy': 'sandbox' });
    res.send(Buffer.from(file.content));
  };
}

function receipt(admin: boolean): RequestHandler {
  return async (req: AuthRequest, res) => {
    const record = await prisma.serviceRequest.findFirst({
      where: { id: requestId(req), ...owner(req, admin) },
      select: { number: true, paidAt: true, paymentCents: true },
    });
    if (!record || !record.paidAt || record.paymentCents === null) {
      throw new RequestError(404, 'Comprobante simulado no disponible.');
    }
    res.attachment(`Comprobante-SIMULADO-SOL-${String(record.number).padStart(6, '0')}.pdf`);
    res.type('application/pdf').send(paymentReceipt(record.number, record.paidAt, record.paymentCents));
  };
}

function mutate(action: Parameters<typeof transition>[1], admin = false): RequestHandler {
  return async (req: AuthRequest, res) => {
    const body = bodyObject(req.body);
    const rawVersion = req.query.version;
    const version = action === 'add-file' && typeof rawVersion === 'string' && /^[1-9]\d{0,9}$/.test(rawVersion)
      ? Number(rawVersion) : body.version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version >= 2147483647) {
      throw new RequestError(400, 'Envía la versión vigente de la solicitud.');
    }
    const scope = { id: requestId(req), ...owner(req, admin) };
    const request = await prisma.$transaction(async tx => {
      const current = await tx.serviceRequest.findFirst({ where: scope });
      if (!current) throw new RequestError(404, 'Solicitud no encontrada.');
      const stale = () => new RequestError(409, 'La solicitud cambió. Consulta la versión actual antes de continuar.');
      if (current.version !== version) throw stale();
      const next = transition(current, action);
      const fulfillment = fulfillmentFields(current, action, body);
      const data = action === 'edit' ? draftFields(body, current.service)
        : action === 'specifications' ? specificationFields(body, current.service) : fulfillment;
      const note = action === 'visit-progress' && typeof fulfillment.result === 'string' ? fulfillment.result
        : action === 'schedule-visit' && typeof fulfillment.coordination === 'string' ? fulfillment.coordination
          : typeof body.note === 'string' ? body.note.trim() : '';
      if (admin && ((body.note !== undefined && typeof body.note !== 'string') ||
          note.length > 1200 || note.includes('\0') || (['correct', 'correct-evidence'].includes(action) && !note))) {
        throw new RequestError(400, 'Indica una observación válida de hasta 1200 caracteres.');
      }
      const changed = await tx.serviceRequest.updateMany({
        where: { ...scope, version }, data: { ...data, status: next.status, version: { increment: 1 } },
      });
      if (!changed.count) throw stale();
      if (action === 'add-file') {
        const file = parseAttachment(req.body, req.query.filename, req.query.category);
        validateCategory(current, file.category);
        if (await tx.requestAttachment.count({ where: { requestId: current.id } }) >= 8) {
          throw new RequestError(422, 'El expediente admite hasta ocho archivos.');
        }
        await tx.requestAttachment.create({ data: { ...file, requestId: current.id, version: version + 1 } });
      } else if (action === 'remove-file') {
        const file = await tx.requestAttachment.findFirst({ where: { requestId: current.id, id: attachmentId(req) }, select: { id: true, category: true } });
        if (!file) throw new RequestError(404, 'Adjunto no encontrado.');
        validateCategory(current, file.category);
        await tx.requestAttachment.delete({ where: { id: file.id } });
      } else if (action === 'submit' && current.service === ServiceType.DESCONEXION) {
        const files = await tx.requestAttachment.findMany({ where: { requestId: current.id }, select: { category: true } });
        if (!current.mode || !requiredDocuments.every(category => files.some(file => file.category === category))) {
          throw new RequestError(422, 'Indica la modalidad y adjunta identificación, escritura y carta antes de enviar.');
        }
      } else if (action === 'submit-evidence') {
        const lastCorrection = await tx.requestEvent.findFirst({
          where: { requestId: current.id, action: RequestAction.CORRECCION_MATERIAL_SOLICITADA },
          orderBy: { version: 'desc' }, select: { version: true },
        });
        const evidence = await tx.requestAttachment.count({
          where: { requestId: current.id, category: AttachmentCategory.EVIDENCIA, version: { gt: lastCorrection?.version ?? 0 } },
        });
        if (!evidence) throw new RequestError(422, 'Adjunta al menos un archivo nuevo de evidencia para enviar a revisión.');
      }
      await tx.requestEvent.create({ data: {
        requestId: current.id, version: version + 1, action: next.action, status: next.status,
        actorRole: admin ? RequestActor.ADMIN : RequestActor.CITIZEN,
        actorId: admin ? req.administrator!.id : req.citizen!.id,
        note: admin ? note || null : null,
      } });
      return tx.serviceRequest.findUniqueOrThrow({ where: { id: current.id }, include });
    });
    res.json({ request: withFee(request) });
  };
}

export const citizenRequests: Router = Router();
citizenRequests.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
citizenRequests.use(requireAuth);
citizenRequests.get('/', list(false));
citizenRequests.get('/overview', overview(false));
citizenRequests.get('/:id', detail(false));
citizenRequests.post('/', async (req: AuthRequest, res) => {
  const body = bodyObject(req.body);
  const service = body.service as ServiceType;
  if (!Object.values(ServiceType).includes(service)) throw new RequestError(400, 'Tipo de trámite inválido.');
  const citizenId = req.citizen!.id;
  const request = await prisma.serviceRequest.create({
    data: {
      ...draftFields(body, service), citizenId, service,
      history: { create: {
        version: 1, action: RequestAction.CREACION_BORRADOR, status: RequestStatus.BORRADOR,
        actorRole: RequestActor.CITIZEN, actorId: citizenId,
      } },
    },
    include,
  });
  res.status(201).json({ request: withFee(request) });
});
citizenRequests.patch('/:id', mutate('edit'));
citizenRequests.post('/:id/submit', mutate('submit'));
citizenRequests.post('/:id/submit-evidence', mutate('submit-evidence'));
citizenRequests.post('/:id/simulate-payment', mutate('simulate-payment'));
citizenRequests.get('/:id/receipt', receipt(false));
citizenRequests.get('/:id/attachments/:attachmentId', download(false));
citizenRequests.post('/:id/attachments', raw({ type: 'application/octet-stream', limit: maxUploadBytes, inflate: false }), mutate('add-file'));
citizenRequests.delete('/:id/attachments/:attachmentId', mutate('remove-file'));

export const adminRequests: Router = Router();
adminRequests.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
adminRequests.use(requireAdmin);
adminRequests.get('/', list(true));
adminRequests.get('/overview', overview(true));
adminRequests.get('/:id', detail(true));
adminRequests.post('/:id/correct', mutate('correct', true));
adminRequests.post('/:id/approve', mutate('approve', true));
adminRequests.post('/:id/specifications', mutate('specifications', true));
adminRequests.post('/:id/correct-evidence', mutate('correct-evidence', true));
adminRequests.post('/:id/approve-evidence', mutate('approve-evidence', true));
adminRequests.post('/:id/schedule-visit', mutate('schedule-visit', true));
adminRequests.post('/:id/visit-progress', mutate('visit-progress', true));
adminRequests.post('/:id/close-visit', mutate('close-visit', true));
adminRequests.get('/:id/receipt', receipt(true));
adminRequests.get('/:id/attachments/:attachmentId', download(true));
