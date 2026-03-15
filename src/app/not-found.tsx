'use client';

import Link from 'next/link';
import RainbowBackground from '@/components/ui/RainbowBackground';
import { Home } from 'lucide-react';

export default function NotFound() {
    return (
        <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-900 text-white">
            <RainbowBackground />
            
            <div className="relative z-10 text-center px-4">
                <h1 className="text-9xl font-black mb-4 opacity-20">404</h1>
                <h2 className="text-3xl font-bold mb-6">요청하신 페이지를 찾을 수 없습니다.</h2>
                <p className="text-gray-400 mb-10 max-w-md mx-auto">
                    존재하지 않거나 삭제된 공연 정보일 수 있습니다.<br />
                    홈으로 돌아가 최신 문화 정보를 확인해보세요.
                </p>
                
                <Link 
                    href="/"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-purple-900/20"
                >
                    <Home size={20} />
                    Culture Flow 홈으로 이동
                </Link>
            </div>
            
            {/* 3D Floating Squares Effect */}
            <div className="bg-squares opacity-30 sm:opacity-50 pointer-events-none">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="bg-square" />
                ))}
            </div>
        </main>
    );
}
