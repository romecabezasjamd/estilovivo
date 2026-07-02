import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recoveryTimer: number;
}

class ErrorBoundary extends Component<Props, State> {
  private timer: ReturnType<typeof setInterval> | null = null;

  public state: State = {
    hasError: false,
    error: null,
    recoveryTimer: 30,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, recoveryTimer: 30 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) {
      this.timer = setInterval(() => {
        this.setState(prev => {
          if (prev.recoveryTimer <= 1) {
            this.autoRecover();
            return { recoveryTimer: 0 };
          }
          return { recoveryTimer: prev.recoveryTimer - 1 };
        });
      }, 1000);
    }
    if (!this.state.hasError && prevState.hasError && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  private autoRecover = () => {
    this.setState({ hasError: false, error: null, recoveryTimer: 30 });
    window.location.reload();
  };

  private handleReset = () => {
    if (this.timer) clearInterval(this.timer);
    this.setState({ hasError: false, error: null, recoveryTimer: 30 });
    window.location.reload();
  };

  private handleGoHome = () => {
    if (this.timer) clearInterval(this.timer);
    this.setState({ hasError: false, error: null, recoveryTimer: 30 });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[var(--bg-card)] rounded-3xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Algo salió mal
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
              Lo sentimos, ocurrió un error inesperado. 
              La página se recargará automáticamente en {this.state.recoveryTimer}s.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Recargar ahora
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 bg-[var(--bg-base)] text-[var(--text-primary)] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
