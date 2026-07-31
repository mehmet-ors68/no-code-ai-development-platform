import { useState, useEffect, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchModels, createModel, deleteModel } from '@/api/models'
import { useAuth } from '@/context/AuthContext'
import type { MlModel } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, BrainCircuit, BarChart3 } from 'lucide-react'

const MODEL_TYPE_LABELS: Record<MlModel['modelType'], string> = {
  DL: 'Deep Learning (Keras)',
  sklearn: 'Classical ML (sklearn)',
  yolo: 'Object Detection (YOLO)',
  nlp: 'NLP (HuggingFace)',
}

const STATUS_CLASS: Record<MlModel['status'], string> = {
  draft: 'text-muted-foreground',
  compiled: 'text-yellow-400',
  training: 'text-yellow-400',
  trained: 'text-green-400',
  failed: 'text-red-400',
}

export default function MyModels() {
  const [models, setModels] = useState<MlModel[]>([])
  const [loading, setLoading] = useState(true)
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
    e.stopPropagation() // don't navigate to process page when clicking delete
    await deleteModel(id)
    setModels(prev => prev.filter(m => m.id !== id))
  }

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
        <Button onClick={() => setShowCreate(v => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          New Model
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {models.map(model => (
            <Card
              key={model.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => navigate(`/process/${model.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{model.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                    onClick={e => handleDelete(e, model.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {model.description && (
                  <CardDescription className="line-clamp-2">{model.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {MODEL_TYPE_LABELS[model.modelType]}
                  </span>
                  <span className={`font-medium capitalize ${STATUS_CLASS[model.status]}`}>
                    {model.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
