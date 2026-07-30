import { Link, useNavigate } from 'react-router-dom'
import { BrainCircuit } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { logout } from '@/api/auth'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const { authStatus, setAuthStatus } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    setAuthStatus('unauthenticated')
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity">
          <BrainCircuit className="h-5 w-5" />
          DL Platform
        </Link>

        <div className="flex items-center gap-1">
          {authStatus === 'loading' ? null : authStatus === 'authenticated' ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/my-models">My Models</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
