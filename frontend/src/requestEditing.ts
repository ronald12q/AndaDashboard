import type { Request } from './data.ts'

export function mergeCitizenEdit(current: Request, submitted: Request, owner: string): Request | undefined {
  if (current.owner !== owner || submitted.owner !== owner || current.id !== submitted.id) return
  if (!['Borrador', 'Corrección de datos'].includes(current.status)) return
  if (!['Borrador', 'En revisión'].includes(submitted.status)) return
  if (JSON.stringify(current.history) !== JSON.stringify(submitted.history)) return
  return {
    ...current,
    nis: submitted.nis, phone: submitted.phone, address: submitted.address,
    reference: submitted.reference, reason: submitted.reason, mode: submitted.mode,
    files: submitted.files, status: submitted.status,
    observation: submitted.status === 'En revisión' ? '' : current.observation,
  }
}
