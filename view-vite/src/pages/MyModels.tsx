import { useState, useEffect, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchModels, createModel, deleteModel } from '@/api/models'
import { useAuth } from '@/context/AuthContext'
import type { MlModel } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, BrainCircuit, BarChart3, Search, ChevronRight } from 'lucide-react'

const MODEL_TYPE_LABELS: Record<MlModel['modelType'], string> = {
  DL: 'Deep Learning',
  sklearn: 'Classical ML',
  yolo: 'Object Detection',
  nlp: 'NLP',
}

const STATUS_BADGE: Record<MlModel['status'], { label: string; cls: string }> = {
  draft:    { label: 'Draft',    cls: 'bg-slate-700 text-slate-300' },
  training: { label: 'Training', cls: 'bg-yellow-500/20 text-yellow-300' },
  trained:  { label: 'Trained',  cls: 'bg-green-500/20 text-green-400' },
  failed:   { label: 'Failed',   cls: 'bg-red-500/20 text-red-400' },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function MyModels() {
  const [models, setModels] = useState<MlModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<MlModel['modelType']>('sklearn')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const { setAuthStatus } = useAuth()

  useEffect(() => {
    fetchModels()
      .then(data => {
        setAuthStatus('authenticated')
        setModels(data)
      })
      .catch(() => setAuthStatus('unauthenticated'))
      .finally(() => setLoading(false))
  }, [setAuthStatus])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    await createModel({ title: newTitle.trim(), description: newDesc.trim(), modelType: newType })
    const updated = await fetchModels()
    setModels(updated)
    setNewTitle('')
    setNewDesc('')
    setNewType('sklearn')
    setShowCreate(false)
    setCreating(false)
  }

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteModel(id)
    setModels(prev => prev.filter(m => m.id !== id))
  }

  const filtered = models.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Models</h1>
          <p className="text-sm text-muted-foreground">
            {models.length} model{models.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="gap-1">
          <Plus className="h-4 w-4" />
          New Model
        </Button>
      </div>

      {/* Search */}
      {models.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models…"
            className="pl-9"
          />
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">New Model</CardTitle>
            <CardDescription>Configure and create your model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-name">Name</Label>
              <Input
                id="model-name"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Iris Classifier"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-desc">Description</Label>
              <Input
                id="model-desc"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-type">Type</Label>
              <select
                id="model-type"
                value={newType}
                onChange={e => setNewType(e.target.value as MlModel['modelType'])}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.entries(MODEL_TYPE_LABELS) as [MlModel['modelType'], string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </CardFooter>
        </Card>
      )}

      {/* Model list */}
      {models.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No models yet. Create your first one.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No models match "{search}".</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(model => {
            const badge = STATUS_BADGE[model.status] ?? STATUS_BADGE.draft
            return (
              <Card
                key={model.id}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                onClick={() => navigate(`/process/${model.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight truncate">{model.title}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={e => handleDelete(e, model.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {model.description && (
                    <CardDescription className="line-clamp-2 mt-1">{model.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5 text-primary/70" />
                    <span>{MODEL_TYPE_LABELS[model.modelType]}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Updated {timeAgo(model.updatedAt)}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
