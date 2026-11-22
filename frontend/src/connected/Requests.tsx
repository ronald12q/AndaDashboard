import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge, Card, Field, Heading, Notice, Select, Textarea } from '../components/ui'
import { act, create, detail, edit, statusLabels } from './api'
import type { Draft, RecordDetail, ServiceCode, Session } from './api'
import { RequestFiles, Specifications } from './Materials'
import { Payment, Visit } from './Fulfillment'
import type { Category } from './api'
import { downloadPdf } from '../data'
import { number, report, serviceName } from './presentation'

const empty: Draft = { nis: '', phone: '', address: '', reference: '', reason: '', mode: null }
const actions: Record<string, string> = {
  CREACION_BORRADOR: 'Borrador creado', EDICION: 'Datos actualizados', ENVIO: 'Solicitud enviada',
  REENVIO: 'Corrección reenviada', SOLICITUD_CORRECCION: 'Corrección solicitada', APROBACION_DATOS: 'Datos aprobados',
  ESPECIFICACIONES_ENVIADAS: 'Especificaciones enviadas', ADJUNTO_AGREGADO: 'Adjunto guardado',
  ADJUNTO_RETIRADO: 'Adjunto retirado', EVIDENCIA_ENVIADA: 'Evidencia enviada',
  CORRECCION_MATERIAL_SOLICITADA: 'Corrección de material solicitada', EVIDENCIA_APROBADA: 'Evidencia aprobada',
  PAGO_SIMULADO_REGISTRADO: 'Pago simulado registrado', VISITA_PROGRAMADA: 'Visita programada',
  AVANCE_VISITA: 'Avance de visita', SOLICITUD_FINALIZADA: 'Solicitud finalizada',
}
type Props = { session: Session; expired: () => void }

function Fields({ draft, service }: { draft: Draft; service: ServiceCode }) {
  return <div className="form-grid">
    <Field label="NIS / cuenta del servicio" name="nis" defaultValue={draft.nis} maxLength={40} />
    {service === 'DESCONEXION' && <Select label="Modalidad" name="mode" defaultValue={draft.mode ?? ''}><option value="">Por definir</option><option value="TEMPORAL">Temporal</option><option value="DEFINITIVA">Definitiva</option></Select>}
    <Field label="Teléfono de contacto ficticio" name="phone" type="tel" defaultValue={draft.phone} maxLength={25} />
    <div className="full"><Field label="Dirección del inmueble ficticio" name="address" defaultValue={draft.address} maxLength={300} /></div>
    <div className="full"><Field label="Referencias para ubicar el inmueble" name="reference" defaultValue={draft.reference} maxLength={300} /></div>
    <div className="full"><Textarea label={service === 'DESCONEXION' ? 'Justificación' : 'Motivo de la solicitud'} name="reason" defaultValue={draft.reason} maxLength={1200} /></div>
  </div>
}
function readDraft(form: HTMLFormElement): Draft {
  const data = new FormData(form)
  const value = (field: keyof Draft) => String(data.get(field) ?? '').trim()
  return { nis: value('nis'), phone: value('phone'), address: value('address'), reference: value('reference'), reason: value('reason'), mode: value('mode') || null }
}
function payload(draft: Draft, service: ServiceCode) {
  const { mode, ...fields } = draft
  return service === 'DESCONEXION' ? { ...fields, mode } : fields
}

export function NewRequest({ service, session, expired }: Props & { service: ServiceCode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const draft = readDraft(event.currentTarget)
    setBusy(true); setError('')
    try {
      const { request } = await create(session, { ...payload(draft, service), service })
      if (window.location.hash.startsWith('#/crear/')) window.location.hash = `/solicitud/${request.id}`
    } catch (error) { report(error, expired, setError) }
    finally { setBusy(false) }
  }
  return <><Heading title={service === 'DESCONEXION' ? 'Solicitar desconexión' : 'Crear solicitud'} subtitle={service === 'DESCONEXION' ? 'Selecciona la modalidad y prepara la documentación correspondiente.' : `${serviceName(service)} · datos del servicio`} />
    <form onSubmit={save}><Card><fieldset disabled={busy}><Fields draft={empty} service={service} /></fieldset>
      {service === 'DESCONEXION' ? <Notice>Guarda el borrador para adjuntar identificación, escritura y carta justificativa. Solo usa documentos ficticios.</Notice> : <p className="blue-text connected-form-hint">El personal revisará manualmente los datos de la cuenta. Guarda el borrador para continuar.</p>}</Card>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><a href="#/catalogo">Volver al catálogo</a><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar borrador'}</button></div>
    </form>
  </>
}

