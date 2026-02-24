'use client'

import { Component, type ReactNode } from 'react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('widget-error')

interface Props {
  children: ReactNode
  name: string
}

interface State {
  error: Error | null
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    log.error('Widget crashed', { widget: this.props.name, error: error.message })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--red)' }}>
            {this.props.name}: {this.state.error.message}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
