import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEMO_PASSWORD, demoUsers } from '../data'
import type { User } from '../data'
import { authenticateDemo } from '../auth'
import { Field, Notice } from '../components/ui'

export function Auth({ register, users, onLogin, onRegister }: { register: boolean; users: User[]; onLogin: (user: User) => void; onRegister: (user: User) => void }) {
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [access, setAccess] = useState<'citizen' | 'admin'>('citizen')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    const data = new FormData(e.currentTarget)
    const dui = String(data.get('dui')).trim(); const password = String(data.get('password'))
    if (!register) {
      const user = authenticateDemo(users, access, String(data.get('identifier')), password)
      if (!user) { setError(`${access === 'admin' ? 'Correo' : 'DUI'} o clave demo incorrectos. Consulta las credenciales de prueba.`); return }
      onLogin(user); return
    }
    const name = String(data.get('name')).trim(); const email = String(data.get('email')).trim().toLowerCase()
    if (name.length < 3) { setError('Escribe un nombre ficticio de al menos 3 caracteres.'); return }
    if (users.some(u => u.dui === dui || u.email === email)) { setError('Este DUI o correo de prueba ya está registrado.'); return }
    if (password !== DEMO_PASSWORD || data.get('confirm') !== password) { setError(`En este registro simulado utiliza ${DEMO_PASSWORD} en ambas casillas. Nunca uses una contraseña real.`); return }
    onRegister({ id: crypto.randomUUID(), name, email, dui, role: 'citizen' })
  }
  return <div className="auth-layout"><aside className="auth-brand"><div><a href="#/login" className="auth-logo">ANDA</a><p>Portal de trámites técnicos</p></div><h2>Tus trámites, con<br />un seguimiento<br />más claro.</h2><p>Consulta requisitos, registra solicitudes y<br className="desktop-only" /> conoce el avance desde un mismo lugar.</p><span className="badge">Prototipo académico</span></aside>
    <main className={`auth-main ${register ? 'register' : ''}`}><h1>{register ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h1><p>{register ? 'Ingresa tus datos ficticios para comenzar.' : 'Accede para gestionar tus solicitudes.'}</p>
      <form onSubmit={submit} className="auth-form">
        {!register && <div className="access-options" role="group" aria-label="Tipo de acceso">{(['citizen', 'admin'] as const).map(role => <button key={role} type="button" aria-pressed={access === role} className={`button ${access === role ? '' : 'secondary'}`} onClick={() => { setAccess(role); setError(''); setInfo('') }}>{role === 'citizen' ? 'Ciudadano' : 'Personal administrativo'}</button>)}</div>}
        {register && <><Notice warning>Registro solo de demostración. No uses datos ni contraseñas reales. La clave de todas las cuentas demo es <strong>{DEMO_PASSWORD}</strong>; no se almacena tu contraseña.</Notice><Field label="Nombre completo ficticio" name="name" required minLength={3} autoComplete="off" placeholder="Usuario de prueba" /><Field label="Correo electrónico ficticio" name="email" type="email" required placeholder="usuario@example.com" /></>}
        {register ? <Field label="DUI de prueba" name="dui" required pattern="\d{8}-\d" title="Formato de prueba: 00000001-0" placeholder="00000001-0" autoComplete="username" /> : access === 'admin' ? <Field key="admin" label="Correo institucional de prueba" name="identifier" type="email" required placeholder="admin@example.com" autoComplete="username" /> : <Field key="citizen" label="DUI de prueba" name="identifier" required pattern="\d{8}-\d" title="Formato de prueba: 00000001-0" placeholder="00000001-0" autoComplete="username" />}
        {!register && access === 'admin' && <small>Acceso exclusivo para cuentas administrativas habilitadas. No hay registro público de personal. En esta demo utiliza el correo ficticio indicado abajo.</small>}
        <Field label="Contraseña demo" name="password" type="password" required autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? DEMO_PASSWORD : 'Ingresa la clave de prueba'} />
        {register && <Field label="Confirmar contraseña demo" name="confirm" type="password" required autoComplete="new-password" />}
        {!register && <button type="button" className="text-button forgot" onClick={() => setInfo(`No hay recuperación real. Todas las cuentas demo utilizan la clave ${DEMO_PASSWORD}.`)}>Olvidé mi contraseña</button>}
        {error && <p role="alert" className="error">{error}</p>}{info && <p role="status" className="notice">{info}</p>}
        <button className="button" type="submit">{register ? 'Crear cuenta demo' : 'Ingresar'}</button>
      </form>
      {(register || access === 'citizen') && <a className="auth-switch" href={register ? '#/login' : '#/registro'}>{register ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Crear cuenta'}</a>}
      {!register && <details className="demo-credentials" open><summary>Credenciales de demostración</summary><p>Autenticación local simulada, sin conexión institucional.</p>{demoUsers.map(u => <p key={u.id}><strong>{u.role === 'admin' ? 'Personal administrativo (correo)' : 'Ciudadano (DUI)'}:</strong> {u.role === 'admin' ? u.email : u.dui}</p>)}<p>Clave para ambos: <code>{DEMO_PASSWORD}</code></p></details>}
    </main></div>
}
