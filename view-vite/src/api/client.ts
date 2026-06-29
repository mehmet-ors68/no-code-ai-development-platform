import axios from 'axios'

// Vite env vars use import.meta.env.VITE_* (CRA used process.env.REACT_APP_*)
const baseURL = import.meta.env.VITE_GATEWAY_URL as string

if (!baseURL) {
  throw new Error('VITE_GATEWAY_URL is not defined in .env')
}

const client = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true, // send httpOnly JWT cookie on every request
  headers: { 'Content-Type': 'application/json' },
})

export default client
