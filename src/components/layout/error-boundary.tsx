import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Zeigt statt einer weißen Seite eine verständliche Fehlermeldung. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unerwarteter Fehler', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-dvh bg-bg px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Da ist etwas schiefgelaufen</h1>
          <p className="mt-2 text-sm text-ink-2">
            Lade die Seite neu. Wenn der Fehler bleibt, schick diese Meldung an die Person, die das Portal
            betreut:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 rounded-lg bg-ink px-4 text-sm font-medium text-bg"
          >
            Neu laden
          </button>
        </div>
      </div>
    )
  }
}
