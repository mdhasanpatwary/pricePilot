"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    resetKeys?: Array<string | number>;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console in development
        if (process.env.NODE_ENV === "development") {
            console.error("ErrorBoundary caught an error:", error, errorInfo);
        }

        // Call optional error handler
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        this.setState({
            error,
            errorInfo,
        });
    }

    componentDidUpdate(prevProps: Props) {
        // Reset error boundary when resetKeys change
        if (
            this.state.hasError &&
            this.props.resetKeys &&
            prevProps.resetKeys &&
            this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
        ) {
            this.reset();
        }
    }

    reset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex items-center justify-center min-h-[400px] p-6">
                    <Card className="max-w-2xl w-full p-8">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-foreground">
                                    Something went wrong
                                </h2>
                                <p className="text-muted-foreground">
                                    We encountered an unexpected error. Please try refreshing the page.
                                </p>
                            </div>

                            {process.env.NODE_ENV === "development" && this.state.error && (
                                <div className="w-full">
                                    <details className="text-left">
                                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                                            Error Details (Development Only)
                                        </summary>
                                        <div className="mt-4 p-4 bg-muted rounded-lg overflow-auto">
                                            <p className="text-sm font-mono text-red-500 mb-2">
                                                {this.state.error.toString()}
                                            </p>
                                            {this.state.errorInfo && (
                                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <Button onClick={this.reset} variant="default">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Try Again
                                </Button>
                                <Button
                                    onClick={() => (window.location.href = "/")}
                                    variant="outline"
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Go Home
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    errorBoundaryProps?: Omit<Props, "children">
) {
    const WrappedComponent = (props: P) => (
        <ErrorBoundary {...errorBoundaryProps}>
            <Component {...props} />
        </ErrorBoundary>
    );

    WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

    return WrappedComponent;
}
