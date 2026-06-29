import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { checkAuth } from '@/api/auth'
import type { AuthContextType, AuthStatus } from '@/types'

// Why null default: forces a runtime error if useAuth() is called outside AuthProvider.
// The old version silently returned undefined — much harder to debug.
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 'loading' → 'authenticated' | 'unauthenticated'
  // Replaces the old isLoggedIn + globalLoading + waitAuthorization (3 booleans doing the same job)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    checkAuth().then(ok => setAuthStatus(ok ? 'authenticated' : 'unauthenticated'))
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
