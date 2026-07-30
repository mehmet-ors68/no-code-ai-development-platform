import { useParams } from 'react-router-dom'
import { BrainCircuit } from 'lucide-react'

export default function Process() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center gap-4 px-4 text-center">
      <BrainCircuit className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Model Training</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The training interface is coming soon. This page will let you configure layers,
        upload datasets, and watch live training metrics.
      </p>
      <p className="text-xs text-muted-foreground font-mono opacity-50">{id}</p>
    </div>
  )
}
