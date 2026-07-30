export interface MlModel {
  id: string
  userId: string
  title: string
  description: string
  modelType: 'DL' | 'sklearn' | 'yolo' | 'nlp'
  status: 'draft' | 'training' | 'trained' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface ModelSpec {
  id: string
  version: number
  isActive: boolean
  modelType: string
  datasetPath: string | null
  config: Record<string, unknown>
  createdAt: string
}

export interface ModelDetail {
  model: MlModel
  spec: ModelSpec | Record<string, never>
}

export interface Experiment {
  id: string
  hyperparameters: Record<string, unknown>
  metrics: Record<string, unknown>
  status: 'completed' | 'failed'
  durationMs: number | null
  createdAt: string
}

// Single source of truth for auth state — replaces the old isLoggedIn + globalLoading + waitAuthorization
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextType {
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
}
