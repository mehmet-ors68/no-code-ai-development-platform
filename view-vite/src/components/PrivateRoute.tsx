import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import GlobalSpinner from './GlobalSpinner'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { authStatus } = useAuth()

  if (authStatus === 'loading') return <GlobalSpinner />
  if (authStatus === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
