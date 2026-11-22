import { useState } from 'react'
import type { Request, UpdateRequest, User } from '../data'
import { serviceFor } from '../data'
import { Badge, Card, FilesList, Heading, Notice, Select, Textarea } from '../components/ui'

export function AdminReview({ request: r, owner, update }: { request: Request; owner?: User; update: UpdateRequest }) {
  const [result, setResult] = useState('verified')
  const [observation, setObservation] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [error, setError] = useState('')
  const s = serviceFor(r.service)
  const canReview = r.status === 'En revisión'
  function correct() {
    if (!canReview) return
    if (!observation.trim()) { setError('Describe qué datos o documentos ficticios debe corregir el ciudadano.'); return }
    update(r.id, { status: 'Corrección de datos', observation, verified: false }, 'Corrección de datos solicitada', observation)
    setError('')
  }
  return <><Heading title={`Revisar solicitud · ${r.id}`} subtitle={s.name} action={<Badge>{r.status}</Badge>} />
    <div className="columns"><Card className="review-data"><h2>Datos presentados</h2><dl><dt>Solicitante</dt><dd>{owner?.name ?? 'Ciudadano demo'}</dd><dt>NIS</dt><dd>{r.nis || 'Sin completar'}</dd><dt>Inmueble</dt><dd>{r.address || 'Sin completar'}</dd><dt>Contacto ficticio</dt><dd>{r.phone || 'Sin completar'}</dd><dt>Motivo</dt><dd>{r.reason || 'Sin completar'}</dd>{r.service === 'desconexion' && <><dt>Modalidad</dt><dd>{r.mode}</dd></>}</dl><button className="button secondary" onClick={() => setShowFiles(!showFiles)} aria-expanded={showFiles}>{showFiles ? 'Ocultar archivos adjuntos' : 'Ver archivos adjuntos'}</button>{showFiles && <FilesList files={r.files} />}</Card>
    <Card><h2>Resultado de consulta manual</h2><p>En un procedimiento real, el personal consultaría el NIS en el sistema institucional. Este portal no realiza una consulta automática.</p><Notice warning>Consulta manual simulada: no se verifica ninguna cuenta real. Responsable: Administrador demo.</Notice>
      <form onSubmit={e => { e.preventDefault(); if (!canReview) return; if (result === 'correction') { correct(); return }; if (!r.nis || !r.address) { setError('La cuenta y dirección deben estar completas. Solicita corrección.'); return }; if (r.service === 'desconexion' && ['Identificación del solicitante', 'Escritura del inmueble', 'Carta justificativa'].some(c => !r.files.some(f => f.category === c))) { setError('Faltan documentos de prueba para la desconexión. Solicita corrección.'); return }; update(r.id, { verified: true, status: s.material ? 'Pendiente de especificaciones' : 'Habilitada para pago', observation }, 'Cuenta revisada', observation || 'Verificación manual simulada completada'); if (s.material) window.location.hash = `/material/${r.id}` }}>
        <Select label="Resultado" value={result} disabled={!canReview} onChange={e => setResult(e.target.value)}><option value="verified">Cuenta verificada (simulación)</option><option value="correction">Requiere corrección</option></Select>
        <Textarea label="Observaciones" value={observation} disabled={!canReview} onChange={e => setObservation(e.target.value)} placeholder="Resultado de la revisión de prueba" />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button className="button secondary" type="button" disabled={!canReview} onClick={correct}>Solicitar corrección</button><button className="button" disabled={!canReview}>Continuar</button></div>
      </form>
      {!canReview && <p role="status">{r.status === 'Corrección de datos' ? 'Esperando que el ciudadano corrija y reenvíe la solicitud. No se puede aprobar mientras la corrección esté pendiente.' : r.verified ? 'Cuenta de prueba revisada. Continúa en la gestión del expediente.' : 'Este estado no admite revisión de datos.'}</p>}
      <div className="link-stack">{s.material && r.verified && <a className="button secondary" href={`#/material/${r.id}`}>Especificaciones y evidencia</a>}{r.paid && <a className="button" href={`#/visita/${r.id}`}>Gestionar visita</a>}<a href={`#/historial/${r.id}`}>Ver historial del expediente</a></div>
    </Card></div>
  </>
}
