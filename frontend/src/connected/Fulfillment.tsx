import { useState } from 'react'
import { Card, Field, Notice, Select, Textarea } from '../components/ui'
import { money } from '../data'
import { fulfillment, receipt } from './api'
import type { PhysicalCheck, RecordDetail, Session } from './api'
import type { Apply } from './Materials'

type Props = { session: Session; record: RecordDetail; busy: boolean; apply: Apply }
const physicalLabels: Record<PhysicalCheck, string> = {
  PENDIENTE: 'Pendiente de comprobación',
  COMPATIBLE: 'Compatible, comprobado en domicilio',
  REQUIERE_SUSTITUCION: 'Requiere sustitución',
}
// El Salvador uses UTC−06:00 year-round. Input is always in service-local time.
const toInput = (value: string | null) => value ? new Date(new Date(value).getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 16) : ''
const format = (value: string) => new Date(value).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })

export function Payment({ session, record, busy, apply, detailed = false }: Props & { detailed?: boolean }) {
  if (!record.paidAt && record.status !== 'HABILITADA_PAGO') return null
  const receiptButton = <button className="button secondary" disabled={busy} onClick={() => void apply(async () => {
    await receipt(session, record)
    return { request: record }
  }, 'Descarga del comprobante iniciada.')}>Descargar comprobante simulado</button>
  const panel = <Card className={detailed ? '' : 'connected-history'}><h2>{detailed ? 'Datos de pago de prueba' : 'Pago simulado'}</h2>
    {!detailed && <p><strong>Importe de referencia con IVA:</strong> {money(record.simulatedFeeCents / 100)}</p>}
    <Notice warning>No hay cargos reales. No se solicitan ni procesan datos de tarjetas.</Notice>
    {detailed && <dl className="connected-visit-summary"><dt>Tipo de operación</dt><dd>Simulación académica</dd><dt>Referencia</dt><dd>{`SOL-${String(record.number).padStart(6, '0')}`}</dd></dl>}
    {record.paidAt ? <>
      <p>Registrado el {format(record.paidAt)}. El comprobante no tiene validez fiscal.</p>
      {!detailed && receiptButton}
    </> : session.role === 'citizen' ? <button className="button" disabled={busy}
      onClick={() => void apply(() => fulfillment(session, record, 'simulate-payment'), 'Pago simulado registrado, sin cargos reales.')}>Simular pago</button> :
      <p>En espera de que el ciudadano registre el pago de prueba.</p>}
  </Card>
  return detailed ? <div className="columns wide-left">{panel}<Card className="price-card"><h2>Resumen</h2><p>Total de referencia con IVA</p><strong className="price">{money(record.simulatedFeeCents / 100)}</strong><p>Comprobante de simulación sin validez fiscal.</p>{record.paidAt && receiptButton}</Card></div> : panel
}

export function Visit({ session, record, busy, apply, detailed = false, readOnly = false }: Props & { detailed?: boolean; readOnly?: boolean }) {
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  if (!record.paidAt) return null
  const admin = session.role === 'admin' && !readOnly
  const material = ['MEDIDOR', 'CAJA', 'VALVULA'].includes(record.service)
  const replacement = record.physical === 'REQUIERE_SUSTITUCION'
  const canSchedule = admin && (['PAGO_REGISTRADO', 'VISITA_PROGRAMADA'].includes(record.status) || (record.status === 'EN_EJECUCION' && replacement))
  const canProgress = admin && ['VISITA_PROGRAMADA', 'EN_EJECUCION'].includes(record.status)
  const canClose = record.status === 'EN_EJECUCION' && !dirty && !!record.result && (!material || record.physical === 'COMPATIBLE')
  return <Card className={detailed ? '' : 'connected-history'}><h2>{record.status === 'FINALIZADA' ? 'Resultado de la visita' : admin ? 'Gestión de visita' : detailed ? 'Próxima visita' : 'Seguimiento de la visita'}</h2>
    {record.visitDate ? <dl className="connected-visit-summary">
      <dt>Fecha tentativa (El Salvador)</dt><dd>{format(record.visitDate)}</dd>
      <dt>Coordinación</dt><dd>{record.coordination}</dd>
      {record.physical && <><dt>Comprobación física</dt><dd>{physicalLabels[record.physical]}</dd></>}
      {record.result && <><dt>Resultado guardado</dt><dd>{record.result}</dd></>}
      {record.completedAt && <><dt>Fecha de cierre</dt><dd>{format(record.completedAt)}</dd></>}
    </dl> : <p>La visita está pendiente de coordinación.</p>}
    {material && record.status !== 'FINALIZADA' && <p>La pieza se entrega al técnico en domicilio como propuesta académica. Debe comprobarse físicamente antes de instalarla.</p>}
    {replacement && <Notice warning>Se requiere sustituir el material y coordinar otra comprobación en domicilio. Se conserva el pago simulado; no se cobra de nuevo.</Notice>}
    {error && <p role="alert" className="error">{error}</p>}
    {canSchedule && <form onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      const value = String(fields.get('date') ?? '')
      const date = new Date(`${value}:00-06:00`)
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
        setError('Indica una fecha y hora válidas.'); return
      }
      setError('')
      void apply(() => fulfillment(session, record, 'schedule-visit', { visitDate: date.toISOString(), coordination: String(fields.get('coordination') ?? '') }), 'Visita programada.')
    }}><fieldset disabled={busy || dirty} className="form-grid">
      <Field label="Fecha y hora tentativa (El Salvador)" name="date" type="datetime-local" defaultValue={toInput(record.visitDate)} required />
      <Textarea label="Coordinación con el ciudadano" name="coordination" defaultValue={record.coordination ?? ''} maxLength={600} required />
      <div className="full"><button className="button secondary">{record.visitDate ? 'Reprogramar visita' : 'Programar visita'}</button></div>
    </fieldset></form>}
    {canProgress && <form className="connected-history" onChange={() => setDirty(true)} onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      void apply(() => fulfillment(session, record, 'visit-progress', {
        physical: material ? String(fields.get('physical') ?? '') : undefined, result: String(fields.get('result') ?? ''),
      }), 'Avance de visita guardado.')
    }}><fieldset disabled={busy} className="form-grid">
      {material && <Select label="Comprobación física del material" name="physical" defaultValue={record.physical ?? 'PENDIENTE'}>
        {Object.entries(physicalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>}
      <Textarea label="Resultado del trabajo" name="result" defaultValue={record.result ?? ''} maxLength={1200} />
      <div className="full"><button className="button secondary">Guardar avance</button></div>
    </fieldset></form>}
    {admin && record.status === 'EN_EJECUCION' && <>
      {!canClose && <p>Guarda el resultado y, si aplica, confirma la compatibilidad física antes de finalizar.</p>}
      <button className="button" disabled={busy || !canClose} onClick={() => void apply(() => fulfillment(session, record, 'close-visit'), 'Solicitud finalizada.')}>Finalizar solicitud</button>
    </>}
  </Card>
}
