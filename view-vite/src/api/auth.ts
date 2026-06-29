import client from './client'

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface LoginPayload {
  username: string
  password: string
}

// Discriminated union — caller knows exactly which case they're handling
type AuthResult =
  | { success: true }
  | { success: false; reason: 'user_exists' | 'invalid_credentials' | 'server_error' }

export const register = async (payload: RegisterPayload): Promise<AuthResult> => {
  try {
    await client.post('/auth/register', payload)
    return { success: true }
  } catch (err: any) {
    if (err.response?.status === 400) return { success: false, reason: 'user_exists' }
    return { success: false, reason: 'server_error' }
  }
}

export const login = async (payload: LoginPayload): Promise<AuthResult> => {
  try {
    await client.post('/auth/login', payload)
    return { success: true }
  } catch (err: any) {
    if (err.response?.status === 401) return { success: false, reason: 'invalid_credentials' }
    return { success: false, reason: 'server_error' }
  }
}

export const logout = async (): Promise<void> => {
  await client.get('/auth/logout')
}

// Called on app load to check if the JWT cookie is still valid
export const checkAuth = async (): Promise<boolean> => {
  try {
    await client.get('/auth/protected')
    return true
  } catch {
    return false
  }
}
