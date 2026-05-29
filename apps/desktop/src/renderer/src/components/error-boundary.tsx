import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[renderer] Root error boundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background p-8 text-foreground">
          <div className="max-w-xl rounded-lg border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              An unexpected error occurred. Please restart the app. If the problem
              persists, contact support.
            </p>
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {this.state.error?.message ?? "Unknown error"}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
