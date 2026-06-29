import client from './client'
import type { MlModel } from '@/types'

export const fetchModels = async (): Promise<MlModel[]> => {
  const res = await client.get<MlModel[]>('/models')
  return res.data
}

export const createModel = async (
  data: Pick<MlModel, 'name' | 'description' | 'modelType'>
): Promise<MlModel> => {
  const res = await client.post<MlModel>('/models', data)
  return res.data
}

export const updateModel = async (id: string, data: Partial<MlModel>): Promise<MlModel> => {
  const res = await client.put<MlModel>(`/models/${id}`, data)
  return res.data
}

export const deleteModel = async (id: string): Promise<void> => {
  await client.delete(`/models/${id}`)
}
