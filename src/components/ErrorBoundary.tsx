'use client';
import { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * Error Boundary component to catch and handle React errors gracefully.
 * Prevents entire app crashes by displaying a friendly fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
        // Future: Send to error reporting service (e.g., Sentry)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 light:bg-white">
                    <div className="text-center p-8 max-w-md">
                        <div className="text-6xl mb-4">😵</div>
                        <h2 className="text-xl font-semibold text-white light:text-gray-900 mb-2">
                            문제가 발생했습니다
                        </h2>
                        <p className="text-gray-400 light:text-gray-600 mb-6">
                            일시적인 오류가 발생했습니다. 새로고침을 시도해 주세요.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                            새로고침
                        </button>
                        <p className="text-xs text-gray-500 mt-4">
                            문제가 지속되면 브라우저 캐시를 삭제해 보세요.
                        </p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
