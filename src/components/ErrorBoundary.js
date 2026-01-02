import React from 'react';

/**
 * Error Boundary Component
 * 
 * Catches React component errors and prevents entire app from crashing.
 * Provides fallback UI and error logging.
 * 
 * Usage:
 *   <ErrorBoundary fallback={<ErrorPage />}>
 *     <App />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Error caught by boundary:', error, errorInfo);

    // Update state with error details
    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // In production, log to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this._logErrorToService(error, errorInfo);
    }
  }

  _logErrorToService = (error, errorInfo) => {
    try {
      // Send to error tracking service
      const errorData = {
        message: error.toString(),
        stack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Could use Sentry, LogRocket, or custom service
      console.log('[Error Tracking]', errorData);
      
      // Example: Send to custom endpoint
      // fetch('/api/v1/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // }).catch(() => {});
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  };

  _reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Check if we have a custom fallback component
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this._reset,
          this.state.errorCount
        );
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-red-500 rounded-xl p-8 max-w-lg">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Something went wrong
            </h1>
            <p className="text-zinc-300 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
                <p className="text-xs font-mono text-red-300 mb-2 font-bold">
                  Error Details (Development Only):
                </p>
                <p className="text-xs text-red-200 mb-2">
                  {this.state.error?.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-red-300">
                    <summary className="cursor-pointer hover:text-red-200">
                      Component Stack
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={this._reset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Go Home
              </button>
            </div>

            {this.state.errorCount > 3 && (
              <p className="text-xs text-yellow-400 mt-4">
                ⚠️ Multiple errors detected. Please contact support if the problem persists.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
