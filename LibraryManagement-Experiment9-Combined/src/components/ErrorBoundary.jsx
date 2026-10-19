import React from 'react';
import Button from './common/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, report `error` and `info` to a monitoring service here.
    console.error('Library application rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary-screen">
          <section className="error-boundary-card" role="alert">
            <div className="error-mark" aria-hidden="true">!</div>
            <p className="eyebrow">SOMETHING WENT WRONG</p>
            <h1>We couldn’t open this library page.</h1>
            <p>Your saved borrowing records have not intentionally been cleared. You can try refreshing the page or return to the home screen.</p>
            {import.meta.env.DEV && this.state.error && <details><summary>Developer details</summary><pre>{this.state.error.message}</pre></details>}
            <div className="error-boundary-actions">
              <Button onClick={() => window.location.reload()}>Refresh application</Button>
              <Button variant="secondary" onClick={() => { window.location.assign('/'); }}>Go to home</Button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
