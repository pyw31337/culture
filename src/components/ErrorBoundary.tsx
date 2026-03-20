'use client';
import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

const ERROR_MESSAGES: Record<string, { title: string; desc: string; refresh: string }> = {
    ko: { title: '문제가 발생했습니다', desc: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.', refresh: '새로고침' },
    en: { title: 'Something went wrong', desc: 'A temporary error occurred. Please try again.', refresh: 'Refresh' },
    zh: { title: '发生了问题', desc: '发生临时错误。请稍后重试。', refresh: '刷新' },
    ja: { title: '問題が発生しました', desc: '一時的なエラーが発生しました。もう一度お試しください。', refresh: '再読み込み' },
};

/**
 * Error Boundary component to catch and handle React errors gracefully.
 * Prevents entire app crashes by displaying a friendly fallback UI.
 * Uses locale-detection from URL path since class components can't use hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    private getLocale(): string {
        if (typeof window === 'undefined') return 'ko';
        const path = window.location.pathname;
        const match = path.match(/^\/(en|zh|ja)\b/);
        return match ? match[1] : 'ko';
    }

    render() {
        if (this.state.hasError) {
            const locale = this.getLocale();
            const msg = ERROR_MESSAGES[locale] || ERROR_MESSAGES.ko;

            return this.props.fallback || (
                <div className="min-h-[50vh] flex flex-col items-center justify-center bg-gray-900/50 light:bg-white p-8 rounded-xl border border-white/5 light:border-gray-200">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>

                    <h2 className="text-xl font-extrabold text-white light:text-gray-900 mb-2">
                        {msg.title}
                    </h2>

                    <p className="text-gray-400 light:text-gray-600 mb-6 text-center max-w-sm text-sm">
                        {msg.desc}<br />
                        ({this.state.error?.message || 'Unknown Error'})
                    </p>

                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            window.location.reload();
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-lg font-extrabold hover:bg-gray-700 transition-colors border border-white/10"
                    >
                        <RefreshCcw size={16} />
                        {msg.refresh}
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
