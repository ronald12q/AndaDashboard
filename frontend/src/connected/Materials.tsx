import { Card, Field, Notice, Select, Textarea } from '../components/ui'
import { categories, download, remove, specify, upload } from './api'
import type { Category, RecordDetail, Session } from './api'

export type Apply = (operation: () => Promise<{ request: RecordDetail }>, confirmation: string) => Promise<void>
type Props = { session: Session; record: RecordDetail; busy: boolean; apply: Apply }

export function RequestFiles({ session, record, busy, apply, allowed, blocked, detailed = false }: Props & { allowed: Category[]; blocked: boolean; detailed?: boolean }) {
  if (!allowed.length && !record.attachments.length) return null
  const files = <><h2>Archivos adjuntos</h2>{record.attachments.length > 0 ? <ul className="file-list">{record.attachments.map(file => <li key={file.id}>
      <div><strong>{file.filename}</strong><small>{categories[file.category]} · {Math.ceil(file.size / 1024)} KB</small></div>
      <button type="button" className="text-button" disabled={busy || blocked} onClick={() => void apply(async () => {
        await download(session, record, file)
        return { request: record }
      }, 'Descarga iniciada.')} aria-label={`Descargar ${file.filename}`}>Descargar</button>
      {allowed.includes(file.category) && <button type="button" className="text-button" disabled={busy || blocked} aria-label={`Retirar ${file.filename}`} onClick={() => void apply(() => remove(session, record, file), 'Adjunto retirado.')}>Retirar</button>}
    </li>)}</ul> : <p>No hay adjuntos.</p>}</>
  const form = allowed.length > 0 && <form key={record.version} onSubmit={event => {
      event.preventDefault()
      if (blocked || busy) return
      const data = new FormData(event.currentTarget)
      const file = data.get('file')
      const category = data.get('category') as Category
      if (!(file instanceof File) || !file.size || !allowed.includes(category)) return
      void apply(() => upload(session, record, category, file), 'Adjunto guardado.')
    }}><Notice warning>Adjunta solo archivos ficticios. PDF, PNG, JPEG o WEBP; máximo 5 MB por archivo y ocho por expediente.</Notice>
      {blocked && <p>Guarda los cambios de los datos antes de gestionar archivos.</p>}
      <fieldset disabled={busy || blocked} className={detailed ? 'upload connected-upload' : 'form-grid'}>
        {detailed && <strong>Selecciona un archivo de evidencia</strong>}
        {detailed && allowed.length === 1 ? <input type="hidden" name="category" value={allowed[0]} /> : <Select label="Categoría del archivo" name="category">{allowed.map(category => <option key={category} value={category}>{categories[category]}</option>)}</Select>}
        <Field label="Archivo de prueba" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required />
        <div className="full"><button className="button secondary">Adjuntar archivo</button></div>
      </fieldset>
    </form>
  return detailed ? <div className="columns wide-left"><Card>{form}</Card><Card>{files}</Card></div> :
    <Card className="connected-history">{files}{form}</Card>
}

export function Specifications({ session, record, busy, apply }: Props) {
  const isBox = record.service === 'CAJA'
  if (session.role === 'admin' && record.status === 'PENDIENTE_ESPECIFICACIONES') {
    return <Card><h2>Especificaciones del material</h2><p>{isBox ? 'Indica compatibilidad para esta cuenta, sin inventar dimensiones.' : 'Confirma el diámetro residencial que corresponde al servicio.'}</p>
      <form onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        void apply(() => specify(session, record, String(data.get('specification') ?? ''), isBox ? null : String(data.get('diameter'))), 'Especificaciones enviadas.')
      }}>
        {!isBox && <Select label="Diámetro residencial" name="diameter" required disabled={busy}><option value="">Selecciona el diámetro</option><option value="MEDIA_PULGADA">½ pulgada</option><option value="TRES_CUARTOS">¾ de pulgada</option></Select>}
        <Textarea label="Características del material" name="specification" minLength={10} maxLength={1200} required disabled={busy} />
        <button className="button" disabled={busy}>Enviar especificaciones</button>
      </form>
    </Card>
  }
  if (!record.specification) return null
  return <Card className="connected-history"><h2>Especificaciones del material</h2>
    {record.diameter && <p><strong>Diámetro:</strong> {record.diameter === 'MEDIA_PULGADA' ? '½ pulgada' : '¾ de pulgada'}</p>}
    <p className="connected-specification">{record.specification}</p>
    <p>Referencia académica. La evidencia no sustituye la comprobación física en el domicilio.</p>
  </Card>
}
