import { useState } from 'react'
import type { FormEvent } from 'react'
import { blankRequest, serviceFor } from '../data'
import type { Request } from '../data'
import { Card, Field, FilePicker, FilesList, Heading, Notice, Select, Textarea } from '../components/ui'

export function CreateRequest({ owner, serviceId, existing, save }: { owner: string; serviceId: string; existing?: Request; save: (request: Request) => void }) {
  const [form, setForm] = useState<Request>(() => existing ?? blankRequest(owner, serviceId))
  const [message, setMessage] = useState('')
  const service = serviceFor(form.service); const disconnect = service.id === 'desconexion'
  const edit = (patch: Partial<Request>) => setForm(f => ({ ...f, ...patch }))
  function submit(e: FormEvent) {
    e.preventDefault()
    if (disconnect && ['Identificación del solicitante', 'Escritura del inmueble', 'Carta justificativa'].some(c => !form.files.some(f => f.category === c))) { setMessage('Adjunta los tres documentos ficticios requeridos.'); return }
    save({ ...form, status: 'En revisión', observation: '' })
  }
  return <><Heading title={existing ? 'Actualizar solicitud' : disconnect ? 'Solicitar desconexión' : 'Crear solicitud'} subtitle={`${service.name} · datos del servicio de prueba`} />
    <form onSubmit={submit}><Card><div className="form-grid">
      <Field label="NIS / cuenta del servicio" value={form.nis} required maxLength={40} placeholder="NIS-DEMO-001" onChange={e => edit({ nis: e.target.value })} />
      {disconnect ? <Select label="Modalidad" value={form.mode} onChange={e => edit({ mode: e.target.value })}><option>Temporal</option><option>Definitiva</option></Select> : <Field label="Teléfono de contacto ficticio" type="tel" value={form.phone} required pattern="[0-9+ \(\)\-]{8,20}" placeholder="7000-0000" onChange={e => edit({ phone: e.target.value })} />}
      {disconnect && <Field label="Teléfono de contacto ficticio" type="tel" value={form.phone} required pattern="[0-9+ \(\)\-]{8,20}" placeholder="7000-0000" onChange={e => edit({ phone: e.target.value })} />}
      <div className="full"><Field label="Dirección del inmueble ficticio" value={form.address} required minLength={5} placeholder="Dirección ficticia del inmueble" onChange={e => edit({ address: e.target.value })} /></div>
      <div className="full"><Field label="Referencias para ubicar el inmueble" value={form.reference} placeholder="Puntos de referencia de prueba" onChange={e => edit({ reference: e.target.value })} /></div>
      <div className="full"><Textarea label={disconnect ? 'Justificación' : 'Motivo de la solicitud'} value={form.reason} required minLength={5} placeholder="Describe el motivo de prueba" onChange={e => edit({ reason: e.target.value })} /></div>
    </div>
    {disconnect && <div className="document-section"><h2>Documentos de prueba</h2>{['Identificación del solicitante', 'Escritura del inmueble', 'Carta justificativa', 'Representación (si aplica)'].map(category => <FilePicker key={category} category={category} files={form.files} onChange={files => edit({ files })} />)}<FilesList files={form.files} onRemove={i => edit({ files: form.files.filter((_, index) => i !== index) })} /></div>}
    <p className="blue-text">El personal revisará manualmente los datos de la cuenta. No hay consulta real de NIS.</p>
    {existing?.observation && <Notice warning><strong>Observación del administrador</strong><p>{existing.observation}</p></Notice>}
    {message && <p role="alert" className="error">{message}</p>}
    </Card><div className="actions"><button className="button secondary" type="button" onClick={() => save({ ...form, status: 'Borrador' })}>Guardar borrador</button><button className="button" type="submit">{existing && existing.status !== 'Borrador' ? 'Enviar corrección' : 'Enviar solicitud'}</button></div></form>
    {disconnect && <Notice>La facturación continúa hasta la ejecución en campo. La modalidad definitiva puede requerir presupuesto y permiso de rotura. Condiciones de referencia, no autorización institucional.</Notice>}
  </>
}
