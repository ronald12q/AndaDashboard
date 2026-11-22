import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Heading } from '../components/ui'
import { Catalog } from '../pages/Catalog'
import { Chat } from '../components/Chat'
import { ApiError, askOrientador, restore, serviceCodes } from './api'
import type { Credentials, Session } from './api'
import { Login } from './Login'
import { Home, RequestList } from './Dashboard'
import { NewRequest, RequestPage } from './Requests'

const sessionKey = 'anda-connected-session-v1'
function readSession(): Credentials | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    return (saved?.role === 'citizen' || saved?.role === 'admin') && typeof saved.token === 'string' ? saved : null
  } catch { return null }
}
const getRoute = () => window.location.hash.slice(1) || '/login'
const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export default function ConnectedApp() {
  const route = useSyncExternalStore(subscribe, getRoute)
  const [page, id, stage] = route.replace(/^\//, '').split('/')
  const [pending, setPending] = useState(readSession)
  const [session, setSession] = useState<Session>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [menu, setMenu] = useState(false)
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(sessionKey) } catch { /* storage unavailable */ }
    setPending(null); setSession(undefined); setError(''); setMenu(false)
    window.location.hash = '/login'
  }, [setMenu])
  useEffect(() => {
    if (!pending) return
    const controller = new AbortController()
    restore(pending, controller.signal).then(value => { setSession(value); setPending(null) }).catch(error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) logout()
      else setError((error as Error).message)
    })
    return () => controller.abort()
  }, [pending, retry, logout])
  useEffect(() => {
    if (session && ['login', 'registro'].includes(page)) window.location.hash = session.role === 'admin' ? '/solicitudes' : '/inicio'
    if (!pending && !session && !['login', 'registro'].includes(page)) window.location.hash = '/login'
    window.scrollTo(0, 0)
  }, [route, page, pending, session])
  function login(value: Session) {
    try { sessionStorage.setItem(sessionKey, JSON.stringify({ role: value.role, token: value.token })) } catch { /* in-memory fallback */ }
    setSession(value)
    window.location.hash = value.role === 'admin' ? '/solicitudes' : '/inicio'
  }
  if (pending) return <main className="auth-main"><Heading title="Restaurando sesión" />
    {error ? <><p role="alert" className="error">{error}</p><div className="actions"><button className="button" onClick={() => { setError(''); setRetry(value => value + 1) }}>Reintentar</button><button className="button secondary" onClick={logout}>Cerrar sesión</button></div></> : <p role="status">Comprobando sesión con la API…</p>}
  </main>
  if (!session) return <Login key={page} register={page === 'registro'} onSession={login} />
  const admin = session.role === 'admin'
  const props = { session, expired: logout }
  const code = Object.hasOwn(serviceCodes, id) ? serviceCodes[id as keyof typeof serviceCodes] : undefined
  const catalog = !admin && ['catalogo', 'requisitos', 'crear'].includes(page)
  const start = admin ? 'solicitudes' : 'inicio'
  const active = catalog ? 'catalogo' : page === 'inicio' ? 'inicio' :
    admin && (page === 'visitas' || stage === 'visita') ? 'visitas' :
      admin && (page === 'revisiones' || page === 'solicitud') ? 'revisiones' : 'solicitudes'
  const links = admin ? [['Solicitudes', 'solicitudes'], ['Revisiones', 'revisiones'], ['Visitas', 'visitas']] :
    [['Inicio', 'inicio'], ['Nuevo trámite', 'catalogo'], ['Mis solicitudes', 'solicitudes']]
  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Saltar al contenido</a>
    <header className="topbar"><button className="menu-toggle" aria-label="Mostrar navegación" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button><a className="logo" href={`#/${start}`}>ANDA</a><span className="portal-title">Portal de trámites técnicos</span><span className="badge prototype">Prototipo académico</span><span className="user-name">{session.account.name}</span></header>
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}><div><p className="nav-label">{admin ? 'ADMINISTRACIÓN' : 'MI PORTAL'}</p><nav aria-label={admin ? 'Administración' : 'Mi portal'}>
      {links.map(([label, target]) => <a key={target} href={`#/${target}`} onClick={() => setMenu(false)} className={active === target ? 'active' : ''} aria-current={active === target ? 'page' : undefined}>{label}</a>)}
    </nav></div><div className="sidebar-bottom"><small>Prototipo académico</small><button className="text-button" onClick={logout}>Cerrar sesión</button></div></aside>
    <main id="main-content" tabIndex={-1} className="main-content">
      {(!admin && ['inicio', 'login', 'registro'].includes(page)) ? <Home {...props} /> :
        ['solicitudes', 'login', 'registro'].includes(page) || (admin && ['revisiones', 'visitas'].includes(page)) ?
          <RequestList key={page} {...props} view={page === 'revisiones' ? 'reviews' : page === 'visitas' ? 'visits' : undefined} /> :
        page === 'solicitud' && id ? <RequestPage key={`${id}:${stage ?? ''}`} id={id} stage={stage} {...props} /> :
          catalog && page === 'catalogo' ? <Catalog /> :
            catalog && page === 'requisitos' && id ? <Catalog serviceId={id} /> :
              catalog && page === 'crear' && code ? <NewRequest key={code} service={code} {...props} /> :
                <Heading title="Página no disponible" action={<a href="#/solicitudes">Volver a solicitudes</a>} />}
      <footer>Prototipo académico · Datos ficticios · Sin conexión institucional</footer>
    </main>{!admin && <Chat ask={import.meta.env.VITE_RAG_ENABLED === 'true' ? (question, signal) => askOrientador(session, question, signal) : undefined} />}
  </div>
}
