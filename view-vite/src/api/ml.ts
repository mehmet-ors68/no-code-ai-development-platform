import client from './client'

export type SklearnAlgorithm =
  | 'linear_regression'
  | 'logistic_regression'
  | 'random_forest_classifier'
  | 'random_forest_regressor'

export interface TrainRequest {
  model_type: SklearnAlgorithm
  dataset: Record<string, unknown>[]
  target_column: string
  hyperparameters: Record<string, unknown>
  test_size: number
}

export interface TrainResult {
  metrics: Record<string, number>
  model_b64: string
}

export const trainSklearn = async (req: TrainRequest): Promise<TrainResult> => {
  const res = await client.post<TrainResult>('/ml/train', req, { timeout: 60_000 })
  return res.data
}

export const predictSklearn = async (modelB64: string, data: Record<string, unknown>[]): Promise<unknown[]> => {
  const res = await client.post<{ predictions: unknown[] }>('/ml/predict', { model_b64: modelB64, data }, { timeout: 30_000 })
  return res.predictions ?? res.data.predictions
}
