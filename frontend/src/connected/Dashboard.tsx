import { useEffect, useState } from 'react'
import { Card, Field, Heading, Select } from '../components/ui'
import { services } from '../data'
import { list, overview, serviceCodes, statusLabels } from './api'
import type { Filters, RecordSummary, Session, Status } from './api'
import { number, report, serviceName } from './presentation'

type Props = { session: Session; expired: () => void }

function Table({ items, admin, view }: { items: RecordSummary[]; admin: boolean; view?: 'reviews' | 'visits' }) {
  const label = !admin ? 'Ver detalle' : view === 'visits' ? 'Gestionar visita' : 'Revisar'
  return <div className="table-scroll"><table><caption className="sr-only">Expedientes del portal</caption>
    <thead><tr><th>Solicitud</th><th>Trámite</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {items.map(record => <tr key={record.id}>
        <td>{number(record)}</td><td>{serviceName(record.service)}</td><td>{statusLabels[record.status]}</td>
        <td><a href={`#/solicitud/${record.id}${view === 'visits' ? '/visita' : ''}`}>{label}<span className="sr-only"> {number(record)}</span></a></td>
      </tr>)}
      {!items.length && <tr><td colSpan={4}>No hay solicitudes en esta página.</td></tr>}
    </tbody></table></div>
}

function Overview({ session, expired }: Props) {
  const [data, setData] = useState<Awaited<ReturnType<typeof overview>>>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    overview(session, controller.signal).then(setData).catch(error => {
      if (!controller.signal.aborted) report(error, expired, setError)
    })
    return () => controller.abort()
  }, [session, expired, retry])
  if (error) return <div><p role="alert" className="error">{error}</p><button className="button secondary" onClick={() => { setError(''); setRetry(value => value + 1) }}>Reintentar resumen</button></div>
  if (!data) return <p role="status">Cargando resumen…</p>
  const admin = session.role === 'admin'
  const count = (...statuses: Status[]) => statuses.reduce((total, status) => total + (data.counts[status] ?? 0), 0)
  const metrics: [string, number][] = admin ? [
    ['En revisión', count('EN_REVISION')],
    ['Evidencia pendiente', count('PENDIENTE_MATERIAL', 'REVISION_MATERIAL', 'CORRECCION_MATERIAL')],
    ['Visitas por coordinar', count('PAGO_REGISTRADO')],
  ] : [
    ['Solicitudes activas', Object.values(data.counts).reduce((sum, value) => sum + value, 0) - count('BORRADOR', 'FINALIZADA')],
    ['Requiere tu atención', count('CORRECCION_DATOS', 'PENDIENTE_MATERIAL', 'CORRECCION_MATERIAL', 'HABILITADA_PAGO')],
    ['Finalizadas', count('FINALIZADA')],
  ]
  return <>
    <div className="stats">{metrics.map(([label, total]) => <Card key={label}><p>{label}</p><strong>{String(total).padStart(2, '0')}</strong></Card>)}</div>
    {!admin && <><h2 className="section-heading">Solicitudes recientes</h2><Table items={data.recent} admin={false} /></>}
  </>
}

export function Home({ session, expired }: Props) {
  return <><Heading title={`Hola, ${session.account.name.toLocaleLowerCase('es')}`} subtitle="Aquí puedes iniciar un trámite o consultar tus solicitudes." action={<a className="button" href="#/catalogo">Nuevo trámite</a>} /><Overview session={session} expired={expired} /></>
}

export function RequestList({ session, expired, view }: Props & { view?: 'reviews' | 'visits' }) {
  const [cursors, setCursors] = useState<(number | null)[]>([null])
  const [filters, setFilters] = useState<Filters>({})
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<{ items: RecordSummary[]; nextBefore: number | null }>()
  const [error, setError] = useState('')
  const before = cursors.at(-1) ?? null
  useEffect(() => {
    const controller = new AbortController()
    list(session, before, controller.signal, { ...filters, queue: view }).then(setResult).catch(error => {
      if (!controller.signal.aborted) report(error, expired, setError)
    })
    return () => controller.abort()
  }, [session, expired, before, refresh, filters, view])
  function change(next: (number | null)[]) { setError(''); setResult(undefined); setCursors(next); setRefresh(value => value + 1) }
  const admin = session.role === 'admin'
  const title = admin ? view === 'reviews' ? 'Revisiones pendientes' : view === 'visits' ? 'Visitas técnicas' : 'Solicitudes recibidas' : 'Mis solicitudes'
  return <>
    <Heading title={title} subtitle={admin ? 'Gestiona la revisión y el avance de los expedientes de prueba.' : 'Consulta los expedientes y sus próximos pasos.'} action={!admin && <a className="button" href="#/catalogo">Nuevo trámite</a>} />
    {admin && !view && <Overview session={session} expired={expired} />}
    <form className="filters connected-filters" onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      const value = (key: string) => String(fields.get(key) ?? '').trim()
      setFilters({ query: value('query'), service: value('service'), status: value('status'), date: value('date') })
      change([null])
    }} onReset={() => { setFilters({}); change([null]) }}>
      <Field label="Buscar" name="query" type="search" maxLength={80} placeholder="NIS o número de solicitud" />
      <Select label="Trámite" name="service"><option value="">Todos los trámites</option>{services.map(service => <option key={service.id} value={serviceCodes[service.id as keyof typeof serviceCodes]}>{service.name}</option>)}</Select>
      <Select label="Estado" name="status"><option value="">Todos los estados</option>{Object.entries(statusLabels).filter(([status]) => !admin || status !== 'BORRADOR').map(([status, label]) => <option key={status} value={status}>{label}</option>)}</Select>
      <Field label="Fecha de registro" name="date" type="date" />
      <div className="connected-filter-actions"><button className="button" type="submit">Aplicar filtros</button><button className="text-button" type="reset">Limpiar</button></div>
    </form>
    {error ? <><p role="alert" className="error">{error}</p><button className="button secondary" onClick={() => change(cursors)}>Reintentar</button></> :
      !result ? <p role="status">Cargando solicitudes…</p> :
        <Table items={result.items} admin={admin} view={view} />}
    <div className="actions">{cursors.length > 1 && <button className="button secondary" onClick={() => change(cursors.slice(0, -1))}>Anterior</button>}{result?.nextBefore && <button className="button secondary" onClick={() => change([...cursors, result.nextBefore])}>Siguiente</button>}</div>
  </>
}
