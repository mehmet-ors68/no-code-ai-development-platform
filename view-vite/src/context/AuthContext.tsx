import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import client from '@/api/client'
import type { AuthContextType, AuthStatus } from '@/types'

// Why null default: forces a runtime error if useAuth() is called outside AuthProvider.
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

  // Resolve auth status eagerly on app mount — one lightweight GET /models call.
  // This way login/register pages can redirect authenticated users immediately,
  // regardless of which page the user lands on.
  useEffect(() => {
    client.get('/auth/me')
      .then(() => setAuthStatus('authenticated'))
      .catch(() => setAuthStatus('unauthenticated'))
  }, [])

  return (
    <AuthContext.Provider value={{ authStatus, setAuthStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
