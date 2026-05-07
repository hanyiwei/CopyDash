import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      (window as any).electron?.ipcRenderer?.send('renderer-log', 'ERROR', 'ErrorBoundary:', error.message, info.componentStack);
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-xl">!</span>
            </div>
            <p className="text-sm font-bold text-zinc-300 mb-2">Something went wrong</p>
            <p className="text-xs text-zinc-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
