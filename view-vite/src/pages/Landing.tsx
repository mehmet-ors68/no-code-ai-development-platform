import { Link } from 'react-router-dom'
import { BrainCircuit, BarChart3, Database, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: BrainCircuit,
    title: 'Neural Networks',
    desc: 'Design and train deep learning models with a visual layer editor. No code required.',
  },
  {
    icon: BarChart3,
    title: 'Classical ML',
    desc: 'Run linear regression, random forests, and more. Upload a CSV and get metrics instantly.',
  },
  {
    icon: Database,
    title: 'Your Data',
    desc: 'Upload datasets directly. The platform handles preprocessing and train/test splits.',
  },
  {
    icon: Zap,
    title: 'Live Training',
    desc: 'Watch epoch-by-epoch metrics as your model trains. No refreshing needed.',
  },
]

export default function Landing() {
  return (
    <main className="mx-auto max-w-4xl px-4">
      {/* Hero */}
      <section className="py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          All services running
        </div>
        <h1 className="mb-5 text-5xl font-bold tracking-tight text-foreground">
          Train ML models <br />
          <span className="text-muted-foreground">without writing code.</span>
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Design neural networks, run sklearn models, and visualize training — all in one platform.
        </p>
        <div className="flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/register">Start for free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 pb-24 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-lg border border-border p-6">
            <Icon className="mb-3 h-5 w-5 text-muted-foreground" />
            <h3 className="mb-1.5 font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
