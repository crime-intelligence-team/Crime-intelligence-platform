import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 text-sentinel-400 p-8">
          <div className="w-12 h-12 rounded-xl bg-severity-critical/10 border border-severity-critical/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-severity-critical" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-sentinel-200 mb-1">
              {this.props.label ?? 'Component failed to render'}
            </p>
            <p className="text-[11px] text-sentinel-500 font-mono line-clamp-2">
              {this.state.error?.message}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-card border border-surface-border text-xs text-sentinel-200 hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
