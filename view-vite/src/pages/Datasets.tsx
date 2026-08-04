import { useState, useRef, type ChangeEvent, type MouseEvent } from 'react'
import Papa from 'papaparse'
import type { TabularDataset } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Trash2, Database, Search } from 'lucide-react'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Datasets() {
  const [datasets, setDatasets] = useState<TabularDataset[]>([])
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = datasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const columns = parsed.meta.fields ?? []
        const newDataset: TabularDataset = {
          kind: 'tabular',
          id: crypto.randomUUID(),
          userId: '',
          name: file.name.replace(/\.csv$/i, ''),
          rowCount: parsed.data.length,
          columnCount: columns.length,
          columns,
          fileUrl: '',
          createdAt: new Date().toISOString(),
        }
        setDatasets(prev => [newDataset, ...prev])
      },
    })
    e.target.value = ''
  }

  const handleDelete = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    setDatasets(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Datasets</h1>
          <p className="text-sm text-muted-foreground">
            {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()} className="gap-1">
          <Upload className="h-4 w-4" />
          Upload Dataset
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

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
      {datasets.length === 0 ? (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    onClick={e => handleDelete(e, ds.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
                <span className="text-xs text-muted-foreground">Uploaded {timeAgo(ds.createdAt)}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
