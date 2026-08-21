export interface MlModel {
  id: string
  userId: string
  title: string
  description: string
  modelType: 'DL' | 'sklearn' | 'yolo' | 'nlp'
  status: 'draft' | 'training' | 'trained' | 'failed'
  // Which training run this model serves — to the predict panel and to any API key
  // pointed at it. Null until a run completes; the first completed run sets it.
  deployedExperimentId: string | null
  createdAt: string
  updatedAt: string
}

export interface TabularDataset {
  id: string
  userId: string
  name: string
  rowCount: number
  columnCount: number
  columns: string[]
  // Object path in the private bucket, not a link. Download goes through
  // GET /api/ml/datasets/:id/download, which redirects to a short-lived signed URL.
  fileKey: string
  createdAt: string
}

// Alias, not a union, until a second modality actually exists. When image/video datasets
// arrive they will need a discriminant field the API really sends — inventing one now
// meant every row carried a `kind` the backend never wrote and no component ever read.
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

// A credential for calling one model from outside the browser. The plaintext key is
// never in this shape — the server returns it once, at creation, and stores only a hash.
// keyPrefix is the visible stub that lets a user tell two keys apart.
export interface ApiKey {
  id: string
  label: string
  keyPrefix: string
  createdAt: string
}

// Single source of truth for auth state — replaces the old isLoggedIn + globalLoading + waitAuthorization
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextType {
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
}
