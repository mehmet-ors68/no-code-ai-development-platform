import client from './client'
import type { ApiKey } from '@/types'

export const fetchApiKeys = async (modelId: string): Promise<ApiKey[]> => {
  const res = await client.get<ApiKey[]>(`/models/${modelId}/api-keys`)
  return res.data
}

// The `key` field of this response is the only time the plaintext exists outside the
// caller's machine: the server keeps nothing but its SHA-256. If it is lost, the only
// recovery is deleting the key and making another.
export const createApiKey = async (modelId: string, label: string): Promise<ApiKey & { key: string }> => {
  const res = await client.post<ApiKey & { key: string }>(`/models/${modelId}/api-keys`, { label })
  return res.data
}

export const deleteApiKey = async (modelId: string, keyId: string): Promise<void> => {
  await client.delete(`/models/${modelId}/api-keys/${keyId}`)
}
