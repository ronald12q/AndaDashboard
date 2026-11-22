import { useState } from 'react'
import type { Request, UpdateRequest } from '../data'
import { serviceFor } from '../data'
import { Card, Field, FilesList, Heading, History, Notice, Select, Textarea } from '../components/ui'

export function AdminMaterial({ request: r, update, historyOnly = false }: { request: Request; update: UpdateRequest; historyOnly?: boolean }) {
  const [tab, setTab] = useState(historyOnly || !serviceFor(r.service).material ? 'Historial' : 'Especificaciones')
  const [diameter, setDiameter] = useState(r.diameter || '½ pulgada')
  const [specification, setSpecification] = useState(r.specification)
  const [observation, setObservation] = useState('')
  const [error, setError] = useState('')
  const s = serviceFor(r.service)
  const canSpec = s.material && r.verified && ['Pendiente de especificaciones', 'Pendiente de material', 'Requiere corrección'].includes(r.status)
  const canReview = r.status === 'Revisión de material' && r.verified && r.files.some(f => f.category === 'Evidencia')
  return <><Heading title={`${s.material ? 'Material' : 'Expediente'} · ${r.id}`} subtitle="Indica las especificaciones y revisa la evidencia recibida." /><div className="tabs" role="tablist" aria-label="Secciones del expediente">{(s.material ? ['Especificaciones', 'Evidencia', 'Historial'] : ['Historial']).map(t => <button role="tab" id={`tab-${t}`} aria-controls="admin-panel" aria-selected={tab === t} key={t} className={`badge ${tab === t ? 'selected' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
    <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
    {tab === 'Historial' || !s.material ? <Card><h2>Historial del expediente</h2><History request={r} /></Card> : <div className={`columns ${tab === 'Evidencia' ? 'evidence-focus' : ''}`}>
      {tab === 'Especificaciones' && <Card><form onSubmit={e => { e.preventDefault(); if (!canSpec) return; update(r.id, { diameter: s.id === 'caja' ? '' : diameter, specification: specification.trim(), status: 'Pendiente de material', observation: '' }, 'Especificaciones enviadas', 'Ficha de compra demo disponible; entrega del material en domicilio.'); setError('') }}>
        <Field label="Pieza requerida" value={s.piece} readOnly />
        {s.id !== 'caja' ? <Select label="Diámetro residencial confirmado por administrador" value={diameter} disabled={!canSpec} onChange={e => setDiameter(e.target.value)}><option>½ pulgada</option><option>¾ pulgada</option></Select> : <Notice>Confirma compatibilidad con el medidor de esta cuenta. No se indican dimensiones genéricas de cajas.</Notice>}
        <Textarea label="Características y ficha de referencia" required minLength={10} disabled={!canSpec} value={specification} onChange={e => setSpecification(e.target.value)} placeholder={s.id === 'caja' ? 'Compatibilidad y características determinadas para este servicio de prueba.' : 'Material, compatibilidad y características de referencia para esta cuenta.'} />
        <Notice>Residencial únicamente. El ciudadano no debe conocer el diámetro antes de solicitar. La ficha es de prueba, no autorización de compra institucional.</Notice>
        <button className="button full-button" disabled={!canSpec}>Enviar especificaciones</button>
        {!canSpec && <p role="status">La cuenta debe estar revisada y pendiente de especificaciones/material para editar esta ficha.</p>}
      </form></Card>}
      <Card><h2>Evidencia del ciudadano</h2><div className="evidence-placeholder">Archivos ficticios · solo metadatos disponibles</div><FilesList files={r.files} /><h3 className="blue-text">Revisión preliminar</h3><p>Verifica lo visible en la evidencia. La aceptación física corresponde a la visita en el domicilio. No equivale a aceptación definitiva.</p><Textarea label="Observación de la revisión de evidencia" value={observation} disabled={!canReview} onChange={e => setObservation(e.target.value)} placeholder="Ej.: el diámetro no se distingue; adjunta una foto más cercana del grabado." />
        {error && <p role="alert" className="error">{error}</p>}<div className="actions"><button className="button secondary" disabled={!canReview} onClick={() => { if (!observation.trim()) { setError('Describe la corrección requerida.'); return }; update(r.id, { status: 'Requiere corrección', observation }, 'Corrección de evidencia solicitada', observation); setError('') }}>Pedir corrección</button><button className="button" disabled={!canReview} onClick={() => { update(r.id, { status: 'Habilitada para pago', observation: '' }, 'Material revisado', 'Revisión fotográfica preliminar. La aceptación física sigue pendiente.'); setError('') }}>Habilitar pago</button></div>{!canReview && <p role="status">La revisión se habilita cuando el ciudadano envíe evidencia.</p>}
      </Card></div>}
    </div><div className="actions"><a href={`#/revision/${r.id}`}>Volver a revisión de cuenta</a>{r.paid && <a className="button" href={`#/visita/${r.id}`}>Gestionar visita</a>}</div></>
}
