import { Link } from 'react-router-dom'
import { BrainCircuit, BarChart3, Database, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: BrainCircuit,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    title: 'Neural Networks',
    desc: 'Design and train deep learning models with a visual layer editor. No code required.',
  },
  {
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: 'Classical ML',
    desc: 'Run linear regression, random forests, and more. Upload a CSV and get metrics instantly.',
  },
  {
    icon: Database,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Your Data',
    desc: 'Upload datasets directly. The platform handles preprocessing and train/test splits.',
  },
  {
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    title: 'Live Training',
    desc: 'Watch epoch-by-epoch metrics as your model trains. No refreshing needed.',
  },
]

export default function Landing() {
  return (
    <main className="mx-auto max-w-4xl px-4">
      {/* Hero */}
      <section className="py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          All services running
        </div>
        <h1 className="mb-5 text-5xl font-bold tracking-tight text-foreground">
          Train ML models <br />
          <span className="text-primary">without writing code.</span>
        </h1>
        <p className="mb-8 text-lg text-muted-foreground max-w-xl mx-auto">
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
        {features.map(({ icon: Icon, color, bg, title, desc }) => (
          <div
            key={title}
            className="rounded-lg border border-border p-6 hover:border-primary/30 transition-colors"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <h3 className="mb-1.5 font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
