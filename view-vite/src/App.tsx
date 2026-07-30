import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/Navbar'
import PrivateRoute from '@/components/PrivateRoute'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import MyModels from '@/pages/MyModels'

function App() {
  const { authStatus } = useAuth()

  const isAuth = authStatus === 'authenticated'

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={isAuth ? <Navigate to="/my-models" replace /> : <Landing />} />
        <Route path="/login" element={isAuth ? <Navigate to="/my-models" replace /> : <Login />} />
        <Route path="/register" element={isAuth ? <Navigate to="/my-models" replace /> : <Register />} />
        <Route
          path="/my-models"
          element={<PrivateRoute><MyModels /></PrivateRoute>}
        />
        {/* /process/:id — added once Keras training endpoint is ready */}
      </Routes>
    </>
  )
}

export default App
