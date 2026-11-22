import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Role } from '../data'
import { Field, Notice } from '../components/ui'
import { authenticate } from './api'
import type { Session } from './api'

export function Login({ register, onSession }: { register: boolean; onSession: (session: Session) => void }) {
  const [role, setRole] = useState<Role>('citizen')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const text = (name: string) => String(fields.get(name) ?? '')
    setError('')
    if (register && text('password') !== text('confirmation')) {
      setError('Las contraseñas no coinciden.'); return
    }
    setBusy(true)
    try {
      onSession(await authenticate(register ? 'citizen' : role, text('identifier'), text('password'),
        register ? { name: text('name'), email: text('email') } : undefined))
    } catch (error) {
      setError((error as Error).message)
    } finally { setBusy(false) }
  }
  return <div className="auth-layout">
    <aside className="auth-brand"><div><a href="#/login" className="auth-logo">ANDA</a><p>Portal de trámites técnicos</p></div><h2>Tus trámites, con<br />un seguimiento<br />más claro.</h2><p>Consulta requisitos, registra solicitudes y conoce el avance desde un mismo lugar.</p><span className="badge">Prototipo académico</span></aside>
    <main className={`auth-main ${register ? 'register' : ''}`}>
      <h1>{register ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h1>
      <p>Modo conectado · Usa únicamente datos ficticios.</p>
      <form className="auth-form" onSubmit={submit}>
        {!register && <div className="access-options" role="group" aria-label="Tipo de acceso">{(['citizen', 'admin'] as const).map(option => <button key={option} type="button" disabled={busy} aria-pressed={role === option} className={`button ${role === option ? '' : 'secondary'}`} onClick={() => { setRole(option); setError('') }}>{option === 'citizen' ? 'Ciudadano' : 'Personal administrativo'}</button>)}</div>}
        {register && <><Field label="Nombre completo" name="name" required minLength={3} maxLength={150} /><Field label="Correo electrónico" name="email" type="email" required maxLength={254} /></>}
        {role === 'admin' && !register
          ? <Field key="email" label="Correo institucional" name="identifier" type="email" autoComplete="username" required />
          : <Field key="dui" label="DUI" name="identifier" pattern="\d{8}-\d" placeholder="12345678-9" required autoComplete="username" />}
        <Field key={role} label="Contraseña" name="password" type="password" required minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} />
        {register && <Field label="Confirmar contraseña" name="confirmation" type="password" required autoComplete="new-password" />}
        {error && <p role="alert" className="error">{error}</p>}
        <button className="button" disabled={busy}>{busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Ingresar'}</button>
      </form>
      {register ? <a className="auth-switch" href="#/login">¿Ya tienes cuenta? Iniciar sesión</a>
        : role === 'citizen' ? <a className="auth-switch" href="#/registro">¿No tienes cuenta? Crear cuenta</a>
          : <Notice>El acceso administrativo requiere una cuenta habilitada. No hay registro público de personal.</Notice>}
    </main>
  </div>
}