export function RequestPage({ id, stage, session, expired }: Props & { id: string; stage?: string }) {
  const [record, setRecord] = useState<RecordDetail>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    detail(session, id, controller.signal).then(result => setRecord(result.request)).catch(error => {
      if (!controller.signal.aborted) report(error, expired, setError)
    })
    return () => controller.abort()
  }, [session, id, expired, reload])
  function refresh() { setRecord(undefined); setDirty(false); setError(''); setNotice(''); setReload(value => value + 1) }
  async function apply(operation: () => Promise<{ request: RecordDetail }>, confirmation: string) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      setRecord((await operation()).request)
      setDirty(false); setNotice(confirmation)
    } catch (error) { report(error, expired, setError) }
    finally { setBusy(false) }
  }
  const feedback = <>{error && <><p role="alert" className="error">{error}</p><button className="button secondary" disabled={busy} onClick={refresh}>Recargar expediente</button></>}{notice && <p role="status" className="notice">{notice}</p>}</>
  if (!record) return <><Heading title="Solicitud" />{error ? feedback : <p role="status">Cargando expediente…</p>}<a href="#/solicitudes">Volver a solicitudes</a></>
  const admin = session.role === 'admin'
  const editable = !admin && ['BORRADOR', 'CORRECCION_DATOS'].includes(record.status)
  const observationAction = record.status === 'CORRECCION_DATOS' ? 'SOLICITUD_CORRECCION' : record.status === 'CORRECCION_MATERIAL' ? 'CORRECCION_MATERIAL_SOLICITADA' : null
  const observation = record.history.findLast(event => event.action === observationAction)?.note
  const evidence = !admin && ['PENDIENTE_MATERIAL', 'CORRECCION_MATERIAL'].includes(record.status)
  const evidenceReview = admin && record.status === 'REVISION_MATERIAL'
  const allowed: Category[] = editable && record.service === 'DESCONEXION' ? ['IDENTIFICACION', 'ESCRITURA', 'CARTA', 'REPRESENTACION'] : evidence ? ['EVIDENCIA'] : []
  const materials = { session, record, busy, apply }
  const url = `#/solicitud/${record.id}`
  const payment = record.status === 'HABILITADA_PAGO' || !!record.paidAt
  const material = admin && (record.status === 'PENDIENTE_ESPECIFICACIONES' || !!record.specification)
  const stageLinks = [[url, 'Expediente'], ...(material ? [[`${url}/material`, 'Material']] : []),
    ...(!admin && record.specification ? [[`${url}/evidencia`, 'Evidencia']] : []),
    ...(!admin && payment ? [[`${url}/pago`, 'Pago simulado']] : []),
    ...(admin && record.paidAt ? [[`${url}/visita`, 'Visita técnica']] : []), [`${url}/seguimiento`, 'Seguimiento']]
  const nav = <nav className="connected-stage-links" aria-label="Etapas de la solicitud">{stageLinks.map(([href, label]) =>
    <a key={href} className="badge" href={href} aria-current={href === (stage ? `${url}/${stage}` : url) ? 'page' : undefined}>{label}</a>)}</nav>
  const observationNotice = observation && <Notice warning><strong>Observación del administrador</strong><p>{observation}</p></Notice>
  const history = <Card><h2>Historial de la solicitud</h2><ol className="timeline">
    {record.history.map(event => <li key={event.version}><strong>{actions[event.action] ?? event.action}</strong>{event.note && <p>{event.note}</p>}<small>{new Date(event.createdAt).toLocaleString('es-SV')} · {event.actorRole === 'ADMIN' ? 'Administración' : 'Ciudadano'}</small></li>)}
  </ol></Card>
  const reviewPanel = <Card><h2>{evidenceReview ? 'Revisión preliminar de evidencia' : 'Resultado de consulta manual'}</h2>
    <p>{evidenceReview ? 'Revisa los adjuntos de prueba. La aprobación no sustituye la comprobación en domicilio.' : 'No hay consulta automática del NIS. Registra únicamente una revisión ficticia.'}</p>
    <form key={record.version} onSubmit={event => {
      event.preventDefault()
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      const action = submitter?.value
      if (action !== 'correct' && action !== 'approve') return
      const note = String(new FormData(event.currentTarget).get('note') ?? '').trim()
      if (action === 'correct' && !note) { setError('Indica qué debe corregir el ciudadano.'); return }
      const workflowAction = evidenceReview ? action === 'correct' ? 'correct-evidence' : 'approve-evidence' : action
      void apply(() => act(session, record, workflowAction, note), action === 'correct' ? 'Corrección solicitada.' : evidenceReview ? 'Evidencia aprobada.' : 'Datos aprobados.')
    }}><Textarea label="Observaciones" name="note" maxLength={1200} disabled={busy} />
      <div className="actions"><button className="button secondary" value="correct" disabled={busy}>Solicitar corrección</button><button className="button" value="approve" disabled={busy}>{evidenceReview ? 'Aprobar evidencia' : 'Aprobar datos'}</button></div>
    </form>
  </Card>
  const title = (text: string) => <Heading title={`${text} · ${number(record)}`} subtitle={serviceName(record.service)} action={<Badge>{statusLabels[record.status]}</Badge>} />
  if (stage === 'pago' && !admin && payment) return <>{title('Pago del servicio')}{nav}{feedback}<Payment {...materials} detailed /></>
  if (stage === 'visita' && admin && record.paidAt) return <>{title('Visita técnica')}{nav}{feedback}<Visit key={record.version} {...materials} detailed /></>
  if (stage === 'seguimiento') return <>{title('Seguimiento')}{nav}{feedback}<div className="columns wide-left">{history}
    {record.paidAt ? <div><Visit key={record.version} {...materials} detailed readOnly />{!admin && <a className="button secondary connected-receipt-link" href={`${url}/pago`}>Ver comprobante</a>}</div> : <Card><h2>Próxima visita</h2><p>Todavía no hay una visita programada para esta solicitud.</p></Card>}
  </div></>
  if (stage === 'evidencia' && !admin && record.specification) return <>{title(evidence ? 'Envía la evidencia del material' : 'Evidencia del material')}{nav}{observationNotice}{feedback}
    <RequestFiles {...materials} allowed={allowed} blocked={false} detailed />
    <Notice>La revisión de evidencia es preliminar. La pieza se comprueba físicamente en el domicilio.</Notice>
    {evidence && <div className="actions"><a href={url}>Volver al expediente</a><button className="button" disabled={busy} onClick={() => void apply(() => act(session, record, 'submit-evidence'), 'Evidencia enviada a revisión.')}>Enviar evidencia a revisión</button></div>}
  </>
  if (stage === 'material' && material) return <>{title('Material')}{nav}{observationNotice}{feedback}
    <div className="columns"><Specifications {...materials} /><div>
      {evidenceReview && reviewPanel}
      {record.attachments.length > 0 ? <RequestFiles {...materials} allowed={[]} blocked={false} /> :
        <Card><h2>Evidencia del ciudadano</h2><div className="evidence-placeholder">Todavía no hay archivos adjuntos.</div>
          <p>El ciudadano podrá aportar evidencia después de recibir las especificaciones.</p></Card>}
      {!evidenceReview && <Notice>La conformidad se verifica durante la visita.</Notice>}
    </div></div>
  </>
  return <>
    {title(admin ? 'Revisar solicitud' : 'Tu solicitud')}{nav}
    {observationNotice}
    {feedback}
    {editable ? <>
      <form key={record.version} onChange={() => setDirty(true)} onSubmit={event => {
        event.preventDefault()
        const fields = payload(readDraft(event.currentTarget), record.service)
        void apply(() => edit(session, id, record.version, fields), 'Datos guardados.')
      }}><Card><fieldset disabled={busy}><Fields draft={record} service={record.service} /></fieldset></Card>
        <div className="actions"><button className="button secondary" disabled={busy || !dirty}>Guardar cambios</button>
          <button className="button" type="button" disabled={busy || dirty}
            onClick={() => void apply(() => act(session, record, 'submit'), 'Solicitud enviada a revisión.')}>
            {record.status === 'BORRADOR' ? 'Enviar solicitud' : 'Enviar corrección'}
          </button></div>
      </form>
      {dirty && <p role="status">Guarda los cambios antes de enviar.</p>}
      {record.service === 'DESCONEXION' && <Notice>Selecciona la modalidad y adjunta identificación, escritura y carta justificativa antes de enviar. La representación se adjunta si corresponde.</Notice>}
    </> : <div className={admin ? 'columns' : 'columns wide-left'}>
      {!admin && record.specification ? <Card><h2>Especificaciones para tu cuenta de prueba</h2>
        {record.diameter && <p><strong>Diámetro:</strong> {record.diameter === 'MEDIA_PULGADA' ? '½ pulgada' : '¾ de pulgada'}</p>}
        <p className="connected-specification">{record.specification}</p>
        <button className="button secondary" onClick={() => downloadPdf(`Ficha-DEMO-${number(record)}.pdf`, [
          'FICHA DE COMPRA DEMO - NO ES AUTORIZACION INSTITUCIONAL', number(record), serviceName(record.service),
          record.diameter ? `Diametro: ${record.diameter === 'MEDIA_PULGADA' ? '1/2' : '3/4'} pulgada` : 'Compatibilidad segun esta solicitud',
          ...(record.specification?.match(/.{1,75}/g) ?? []), 'Revision fotografica preliminar. Verificacion fisica en domicilio.',
        ])}>Descargar ficha de compra</button><Notice>La compra y la entrega en domicilio forman parte de la propuesta académica.</Notice>
      </Card> : <Card className="review-data"><h2>Datos presentados</h2><dl>
        <dt>NIS</dt><dd>{record.nis || '—'}</dd><dt>Dirección</dt><dd>{record.address || '—'}</dd>
        <dt>Teléfono</dt><dd>{record.phone || '—'}</dd><dt>Referencias</dt><dd>{record.reference || '—'}</dd>
        <dt>Motivo</dt><dd>{record.reason || '—'}</dd>{record.mode && <><dt>Modalidad</dt><dd>{record.mode}</dd></>}
      </dl></Card>}
      {admin && record.status === 'EN_REVISION' ? reviewPanel :
      <Card className="next-step"><h2>Siguiente paso</h2><p>{
        record.status === 'CORRECCION_DATOS' ? 'Esperando que el ciudadano corrija y reenvíe la solicitud.' :
          record.status === 'EN_REVISION' ? 'El administrador revisará los datos de la solicitud.' :
            record.status === 'PENDIENTE_ESPECIFICACIONES' ? 'Datos aprobados. Espera las especificaciones antes de comprar.' :
              record.status === 'PENDIENTE_MATERIAL' ? 'El ciudadano debe aportar evidencia del material según las especificaciones.' :
                record.status === 'CORRECCION_MATERIAL' ? 'Se necesita un archivo de evidencia nuevo para retomar la revisión.' :
                  record.status === 'REVISION_MATERIAL' ? 'La evidencia está en revisión preliminar.' :
                    record.status === 'FINALIZADA' ? 'El expediente se cerró. Consulta el resultado de la visita.' :
                      record.paidAt ? 'Pago simulado registrado. Consulta la coordinación y el avance de la visita.' :
                        'Revisión completa. El pago simulado ya está habilitado.'
      }</p>
        {evidence && <a className="button" href={`${url}/evidencia`}>{record.status === 'CORRECCION_MATERIAL' ? 'Corregir evidencia' : 'Ya compré el material'}</a>}
        {!admin && payment && !record.paidAt && <a className="button" href={`${url}/pago`}>Ir al pago simulado</a>}
        {material && !record.paidAt && <a className="button" href={`${url}/material`}>Especificaciones y evidencia</a>}
        {admin && record.paidAt && <a className="button" href={`${url}/visita`}>Gestionar visita</a>}
        {!admin && record.paidAt && <a className="button" href={`${url}/seguimiento`}>Ver seguimiento</a>}
      </Card>}
    </div>}
    {record.service === 'DESCONEXION' && <RequestFiles {...materials} allowed={allowed} blocked={dirty} />}
    <a href="#/solicitudes">Volver a solicitudes</a>
  </>
}
