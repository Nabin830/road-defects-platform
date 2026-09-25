import { Component, type ReactNode } from 'react';

/** Catches a crash in one page so the rest of the site (header, navigation) keeps working. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('[RoadFix] page crashed:', error); }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="w-full max-w-[640px] mx-auto px-6 py-16">
        <div className="card p-10 text-center">
          <h2 className="mb-2">Something went wrong on this page</h2>
          <p className="text-muted mb-6">Your data is safe. Try reloading, or go back to the home page.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn btn-secondary hover:no-underline" href="/">Home</a>
          </div>
        </div>
      </main>
    );
  }
}
