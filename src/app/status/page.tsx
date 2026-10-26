'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function StatusRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/');
    }, [router]);

    return (
        <main className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1427]/90 p-8 text-center backdrop-blur-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4">
                    <ShieldCheck className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-black text-white">관리자 페이지로 이동 중...</h1>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    상태 페이지 주소가 관리자(/admin/) 페이지로 변경되었습니다.<br />
                    잠시 후 자동으로 이동합니다.
                </p>
                <div className="mt-6">
                    <Link
                        href="/admin/"
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-black text-white hover:bg-sky-400 transition"
                    >
                        <span>관리자 페이지 바로가기</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>
        </main>
    );
}
