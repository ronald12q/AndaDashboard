import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { demoUsers, now, readStored, seedRequests, services } from './data'
import type { Request, UpdateRequest, User } from './data'
import { Chat } from './components/Chat'
import { Heading, Notice } from './components/ui'
import { Auth } from './pages/Auth'
import { Catalog } from './pages/Catalog'
import { CreateRequest } from './pages/CreateRequest'
import { CitizenDetail } from './pages/CitizenDetail'
import { Dashboard } from './pages/Dashboard'
import { AdminReview } from './pages/AdminReview'
import { AdminMaterial } from './pages/AdminMaterial'
import { AdminVisit } from './pages/AdminVisit'
import { mergeCitizenEdit } from './requestEditing'

const DATA_KEY = 'anda-demo-requests-v1'
const USERS_KEY = 'anda-demo-users-v1'
const SESSION_KEY = 'anda-demo-session-v1'
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback) }
const snapshot = () => window.location.hash.slice(1) || '/login'

export default function App() {
  const route = useSyncExternalStore(subscribe, snapshot)
  const [users, setUsers] = useState<User[]>(() => {
    const saved = readStored<User[]>(USERS_KEY, [])
    return [...demoUsers, ...(Array.isArray(saved) ? saved.filter(u => u && typeof u.id === 'string' && u.role === 'citizen' && !demoUsers.some(d => d.dui === u.dui)) : [])]
  })
  const [requests, setRequests] = useState<Request[]>(() => {
    const saved = readStored<Request[]>(DATA_KEY, seedRequests)
    return Array.isArray(saved) && saved.every(r => r && typeof r.id === 'string' && Array.isArray(r.history) && Array.isArray(r.files)) ? saved : seedRequests
  })
  const [userId, setUserId] = useState<string>(() => { try { return sessionStorage.getItem(SESSION_KEY) || '' } catch { return '' } })
  const [message, setMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const user = users.find(u => u.id === userId)
  const admin = user?.role === 'admin'
  const [page, id] = route.replace(/^\//, '').split('/')
  const home = admin ? '/solicitudes' : '/inicio'
  useEffect(() => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(requests)) } catch { /* The app remains usable in memory. */ }
  }, [requests])
  useEffect(() => {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users.filter(u => !demoUsers.some(d => d.id === u.id)))) } catch { /* In-memory fallback. */ }
  }, [users])
  useEffect(() => {
    const storage = (e: StorageEvent) => {
      if (e.key === DATA_KEY && e.newValue) {
        try { const next = JSON.parse(e.newValue) as Request[]; if (Array.isArray(next) && next.every(r => r && Array.isArray(r.history) && Array.isArray(r.files))) setRequests(next) } catch { /* Ignore invalid external storage. */ }
      }
    }
    window.addEventListener('storage', storage); return () => window.removeEventListener('storage', storage)
  }, [])
  useEffect(() => {
    document.title = `${admin ? 'Administración' : 'Mi portal'} | ANDA · Demo`
    if (!user && !['login', 'registro'].includes(page)) window.location.hash = '/login'
    if (user && ['login', 'registro'].includes(page)) window.location.hash = home
    window.scrollTo(0, 0)
  }, [route, user, admin, page, home])
  function login(account: User) {
    setUserId(account.id)
    try { sessionStorage.setItem(SESSION_KEY, account.id) } catch { /* Session survives in memory. */ }
    window.location.hash = account.role === 'admin' ? '/solicitudes' : '/inicio'
    setMessage('')
  }
  function logout() {
    setUserId(''); setMessage(''); setMenuOpen(false)
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Session cleared in memory. */ }
    window.location.hash = '/login'
  }
  const update: UpdateRequest = (requestId, patch, title, detail = '') => {
    setRequests(all => all.map(r => r.id === requestId ? { ...r, ...patch, history: [...r.history, { title, detail, date: `${now()} · ${user?.name ?? 'Demo'}` }] } : r))
    setMessage(`${title}. Cambios de demostración guardados.`)
  }
  function save(request: Request) {
    // Releer antes de guardar evita sobrescribir cambios de otra pestaña cuyo evento siga pendiente.
    const stored = readStored<Request[]>(DATA_KEY, requests)
    const latest = Array.isArray(stored) ? stored : requests
    const existing = latest.find(r => r.id === request.id)
    if (request.id) {
      const merged = existing && mergeCitizenEdit(existing, request, user?.id ?? '')
      if (!merged) {
        setMessage('La solicitud cambió o ya no admite edición. Vuelve al detalle y revisa su estado antes de continuar.')
        if (Array.isArray(latest)) setRequests(latest)
        return
      }
      const title = request.status === 'Borrador' ? 'Borrador guardado' : 'Solicitud enviada'
      const saved = { ...merged, history: [...existing.history, { title, detail: 'Datos ficticios actualizados por el ciudadano.', date: `${now()} · ${user?.name ?? 'Demo'}` }] }
      setRequests(latest.map(r => r.id === request.id ? saved : r))
      setMessage(`${title}. Cambios de demostración guardados.`)
    }
    else {
      const nextId = `SOL-DEMO-${String(Math.max(0, ...requests.map(r => Number(r.id.split('-').pop()) || 0)) + 1).padStart(3, '0')}`
      request = { ...request, id: nextId, history: [{ title: request.status === 'Borrador' ? 'Borrador guardado' : 'Solicitud recibida', detail: 'Datos ficticios registrados', date: now() }] }
      setRequests(all => [...all, request]); setMessage('Solicitud de demostración guardada.')
    }
    window.location.hash = `/solicitud/${request.id}`
  }
  if (!user) return <Auth key={page} register={page === 'registro'} users={users} onLogin={login} onRegister={account => { setUsers(all => [...all, account]); login(account) }} />
  const request = requests.find(r => r.id === id && (admin || r.owner === user.id))
  const citizenPages = ['inicio', 'catalogo', 'requisitos', 'crear', 'editar', 'solicitud', 'evidencia', 'pago', 'seguimiento', 'mis-solicitudes']
  const adminPages = ['solicitudes', 'revisiones', 'visitas', 'revision', 'material', 'historial', 'visita']
  const permitted = (admin ? adminPages : citizenPages).includes(page)
  let content: ReactNode
  if (!permitted) content = <><Heading title="Página no disponible" subtitle="Esta dirección no pertenece a tu área de demostración." /><a className="button" href={`#${home}`}>Volver al inicio</a></>
  else if (['inicio', 'mis-solicitudes', 'solicitudes', 'revisiones', 'visitas'].includes(page)) content = <Dashboard key={page} user={user} requests={requests} page={page} />
  else if (page === 'catalogo' || page === 'requisitos') content = <Catalog serviceId={page === 'requisitos' ? id : undefined} />
  else if (page === 'crear' && services.some(s => s.id === id)) content = <CreateRequest key={id} owner={user.id} serviceId={id} save={save} />
  else if (!request) content = <Heading title="Solicitud no encontrada" subtitle="La solicitud no existe o no pertenece a esta cuenta." action={<a href={`#${home}`}>Volver al inicio</a>} />
  else if (page === 'editar') content = ['Borrador', 'Corrección de datos'].includes(request.status) ? <CreateRequest key={`${id}-${page}-${JSON.stringify(request.history)}`} owner={user.id} existing={request} serviceId={request.service} save={save} /> : <Notice>Esta solicitud no admite edición en su estado actual. <a href={`#/solicitud/${id}`}>Volver al detalle</a></Notice>
  else if (admin) {
    if (page === 'revision') content = <AdminReview key={`${id}-${request.status}`} request={request} owner={users.find(u => u.id === request.owner)} update={update} />
    else if (page === 'material' || page === 'historial') content = <AdminMaterial key={`${id}-${page}`} request={request} update={update} historyOnly={page === 'historial'} />
    else content = <AdminVisit key={id} request={request} update={update} />
  } else content = <CitizenDetail key={`${id}-${page}`} request={request} view={page} update={update} />
  const nav = admin ? [['Solicitudes', 'solicitudes'], ['Revisiones', 'revisiones'], ['Visitas', 'visitas']] : [['Inicio', 'inicio'], ['Nuevo trámite', 'catalogo'], ['Mis solicitudes', 'mis-solicitudes']]
  const active = admin ? ['revision', 'material', 'historial'].includes(page) ? 'revisiones' : page === 'visita' ? 'visitas' : page : ['requisitos', 'crear'].includes(page) ? 'catalogo' : ['solicitud', 'evidencia', 'pago', 'seguimiento', 'editar'].includes(page) ? 'mis-solicitudes' : page
  return <div className="app-shell"><a href="#main-content" className="skip-link" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Saltar al contenido</a><header className="topbar"><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Mostrar navegación" aria-expanded={menuOpen}>☰</button><a className="logo" href={`#${home}`}>ANDA</a><span className="portal-title">Portal de trámites técnicos</span><span className="badge prototype">Prototipo académico</span><span className="user-name">{user.name}</span></header>
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}><div><p className="nav-label">{admin ? 'ADMINISTRACIÓN' : 'MI PORTAL'}</p><nav aria-label={admin ? 'Administración' : 'Mi portal'}>{nav.map(([label, target]) => <a key={target} href={`#/${target}`} onClick={() => setMenuOpen(false)} className={active === target ? 'active' : ''} aria-current={active === target ? 'page' : undefined}>{label}</a>)}</nav></div><div className="sidebar-bottom"><small>Cuenta de prueba · {admin ? 'Administrador' : 'Ciudadano'}</small><button className="text-button" onClick={logout}>Cerrar sesión</button></div></aside>
    <main id="main-content" tabIndex={-1} className="main-content">{message && <div className="toast" role="status"><span>{message}</span><button className="text-button" aria-label="Cerrar mensaje" onClick={() => setMessage('')}>×</button></div>}{content}<footer>Demostración académica · Datos ficticios · Sin conexión institucional</footer></main>{!admin && <Chat />}</div>
}
