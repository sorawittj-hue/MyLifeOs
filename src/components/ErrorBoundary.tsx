import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    const errMessage = (error.message || '').toLowerCase();
    
    // Auto-reload on chunk load error (common when a new deployment happens while user has app open)
    if (errMessage.includes('failed to fetch dynamically imported module') ||
        errMessage.includes('importing a module script failed') ||
        errMessage.includes('unexpected token')) { // sometimes it loads index.html instead of JS
        
      const isRetrying = sessionStorage.getItem('chunk-load-retry');
      if (!isRetrying) {
        sessionStorage.setItem('chunk-load-retry', 'true');
        console.warn('Chunk load error detected. Forcing page reload to fetch new bundles...');
        window.location.reload();
      } else {
        sessionStorage.removeItem('chunk-load-retry');
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">เกิดข้อผิดพลาด</h3>
          <p className="text-sm text-zinc-500 mb-4">
            {this.props.fallbackMessage || 'ส่วนนี้ของแอปเกิดปัญหา กรุณาลองใหม่อีกครั้ง'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
