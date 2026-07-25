import client from './client'

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface LoginPayload {
  identifier: string  // username or email — matches Java LoginRequest
  password: string
}

// Discriminated union — caller knows exactly which case they're handling
type AuthResult =
  | { success: true }
  | { success: false; reason: 'user_exists' | 'invalid_credentials' | 'validation_error' | 'server_error'; message?: string }

export const register = async (payload: RegisterPayload): Promise<AuthResult> => {
  try {
    await client.post('/auth/register', payload)
    return { success: true }
  } catch (err: any) {
    if (err.response?.status === 400) {
      const body = err.response.data
      // Java returns { errors: { field: "message" } } for @Valid failures
      // and { message: "..." } for duplicate user
      if (body?.errors) {
        const firstMessage = Object.values(body.errors)[0] as string
        return { success: false, reason: 'validation_error', message: firstMessage }
      }
      return { success: false, reason: 'user_exists', message: body?.message }
    }
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
