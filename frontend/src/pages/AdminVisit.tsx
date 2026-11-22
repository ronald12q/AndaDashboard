import { useState } from 'react'
import type { Request, UpdateRequest } from '../data'
import { serviceFor } from '../data'
import { Card, Field, Heading, Notice, Select, Textarea } from '../components/ui'
import { canManageVisit, validateVisit } from '../visit'

export function AdminVisit({ request: r, update }: { request: Request; update: UpdateRequest }) {
  const [date, setDate] = useState(r.visitDate)
  const [status, setStatus] = useState(r.status === 'En ejecución' ? 'En ejecución' : 'Visita programada')
  const [coordination, setCoordination] = useState(r.coordination)
  const [physical, setPhysical] = useState(r.physical)
  const [result, setResult] = useState(r.result)
  const [error, setError] = useState('')
  const material = serviceFor(r.service).material
  const editable = canManageVisit(r)
  function save(close: boolean) {
    if (!editable) return
    const validation = validateVisit(r, { visitDate: date, coordination, physical, result }, close)
    if (validation) { setError(validation); return }
    const next = close ? 'Finalizada' : status === 'En ejecución' ? 'En ejecución' : 'Visita programada'
    update(r.id, { visitDate: date, coordination, physical: material ? physical : 'No aplica', result, status: next }, close ? 'Solicitud finalizada' : next, `${coordination}. ${result || 'Pendiente de ejecución'}. Responsable: Administrador demo.`)
    setError('')
  }
  return <><Heading title={`Visita técnica · ${r.id}`} subtitle="Registra coordinación, ejecución y resultado del servicio." />
    {!editable && <Notice>{r.status === 'Finalizada' ? 'Expediente finalizado. El cierre y sus observaciones están disponibles en el historial.' : 'La visita solo se puede programar después del pago simulado.'}</Notice>}
    <form onSubmit={e => { e.preventDefault(); save(false) }}><Card><div className="form-grid">
      <Field label="Fecha y hora tentativa" type="datetime-local" value={date} required disabled={!editable} onChange={e => setDate(e.target.value)} />
      <Select label="Estado" value={r.status === 'Finalizada' ? 'Finalizada' : status} disabled={!editable} onChange={e => setStatus(e.target.value)}><option value="Visita programada">Programada</option><option>En ejecución</option>{r.status === 'Finalizada' && <option>Finalizada</option>}</Select>
      <div className="full"><Textarea label="Coordinación con el usuario" required value={coordination} disabled={!editable} onChange={e => setCoordination(e.target.value)} placeholder="Contacto y disponibilidad registrados" /></div>
      {material && <div className="full"><Select label="Verificación física del material" value={physical} disabled={!editable} onChange={e => setPhysical(e.target.value)}><option>Pendiente de comprobación</option><option>Compatible, comprobado en domicilio</option><option>Requiere sustitución</option></Select></div>}
      <div className="full"><Textarea label="Resultado del trabajo" value={result} disabled={!editable} onChange={e => setResult(e.target.value)} placeholder="Instalación realizada o motivo de pendiente" /></div>
    </div><p>El cierre registra fecha, responsable y observaciones en el historial. {material && 'El material se entrega al técnico en el domicilio como propuesta académica.'}</p>
    {material && physical === 'Requiere sustitución' && <Notice warning>La instalación queda pendiente. Registra el motivo en el resultado y coordina con el ciudadano la sustitución y una nueva comprobación física. Guarda el avance sin finalizar. El pago simulado ya registrado se conserva; esta demo no aplica nuevos cargos ni resuelve devoluciones.</Notice>}
    {error && <p className="error" role="alert">{error}</p>}</Card><div className="actions"><button className="button secondary" disabled={!editable}>Guardar avance</button><button type="button" className="button" disabled={!editable} onClick={() => save(true)}>Finalizar solicitud</button></div></form><a href={`#/historial/${r.id}`}>Ver historial del expediente</a>
  </>
}
