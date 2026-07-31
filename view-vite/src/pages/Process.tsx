import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { BrainCircuit, Upload, Play, ChevronLeft, CheckCircle2, XCircle, Clock, Trash2, Download } from 'lucide-react'
import { fetchModel, saveExperiment, fetchExperiments, deleteExperiment } from '@/api/models'
import { trainSklearn, predictSklearn, type SklearnAlgorithm, type TrainResult } from '@/api/ml'
import type { ModelDetail, Experiment } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Sklearn algorithm metadata ────────────────────────────────────────────────

const ALGORITHMS: { value: SklearnAlgorithm; label: string; task: 'classification' | 'regression' }[] = [
  { value: 'logistic_regression',       label: 'Logistic Regression',       task: 'classification' },
  { value: 'random_forest_classifier',  label: 'Random Forest Classifier',  task: 'classification' },
  { value: 'linear_regression',         label: 'Linear Regression',         task: 'regression' },
  { value: 'random_forest_regressor',   label: 'Random Forest Regressor',   task: 'regression' },
]

interface Hyperparams {
  n_estimators: number
  max_depth: number | ''
  max_iter: number
  test_size: number
}

const DEFAULT_HP: Hyperparams = { n_estimators: 100, max_depth: '', max_iter: 1000, test_size: 20 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMetricKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const PERCENT_METRICS = new Set(['accuracy', 'r2'])

function formatMetricValue(key: string, val: number): string {
  if (PERCENT_METRICS.has(key)) return (val * 100).toFixed(2) + '%'
  return val.toFixed(6).replace(/\.?0+$/, '') || '0'  // mse, rmse as raw number, strip trailing zeros
}

function statusBadge(status: string) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'
  switch (status) {
    case 'completed':
    case 'trained':  return <span className={`${base} bg-green-500/10 text-green-400`}><CheckCircle2 className="h-3 w-3" /> Completed</span>
    case 'training': return <span className={`${base} bg-yellow-500/10 text-yellow-400`}><Clock className="h-3 w-3" /> Training</span>
    case 'failed':   return <span className={`${base} bg-red-500/10 text-red-400`}><XCircle className="h-3 w-3" /> Failed</span>
    default:         return <span className={`${base} bg-muted text-muted-foreground`}>Draft</span>
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Process() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Model data
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Algorithm config
  const [algorithm, setAlgorithm] = useState<SklearnAlgorithm>('random_forest_classifier')
  const [hp, setHp] = useState<Hyperparams>(DEFAULT_HP)

  // Dataset
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [targetCol, setTargetCol] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Training
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<TrainResult | null>(null)
  const [trainError, setTrainError] = useState('')

  // Predict
  const [predictFile, setPredictFile] = useState<File | null>(null)
  const [predictRows, setPredictRows] = useState<Record<string, unknown>[]>([])
  const [predictions, setPredictions] = useState<unknown[] | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState('')
  const predictFileRef = useRef<HTMLInputElement>(null)

  // History
  const [experiments, setExperiments] = useState<Experiment[]>([])

  // ── Load model ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    fetchModel(id)
      .then(d => {
        setDetail(d)
        // Pre-load algorithm from saved spec if exists
        const cfg = (d.spec as { config?: Record<string, unknown> })?.config
        if (cfg?.algorithm) setAlgorithm(cfg.algorithm as SklearnAlgorithm)
        if (cfg?.n_estimators) setHp(prev => ({ ...prev, n_estimators: cfg.n_estimators as number }))
        if (cfg?.max_depth) setHp(prev => ({ ...prev, max_depth: cfg.max_depth as number }))
      })
      .catch((err) => {
        // 401 → interceptor handles redirect to /login, don't show "Model not found"
        if (err?.response?.status !== 401) setLoadError(true)
      })

    fetchExperiments(id).then(setExperiments).catch(() => {})
  }, [id])

  // ── CSV upload ──────────────────────────────────────────────────────────────
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setTrainError('')

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setRows(parsed.data)
        const cols = parsed.meta.fields ?? []
        setColumns(cols)
        setTargetCol(cols[cols.length - 1] ?? '')
      },
    })
  }

  // ── Train ───────────────────────────────────────────────────────────────────
  const handleTrain = async () => {
    if (!id || !rows.length || !targetCol) return
    setTraining(true)
    setResult(null)
    setTrainError('')
    const start = Date.now()

    const hyperparameters: Record<string, unknown> = {}
    const algo = ALGORITHMS.find(a => a.value === algorithm)!
    if (algorithm.startsWith('random_forest')) {
      hyperparameters.n_estimators = hp.n_estimators
      if (hp.max_depth !== '') hyperparameters.max_depth = hp.max_depth
    }
    if (algorithm === 'logistic_regression') {
      hyperparameters.max_iter = hp.max_iter
    }

    try {
      const res = await trainSklearn({
        model_type: algorithm,
        dataset: rows,
        target_column: targetCol,
        hyperparameters,
        test_size: hp.test_size / 100,
      })
      const durationMs = Date.now() - start
      setResult(res)

      // Persist experiment — failure here must NOT hide the training result
      saveExperiment(id, {
        hyperparameters: { algorithm, ...hyperparameters, target_column: targetCol },
        metrics: res.metrics,
        status: 'completed',
        durationMs,
        modelUrl: res.model_url,
      })
        .then(() => Promise.all([fetchExperiments(id), fetchModel(id)]))
        .then(([exps, updated]) => {
          setExperiments(exps)
          setDetail(updated)
        })
        .catch(() => {
          // History save failed silently — results still displayed
        })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTrainError(msg ?? 'Training failed. Check your dataset and try again.')
    } finally {
      setTraining(false)
    }
  }

  // ── Predict ──────────────────────────────────────────────────────────────────
  const activeModel = experiments.find(e => e.status === 'completed' && e.modelFilePath)

  const handlePredictFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPredictFile(file)
    setPredictions(null)
    setPredictError('')
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (parsed) => setPredictRows(parsed.data),
    })
  }

  const handlePredict = async () => {
    if (!activeModel?.modelFilePath || !predictRows.length) return
    setPredicting(true)
    setPredictions(null)
    setPredictError('')
    try {
      const preds = await predictSklearn(activeModel.modelFilePath, predictRows)
      setPredictions(preds)
    } catch {
      setPredictError('Prediction failed. Make sure the CSV columns match the training dataset.')
    } finally {
      setPredicting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <p className="text-muted-foreground">Model not found.</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  const { model } = detail
  // modelType lives on MlModel; fall back to spec for models created before the migration
  const specModelType = 'modelType' in detail.spec ? (detail.spec as { modelType: string }).modelType : null
  const modelType = model.modelType ?? specModelType ?? 'sklearn'
  const isSklearn = modelType === 'sklearn'
  const selectedAlgo = ALGORITHMS.find(a => a.value === algorithm)!
  const canTrain = rows.length > 0 && !!targetCol && !training

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate('/my-models')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{model.title}</h1>
            {statusBadge(model.status)}
          </div>
          {model.description && (
            <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
          )}
        </div>
      </div>

      {/* Non-sklearn placeholder */}
      {!isSklearn && (
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {modelType === 'DL' || modelType === 'neural_net' ? 'Deep Learning editor coming soon.' : `${modelType.toUpperCase()} support coming soon.`}
          </p>
        </div>
      )}

      {/* Sklearn workflow */}
      {isSklearn && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Left: Config */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Algorithm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model type</Label>
                  <select
                    value={algorithm}
                    onChange={e => setAlgorithm(e.target.value as SklearnAlgorithm)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <optgroup label="Classification">
                      {ALGORITHMS.filter(a => a.task === 'classification').map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Regression">
                      {ALGORITHMS.filter(a => a.task === 'regression').map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Task: <span className="capitalize">{selectedAlgo.task}</span>
                  </p>
                </div>

                {/* Hyperparameters */}
                {algorithm.startsWith('random_forest') && (
                  <>
                    <div className="space-y-2">
                      <Label>n_estimators <span className="text-muted-foreground font-normal">(trees)</span></Label>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={hp.n_estimators}
                        onChange={e => setHp(p => ({ ...p, n_estimators: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>max_depth <span className="text-muted-foreground font-normal">(empty = unlimited)</span></Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="None"
                        value={hp.max_depth}
                        onChange={e => setHp(p => ({ ...p, max_depth: e.target.value === '' ? '' : Number(e.target.value) }))}
                      />
                    </div>
                  </>
                )}

                {algorithm === 'logistic_regression' && (
                  <div className="space-y-2">
                    <Label>max_iter</Label>
                    <Input
                      type="number"
                      min={100}
                      value={hp.max_iter}
                      onChange={e => setHp(p => ({ ...p, max_iter: Number(e.target.value) }))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Test set size <span className="text-muted-foreground font-normal">(%)</span></Label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={hp.test_size}
                    onChange={e => setHp(p => ({ ...p, test_size: Number(e.target.value) }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Dataset + Train */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dataset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload zone */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-lg border-2 border-dashed border-border py-8 text-center hover:border-primary/40 transition-colors"
                >
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">{fileName || 'Click to upload CSV'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rows.length > 0 ? `${rows.length} rows · ${columns.length} columns` : 'CSV file with header row'}
                  </p>
                </button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

                {/* Target column */}
                {columns.length > 0 && (
                  <div className="space-y-2">
                    <Label>Target column <span className="text-muted-foreground font-normal">(what to predict)</span></Label>
                    <select
                      value={targetCol}
                      onChange={e => setTargetCol(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Features: {columns.filter(c => c !== targetCol).join(', ')}
                    </p>
                  </div>
                )}

                {/* Train button */}
                <Button
                  className="w-full"
                  disabled={!canTrain}
                  onClick={handleTrain}
                >
                  {training
                    ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" />Training…</>
                    : <><Play className="mr-2 h-4 w-4" />Train</>
                  }
                </Button>

                {trainError && (
                  <p className="text-sm text-red-400">{trainError}</p>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            {result && (
              <Card className="border-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(result.metrics).filter(([, val]) => val != null).map(([key, val]) => (
                      <div key={key} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">{formatMetricKey(key)}</p>
                        <p className="text-xl font-semibold tabular-nums">{formatMetricValue(key, val)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Predict */}
      {isSklearn && activeModel && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Predict</h2>
          <Card>
            <CardContent className="pt-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Upload a CSV with the same feature columns as your training data (no target column needed).
              </p>
              <button
                type="button"
                onClick={() => predictFileRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-border py-6 text-center hover:border-primary/40 transition-colors"
              >
                <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">{predictFile?.name ?? 'Click to upload CSV'}</p>
                {predictRows.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">{predictRows.length} rows</p>
                )}
              </button>
              <input ref={predictFileRef} type="file" accept=".csv" className="hidden" onChange={handlePredictFile} />

              <Button className="w-full" disabled={!predictRows.length || predicting} onClick={handlePredict}>
                {predicting
                  ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white inline-block" />Predicting…</>
                  : <><Play className="mr-2 h-4 w-4" />Run Predictions</>
                }
              </Button>

              {predictError && <p className="text-sm text-red-400">{predictError}</p>}

              {predictions && (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">#</th>
                        <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Prediction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.slice(0, 50).map((pred, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{String(pred)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {predictions.length > 50 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Showing first 50 of {predictions.length} predictions</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Experiment history */}
      {experiments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Training History</h2>
          <div className="space-y-2">
            {experiments.map((exp, i) => (
              <div key={exp.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">#{experiments.length - i}</span>
                    {statusBadge(exp.status)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {String(exp.hyperparameters.algorithm ?? '').replace(/_/g, ' ')}
                    </span>
                    {Object.entries(exp.metrics).filter(([, v]) => v != null).map(([k, v]) => (
                      <span key={k} className="text-xs">
                        <span className="text-muted-foreground">{formatMetricKey(k)}: </span>
                        <span className="font-medium">{formatMetricValue(k, Number(v))}</span>
                      </span>
                    ))}
                    {exp.durationMs && (
                      <span className="text-xs text-muted-foreground">{(exp.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {exp.modelFilePath && (
                      <a
                        href={exp.modelFilePath}
                        download
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (!id) return
                        await deleteExperiment(id, exp.id)
                        setExperiments(prev => prev.filter(e => e.id !== exp.id))
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
