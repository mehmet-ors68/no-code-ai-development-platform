import axios from 'axios'

// Vite env vars use import.meta.env.VITE_* (CRA used process.env.REACT_APP_*)
const baseURL = import.meta.env.VITE_GATEWAY_URL as string

if (!baseURL) {
  throw new Error('VITE_GATEWAY_URL is not defined in .env')
}

const client = axios.create({
  baseURL,
  timeout: 5_000,
  withCredentials: true, // send httpOnly JWT cookie on every request
  headers: { 'Content-Type': 'application/json' },
})

// Session expiry during active use — redirect to login on 401 from protected routes.
// Auth routes (/auth/login, /auth/register) are excluded: their 401s mean wrong
// credentials, not an expired session, and the form handles them via catch block.
client.interceptors.response.use(
  res => res,
  err => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
