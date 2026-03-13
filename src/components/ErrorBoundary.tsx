
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Oops! Algo deu errado.
              </h1>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro inesperado na aplicação. Por favor, tente recarregar a página ou voltar para o início.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
                  <p className="text-xs font-mono text-destructive">
                    {this.state.error?.message}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button 
                variant="default" 
                onClick={this.handleReset}
                className="flex items-center gap-2 h-11"
              >
                <RefreshCcw className="h-4 w-4" />
                Recarregar Página
              </Button>
              <Button 
                variant="outline" 
                onClick={this.handleGoHome}
                className="flex items-center gap-2 h-11"
              >
                <Home className="h-4 w-4" />
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
