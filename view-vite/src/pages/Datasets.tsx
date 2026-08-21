import { useState, useEffect, useRef, type ChangeEvent, type MouseEvent } from 'react'
import axios from 'axios'
import type { TabularDataset } from '@/types'
import {
  fetchDatasets,
  uploadDataset,
  deleteDataset,
  datasetDownloadUrl,
  MAX_UPLOAD_BYTES,
} from '@/api/datasets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Trash2, Database, Search, Download, Loader2 } from 'lucide-react'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Both services answer with a message, under different keys: FastAPI uses `detail`,
// Spring uses `message`. Surface whichever arrived instead of a generic failure string —
// "CSV has no rows or no columns" tells the user what to fix; "Upload failed" does not.
function apiMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 413) return 'The server rejected the file as too large.'
    const detail = err.response?.data?.detail ?? err.response?.data?.message
    if (typeof detail === 'string') return detail
  }
  return fallback
}

export default function Datasets() {
  const [datasets, setDatasets] = useState<TabularDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Empty dependency array: fetch once on mount. In dev, StrictMode intentionally runs
  // this twice to surface effects that are not safe to re-run — a duplicate GET is, so
  // there is nothing to fix here.
  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch(err => setError(apiMessage(err, 'Could not load your datasets.')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = datasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input before any early return, otherwise picking the SAME file again
    // fires no change event and the upload silently does nothing.
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      setError(`${file.name} is ${mb} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`)
      return
    }

    setError(null)
    setUploading(true)
    try {
      // Pessimistic on purpose. id, fileKey, rowCount and columns are all produced by the
      // server — rendering a row before it answers would mean inventing an id that no
      // download and no delete could ever match. Compare handleDelete below.
      const saved = await uploadDataset(file, file.name.replace(/\.csv$/i, ''))
      setDatasets(prev => [saved, ...prev])
    } catch (err) {
      setError(apiMessage(err, 'Upload failed.'))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation()

    // Optimistic: the row leaves the list now, not after the round trip through Python,
    // Supabase Storage and Java. Safe here because the outcome is knowable in advance —
    // unlike upload, nothing about the row is decided by the server.
    const removed = datasets.find(d => d.id === id)
    setDatasets(prev => prev.filter(d => d.id !== id))
    setError(null)

    try {
      await deleteDataset(id)
    } catch (err) {
      // Rollback. An optimistic update without this is a lie: the user sees the row
      // vanish, the server still has it, and a refresh brings it back with no explanation.
      // Re-sort rather than push: createdAt is ISO-8601, so a string compare is a date
      // compare, and the row lands where it was instead of at the end.
      if (removed) {
        setDatasets(prev =>
          [...prev, removed].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        )
      }
      setError(apiMessage(err, 'Delete failed — the dataset is still there.'))
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Datasets</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${datasets.length} dataset${datasets.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload Dataset'}
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-300/70 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      {datasets.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search datasets…"
            className="pl-9"
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No datasets yet. Upload a CSV to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No datasets match "{search}".</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(ds => (
            <Card key={ds.id} className="transition-all hover:border-primary/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary/70 shrink-0" />
                    <CardTitle className="text-base leading-tight truncate">{ds.name}</CardTitle>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {/* A real <a>, not an onClick handler: the endpoint answers 302 to a
                        signed Supabase URL and the browser follows it natively. Fetching
                        it with axios would pull the whole file into memory first. */}
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <a href={datasetDownloadUrl(ds.id)} title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={e => handleDelete(e, ds.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">
                  {ds.rowCount.toLocaleString()} rows · {ds.columnCount} columns
                </p>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {ds.columns.join(', ')}
                </p>
              </CardContent>

              <CardFooter className="pt-0 pb-3">
                <span className="text-xs text-muted-foreground">
                  Uploaded {timeAgo(ds.createdAt)}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
