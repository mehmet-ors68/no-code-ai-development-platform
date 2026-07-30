import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { authStatus } = useAuth()

  // 'loading': render children — MyModels' own useEffect will call fetchModels()
  // which transitions authStatus to 'authenticated' or 'unauthenticated'
  if (authStatus === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
