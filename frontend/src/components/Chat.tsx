import { useEffect, useRef, useState } from 'react'
import { downloadPdf, services, money } from '../data'

export function Chat({ ask }: { ask?: (question: string, signal: AbortSignal) => Promise<{ respuesta: string }> }) {
  const [open, setOpen] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState(ask ? [] : [{ question: '¿Qué hago antes de comprar un medidor?', answer: 'Registra tu solicitud y espera las especificaciones de tu servicio antes de comprar el medidor. El administrador determina el diámetro. Las fotos solo permiten una revisión preliminar.' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open) closeRef.current?.focus() }, [open])
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }) }, [messages])
  useEffect(() => () => pending.current?.abort(), [])
  function close() { pending.current?.abort(); pending.current = null; setBusy(false); setOpen(false); triggerRef.current?.focus() }
  async function answer() {
    if (!query.trim() || pending.current) return
    if (ask) {
      const controller = new AbortController()
      pending.current = controller
      setBusy(true); setError('')
      try {
        const response = await ask(query.trim(), controller.signal)
        if (!controller.signal.aborted) {
          setMessages(m => [...m, { question: query.trim(), answer: response.respuesta }]); setQuery('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          if (failure && typeof failure === 'object' && 'status' in failure && failure.status !== 0 && failure.status !== 503) {
            setError(failure instanceof Error ? failure.message : 'No se pudo enviar la consulta.')
          } else setUnavailable(true)
        }
      } finally {
        if (pending.current === controller) { pending.current = null; setBusy(false) }
      }
      return
    }
    const q = query.toLowerCase()
    let text = 'Este orientador local no consulta cuentas ni sistemas reales. Puedes revisar los requisitos de los seis trámites en «Nuevo trámite». Registra datos ficticios y consulta el seguimiento en «Mis solicitudes».'
    if (/compr|material|medidor|di.metr|caja|v.lvula/.test(q)) text = 'Primero registra tu solicitud. El administrador revisa la cuenta e indica las especificaciones (residencial de ½ o ¾ para medidor y válvula). Después de comprar, adjunta evidencia para revisión preliminar. El técnico comprueba y recibe el material en el domicilio: propuesta académica, no procedimiento autorizado.'
    else if (/pago|precio|tarifa|costo/.test(q)) text = `Tarifas de referencia demo con IVA, no vigentes confirmadas: ${services.map(s => `${s.name}: ${money(s.price)}`).join('; ')}. El pago solo se habilita después de la revisión. Sin cargos reales.`
    else if (/desconex|document/.test(q)) text = 'Para la desconexión de prueba, selecciona temporal o definitiva y adjunta identificación, escritura y carta justificativa ficticias; representación si aplica. La facturación continúa hasta la ejecución en campo. Requisitos de referencia, no confirmación institucional vigente.'
    else if (/visita|entrega/.test(q)) text = 'Después del pago simulado, el administrador coordina una fecha tentativa. Para medidor, caja y válvula, ten el material en el domicilio. La aceptación física se realiza durante la visita, no mediante fotografías.'
    setMessages(m => [...m, { question: query.trim(), answer: text }]); setQuery('')
  }
  return <>{open && <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" onKeyDown={e => { if (e.key === 'Escape') close() }}><header><div><strong id="chat-title">Orientador de trámites</strong><small>{ask ? 'Orientación académica · no consulta expedientes' : 'Respuestas locales de demostración · no es IA conectada'}</small></div><button ref={closeRef} onClick={close} aria-label="Cerrar orientador">×</button></header>
    {unavailable ? <div className="chat-unavailable"><h2>El asistente no está disponible</h2><p>{ask ? 'Puedes volver a consultar cuando el servicio esté disponible, o revisar estas referencias.' : 'Estado de demostración. Puedes consultar estos documentos desde el mismo chat.'}</p><button className="button secondary" onClick={() => downloadPdf('Guia-DEMO-ANDA.pdf', ['GUIA DE REFERENCIA - PROTOTIPO ACADEMICO', 'No representa procedimientos institucionales autorizados.', '', 'Materiales: solicitud, revision, especificaciones, compra, evidencia,', 'revision preliminar, pago simulado, visita en domicilio.', 'Reconectar, desconectar y detectar fugas: revision, pago, visita.', 'Fotografias no sustituyen comprobacion fisica.', 'Tarifas demo no vigentes confirmadas. Nunca enviar datos reales.'])}>Documentos de referencia</button><a className="button secondary" href="#/catalogo" onClick={close}>Consultar catálogo y requisitos</a><button className="button" onClick={() => setUnavailable(false)}>Reintentar</button></div> : <>
      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {ask && <p>Las consultas se procesan con servicios externos de IA. No ingreses DUI, NIS, nombres, direcciones ni otros datos personales. Las respuestas no son confirmación institucional.</p>}
        {messages.map((m, i) => <div key={i}><p className="chat-question">{m.question}</p><p className="chat-answer">{m.answer}</p></div>)}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
      <form className="chat-form" onSubmit={e => { e.preventDefault(); void answer() }}><label className="sr-only" htmlFor="chat-input">Escribe tu consulta</label><input id="chat-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Escribe tu consulta..." maxLength={500} required disabled={busy} /><button className="text-button" disabled={busy}>{busy ? 'Consultando…' : 'Enviar'}</button></form>
      {!ask && <button className="text-button unavailable-link" onClick={() => setUnavailable(true)}>Demostrar estado no disponible</button>}
    </>}
  </section>}<button className="chat-trigger" aria-label={open ? 'Cerrar orientador de trámites' : 'Abrir orientador de trámites'} aria-expanded={open} ref={triggerRef} onClick={() => open ? close() : setOpen(true)}><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 4h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H14l-8 5 2-5H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="14" r="1.3" fill="currentColor" /><circle cx="16" cy="14" r="1.3" fill="currentColor" /><circle cx="22" cy="14" r="1.3" fill="currentColor" /></svg></button></>
}
