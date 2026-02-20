import { Component, type ErrorInfo, type ReactNode } from 'react';

interface BoardErrorBoundaryProps {
  children: ReactNode;
}

interface BoardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class BoardErrorBoundary extends Component<BoardErrorBoundaryProps, BoardErrorBoundaryState> {
  constructor(props: BoardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): BoardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('BoardErrorBoundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 480,
            margin: '48px auto',
            fontFamily: 'system-ui, sans-serif',
            border: '1px solid #ccc',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p style={{ color: '#666' }}>
            An error occurred on the board. Check the console for details.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              cursor: 'pointer',
              background: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
