import React, { Component } from "react";

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[CCA] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", gap: 16, padding: 32, fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
          <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 400, textAlign: "center" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              marginTop: 8, padding: "8px 24px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", borderRadius: 8, border: "1px solid #4169E1",
              background: "#4169E1", color: "#fff",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
