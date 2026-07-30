import client from './client'
import type { Experiment, MlModel, ModelDetail } from '@/types'

export const fetchModels = async (): Promise<MlModel[]> => {
  const res = await client.get<MlModel[]>('/models')
  return res.data
}

export const fetchModel = async (id: string): Promise<ModelDetail> => {
  const res = await client.get<ModelDetail>(`/models/${id}`)
  return res.data
}

export const createModel = async (
  data: Pick<MlModel, 'title' | 'description' | 'modelType'>
): Promise<void> => {
  await client.post('/models', data)
}

export const updateModel = async (id: string, data: Partial<MlModel>): Promise<MlModel> => {
  const res = await client.put<MlModel>(`/models/${id}`, data)
  return res.data
}

export const deleteModel = async (id: string): Promise<void> => {
  await client.delete(`/models/${id}`)
}

export const saveExperiment = async (
  modelId: string,
  data: {
    hyperparameters: Record<string, unknown>
    metrics: Record<string, unknown>
    status: 'completed' | 'failed'
    durationMs: number
  }
): Promise<void> => {
  await client.post(`/models/${modelId}/experiments`, data)
}

export const fetchExperiments = async (modelId: string): Promise<Experiment[]> => {
  const res = await client.get<Experiment[]>(`/models/${modelId}/experiments`)
  return res.data
}
