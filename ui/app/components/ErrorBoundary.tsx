import React, { Component } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Heading } from "@dynatrace/strato-components/typography";

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
        <Flex role="alert" flexDirection="column" alignItems="center" justifyContent="center"
          style={{ minHeight: "100vh", gap: 16, padding: 32 }}>
          <Heading level={4}>Something went wrong</Heading>
          <Text style={{ opacity: 0.7, maxWidth: 400, textAlign: "center" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </Text>
          <Button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            variant="emphasized"
            color="primary"
          >
            Reload App
          </Button>
        </Flex>
      );
    }
    return this.props.children;
  }
}
