import client from './client'
import type { TabularDataset } from '@/types'

// Two prefixes on purpose. Metadata reads go to /datasets; anything that touches the
// stored file goes to /ml/datasets. That split is the contract — the frontend never
// learns that Java serves one and Python the other.

// nginx caps request bodies (client_max_body_size). Checking here too turns a confusing
// 413 from a proxy into a message the user can act on, before a byte leaves the browser.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const fetchDatasets = async (): Promise<TabularDataset[]> => {
  const res = await client.get<TabularDataset[]>('/datasets')
  return res.data
}

export const uploadDataset = async (file: File, name: string): Promise<TabularDataset> => {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)

  const res = await client.post<TabularDataset>('/ml/datasets', form, {
    // The shared client defaults to application/json, and axios reads that default in
    // transformRequest: `return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data`
    // (axios/lib/defaults/index.js). Leaving it would silently ship JSON and FastAPI
    // would 422. null removes the header so the browser writes
    // `multipart/form-data; boundary=...` itself — that boundary cannot be written by hand.
    headers: { 'Content-Type': null },
    // The client default is 5s, sized for JSON. A file over a slow uplink needs more.
    timeout: 60_000,
  })
  return res.data
}

// Deletes the stored object AND the row. Going through /ml (not /datasets) is what keeps
// the two in step — Python removes the file first, then asks Java to drop the row.
export const deleteDataset = async (id: string): Promise<void> => {
  await client.delete(`/ml/datasets/${id}`)
}

// A plain href, not an XHR: the endpoint answers 302 to a 60-second signed Supabase URL,
// and letting the browser navigate means it follows the redirect and downloads straight
// from Supabase. The JWT cookie is SameSite=None; Secure, so top-level navigation carries it.
export const datasetDownloadUrl = (id: string): string =>
  `${import.meta.env.VITE_GATEWAY_URL}/ml/datasets/${id}/download`
