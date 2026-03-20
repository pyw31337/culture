'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';
import './[locale]/globals.css'; // Attempt to load global styles if possible, otherwise rely on inline classes or basic Tailwind

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="ko">
            <body className="bg-black text-white antialiased">
                <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
                    <div className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center mb-8 animate-pulse">
                        <AlertTriangle className="w-16 h-16 text-red-500" />
                    </div>

                    <h1 className="text-4xl font-black text-white mb-4">
                        치명적인 오류 발생
                    </h1>

                    <p className="text-gray-400 mb-10 text-lg max-w-md leading-relaxed">
                        시스템에 심각한 문제가 발생하여 앱을 불러올 수 없습니다.<br />
                        관리자에게 문의하거나 페이지를 새로고침 해보세요.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => reset()}
                            className="flex items-center justify-center gap-2 px-8 py-4 bg-red-600 text-white font-extrabold rounded-2xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                        >
                            <RefreshCcw size={20} />
                            앱 다시 시작
                        </button>

                        <a
                            href="/"
                            className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-800 text-white font-extrabold rounded-2xl hover:bg-gray-700 transition-colors border border-white/10"
                        >
                            <Home size={20} />
                            홈으로 강제 이동
                        </a>
                    </div>

                    <div className="mt-16 p-6 bg-gray-900 rounded-xl max-w-xl w-full text-left border border-white/10">
                        <p className="text-sm text-gray-400 font-extrabold mb-2 tracking-wider uppercase">Error Details</p>
                        <code className="text-sm text-red-400 break-all font-mono block bg-black/50 p-4 rounded-lg">
                            {error.digest || error.message || 'Unknown Critical Error'}
                        </code>
                    </div>
                </div>
            </body>
        </html>
    );
}
