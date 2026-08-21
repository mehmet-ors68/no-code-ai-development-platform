import { useState, useEffect } from 'react'
import { KeyRound, Plus, Trash2, Copy, Check } from 'lucide-react'
import { fetchApiKeys, createApiKey, deleteApiKey } from '@/api/apiKeys'
import type { ApiKey } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL as string

interface Props {
  modelId: string
  /** Keys resolve to whatever is deployed. Without a deployment they authenticate fine
   *  and then get a 409, which is worth saying before the user goes and debugs it. */
  hasDeployment: boolean
}

export default function ApiKeysCard({ modelId, hasDeployment }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  // The plaintext, for exactly as long as this component stays mounted.
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchApiKeys(modelId).then(setKeys).catch(() => {})
  }, [modelId])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const created = await createApiKey(modelId, label.trim())
      setFreshKey(created.key)
      setKeys(prev => [{ ...created }, ...prev])
      setLabel('')
      setShowCreate(false)
    } catch {
      setError('Could not create the key. Try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    try {
      await deleteApiKey(modelId, keyId)
      setKeys(prev => prev.filter(k => k.id !== keyId))
    } catch {
      setError('Could not revoke that key. Try again.')
    }
  }

  const handleCopy = async () => {
    if (!freshKey) return
    try {
      await navigator.clipboard.writeText(freshKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard needs a secure context. The key is on screen and selectable either way.
      setError('Could not copy automatically — select the key and copy it manually.')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">API Access</h2>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            API Keys
          </CardTitle>
          <CardDescription>
            Call this model from your own code, with no browser session. A key works for this
            model and nothing else you own.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!hasDeployment && (
            <p className="text-xs text-amber-400">
              This model has no deployed version yet. Keys will authenticate, then fail until you
              deploy one from Training History.
            </p>
          )}

          {freshKey && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-400">
                This is the only time you will see this key.
              </p>
              <p className="text-xs text-muted-foreground">
                It is stored as a hash, so it cannot be shown again. If you lose it, delete it and
                create another.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-background/60 px-2 py-1.5 text-xs font-mono">
                  {freshKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send it as <code className="font-mono">X-API-Key</code> to{' '}
                <code className="font-mono break-all">{GATEWAY_URL}/serve/predict</code>. Call{' '}
                <code className="font-mono break-all">{GATEWAY_URL}/serve/schema</code> to see which
                columns it expects.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {showCreate ? (
            <div className="space-y-3 rounded-lg border border-primary/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="key-label">Label</Label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="nightly job, Zapier, laptop script…"
                />
                <p className="text-xs text-muted-foreground">
                  Only for telling your keys apart when you revoke one.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={creating || !label.trim()}>
                  {creating ? 'Creating…' : 'Create key'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setLabel('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New API key
            </Button>
          )}

          {keys.length > 0 && (
            <div className="space-y-2">
              {keys.map(key => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-xs font-mono text-muted-foreground shrink-0">
                      {key.keyPrefix}…
                    </code>
                    <span className="text-sm truncate">{key.label || 'Unlabelled'}</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
