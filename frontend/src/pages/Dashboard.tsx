import { useState } from 'react'
import { services, statuses } from '../data'
import type { Request, User } from '../data'
import { Card, Field, Heading, RequestsTable, Select } from '../components/ui'

export function Dashboard({ user, requests, page }: { user: User; requests: Request[]; page: string }) {
  const [query, setQuery] = useState('')
  const [service, setService] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const admin = user.role === 'admin'
  const reviewStatuses = ['En revisión', 'Corrección de datos', 'Pendiente de especificaciones', 'Pendiente de material', 'Revisión de material', 'Requiere corrección']
  const visitStatuses = ['Pago registrado', 'Visita programada', 'En ejecución', 'Finalizada']
  const scoped = requests.filter(r => admin || r.owner === user.id)
  const rows = scoped.filter(r => (page !== 'revisiones' || reviewStatuses.includes(r.status)) && (page !== 'visitas' || visitStatuses.includes(r.status))).filter(r => `${r.id} ${r.nis}`.toLowerCase().includes(query.toLowerCase()) && (!service || r.service === service) && (!status || r.status === status) && (!date || r.createdAt === date))
  const home = !admin && page === 'inicio'
  const title = home ? `Hola, ${user.name.toLowerCase()}` : admin ? page === 'revisiones' ? 'Revisiones pendientes' : page === 'visitas' ? 'Visitas técnicas' : 'Solicitudes recibidas' : 'Mis solicitudes'
  const metrics: [string, number][] = admin ? [
    ['En revisión', scoped.filter(r => r.status === 'En revisión').length],
    ['Evidencia pendiente', scoped.filter(r => ['Pendiente de material', 'Revisión de material', 'Requiere corrección'].includes(r.status)).length],
    ['Visitas por coordinar', scoped.filter(r => r.status === 'Pago registrado').length],
  ] : [
    ['Solicitudes activas', scoped.filter(r => !['Finalizada', 'Borrador'].includes(r.status)).length],
    ['Requiere tu atención', scoped.filter(r => ['Corrección de datos', 'Requiere corrección', 'Pendiente de material', 'Habilitada para pago'].includes(r.status)).length],
    ['Finalizadas', scoped.filter(r => r.status === 'Finalizada').length],
  ]
  return <><Heading title={title} subtitle={admin ? 'Gestiona la revisión y el avance de los expedientes de prueba.' : 'Aquí puedes iniciar un trámite o consultar tus solicitudes.'} action={!admin && <a className="button" href="#/catalogo">Nuevo trámite</a>} />
    {(home || admin && page === 'solicitudes') && <div className="stats">{metrics.map(([label, count]) => <Card key={label}><p>{label}</p><strong>{String(count).padStart(2, '0')}</strong></Card>)}</div>}
    {!home && <div className="filters"><Field label="Buscar" type="search" placeholder="NIS o número de solicitud" value={query} onChange={e => setQuery(e.target.value)} /><Select label="Trámite" value={service} onChange={e => setService(e.target.value)}><option value="">Todos los trámites</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Estado" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option>{statuses.map(s => <option key={s}>{s}</option>)}</Select><Field label="Fecha de registro" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>}
    {home && <h2 className="section-heading">Solicitudes recientes</h2>}
    <RequestsTable requests={home ? rows.filter(r => r.status !== 'Finalizada').slice(0, 3) : rows} admin={admin} visits={page === 'visitas'} />
    {!home && <p className="results-count" role="status">{rows.length} solicitud{rows.length !== 1 && 'es'} encontrada{rows.length !== 1 && 's'}. Todos los datos son ficticios.</p>}
  </>
}
