import React, { Component } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Heading } from "@dynatrace/strato-components/typography";
import { useTr } from "../i18n/lang";

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
        <ErrorFallback message={this.state.error?.message}
          onReload={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} />
      );
    }
    return this.props.children;
  }
}

/** The fallback screen; a function component so it can read the active language. */
const ErrorFallback: React.FC<{ message?: string; onReload: () => void }> = ({ message, onReload }) => {
  const tr = useTr();
  return (
    <Flex role="alert" flexDirection="column" alignItems="center" justifyContent="center"
      style={{ minHeight: "100vh", gap: 16, padding: 32 }}>
      <Heading level={4}>{tr("Something went wrong", "Algo deu errado", "Algo salió mal")}</Heading>
      <Text style={{ opacity: 0.7, maxWidth: 400, textAlign: "center" }}>
        {message || tr("An unexpected error occurred.", "Ocorreu um erro inesperado.", "Se produjo un error inesperado.")}
      </Text>
      <Button
        onClick={onReload}
        variant="emphasized"
        color="primary"
      >
        {tr("Reload app", "Recarregar app", "Recargar app")}
      </Button>
    </Flex>
  );
};
