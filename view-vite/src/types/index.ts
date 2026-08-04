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

export interface TabularDataset {
  kind: 'tabular'
  id: string
  userId: string
  name: string
  rowCount: number
  columnCount: number
  columns: string[]
  fileUrl: string
  createdAt: string
}

// Union grows as new modalities are actually built — e.g. | ImageDataset | VideoDataset.
// Not stubbing those out now: their real shape depends on the YOLO/NLP pipelines that don't exist yet.
export type Dataset = TabularDataset

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
  modelFilePath: string | null  // stores model_b64 for sklearn models
  createdAt: string
}

// Single source of truth for auth state — replaces the old isLoggedIn + globalLoading + waitAuthorization
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextType {
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
}
