'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center py-20">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-white light:text-gray-900 mb-2">
                문제가 발생했습니다
            </h2>

            <p className="text-gray-400 light:text-gray-600 mb-8 max-w-md leading-relaxed">
                죄송합니다. 페이지를 불러오는 중 예기치 않은 오류가 발생했습니다.<br />
                잠시 후 다시 시도하거나 홈으로 이동해 주세요.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                    <RefreshCcw size={18} />
                    다시 시도
                </button>

                <a
                    href="/culture/"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-colors border border-white/10"
                >
                    <Home size={18} />
                    홈으로 이동
                </a>
            </div>

            <div className="mt-12 p-4 bg-gray-900/50 rounded-lg max-w-lg w-full text-left border border-white/5">
                <p className="text-xs text-gray-500 font-mono mb-1">Error Digest (Support Reference):</p>
                <code className="text-xs text-red-400 break-all font-mono block">
                    {error.digest || error.message || 'Unknown Error'}
                </code>
            </div>
        </div>
    );
}
