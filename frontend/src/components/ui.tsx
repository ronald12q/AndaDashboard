import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { Attachment, Request } from '../data'
import { downloadText, serviceFor } from '../data'

export function Heading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <div className={`notice ${warning ? 'warning' : ''}`}>{children}</div>
}
export function Badge({ children }: { children: ReactNode }) {
  const text = String(children)
  return <span className={`badge ${/corrección|Pendiente|revisión/.test(text) ? 'amber' : /pago|Finalizada/.test(text) ? 'green' : ''}`}>{children}</span>
}
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return <label className="field" htmlFor={id}><span>{label}</span><input id={id} {...props} /></label>
}
export function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId()
  return <label className="field" htmlFor={id}><span>{label}</span><select id={id} {...props}>{children}</select></label>
}
export function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return <label className="field" htmlFor={id}><span>{label}</span><textarea id={id} rows={3} {...props} /></label>
}
export function History({ request }: { request: Request }) {
  return <ol className="timeline">{request.history.map((event, i) => <li key={`${event.date}-${i}`}><strong>{event.title}</strong><p>{event.detail}</p><small>{event.date}</small></li>)}</ol>
}
export function RequestsTable({ requests, admin = false, visits = false }: { requests: Request[]; admin?: boolean; visits?: boolean }) {
  return <div className="table-scroll"><table><caption className="sr-only">Solicitudes de prueba</caption><thead><tr><th>Solicitud</th><th>Trámite</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{requests.map(r => <tr key={r.id}><td>{r.id}<small className="table-nis">{admin && r.nis}</small></td><td>{serviceFor(r.service).name}</td><td>{r.status}</td><td><a aria-label={`${admin ? visits ? 'Gestionar visita' : 'Revisar' : 'Ver detalle'} de ${r.id}`} href={`#/${admin ? (visits ? 'visita' : 'revision') : 'solicitud'}/${r.id}`}>{admin ? visits ? 'Gestionar visita' : 'Revisar' : 'Ver detalle'}</a></td></tr>)}{requests.length === 0 && <tr><td colSpan={4}>No hay solicitudes para estos filtros.</td></tr>}</tbody></table></div>
}
export function FilePicker({ files, onChange, category = 'Evidencia', required = false }: { files: Attachment[]; onChange: (files: Attachment[]) => void; category?: string; required?: boolean }) {
  const id = useId(); const [error, setError] = useState('')
  function add(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    if (incoming.some(f => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      setError('Utiliza JPG, PNG, WEBP o PDF de hasta 5 MB por archivo.'); return
    }
    if (files.length + incoming.length > 8) { setError('Máximo 8 archivos por solicitud.'); return }
    setError('')
    onChange([...files, ...incoming.map(f => ({ name: f.name, size: f.size, type: f.type, category }))])
  }
  return <div><label className="upload" htmlFor={id} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.files) }}>
    <strong>{category === 'Evidencia' ? 'Arrastra tus archivos aquí' : category}</strong><p>Fotografías o documentos ficticios · máximo 5 MB</p><span className="button secondary">Seleccionar archivos</span>
    <input id={id} className="file-input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple required={required && !files.some(f => f.category === category)} onChange={e => { add(e.target.files); e.target.value = '' }} />
  </label>{error && <p role="alert" className="error">{error}</p>}<small>Demo: solo se guardan nombres y metadatos, no el contenido. No adjuntes información personal real.</small></div>
}
export function FilesList({ files, onRemove }: { files: Attachment[]; onRemove?: (index: number) => void }) {
  return <ul className="file-list">{files.map((f, i) => <li key={`${f.name}-${i}`}><div><strong>{f.name}</strong><small>{f.category} · {(f.size / 1024).toFixed(1)} KB · metadatos demo</small></div>{onRemove ? <button type="button" className="text-button" onClick={() => onRemove(i)} aria-label={`Quitar ${f.name}`}>Quitar</button> : <button className="text-button" type="button" onClick={() => downloadText(`Referencia-${f.name}.txt`, `ARCHIVO DEMO: ${f.name}\nCategoría: ${f.category}\nSolo metadatos. El contenido original no se almacena en este prototipo.`)}>Ver referencia</button>}</li>)}{!files.length && <li>No hay archivos adjuntos.</li>}</ul>
}
