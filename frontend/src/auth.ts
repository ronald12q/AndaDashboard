import { DEMO_PASSWORD } from './data.ts'
import type { Role, User } from './data.ts'

// Solo demostración local. La autenticación real debe validarse en el servidor.
export function authenticateDemo(users: User[], role: Role, identifier: string, password: string): User | undefined {
  if (password !== DEMO_PASSWORD) return undefined
  const value = identifier.trim()
  return users.find(user => user.role === role && (
    role === 'admin'
      ? user.email.toLowerCase() === value.toLowerCase()
      : user.dui === value
  ))
}
