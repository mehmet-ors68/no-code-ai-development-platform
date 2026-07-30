import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AuthContextType, AuthStatus } from '@/types'

// Why null default: forces a runtime error if useAuth() is called outside AuthProvider.
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start as 'loading' so PrivateRoute shows a spinner while the first protected
  // API call runs. The page that makes the call (e.g. MyModels) transitions this
  // to 'authenticated' or 'unauthenticated' based on the response.
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

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
