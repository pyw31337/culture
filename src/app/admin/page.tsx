import type { Metadata } from 'next';
import { getDataBuildInfo } from '@/lib/performance-data';
import ResetBodyScroll from '@/components/ResetBodyScroll';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const metadata: Metadata = {
    title: '관리자 페이지 | Culture Flow',
    description: 'Culture Flow 관리자 대시보드 - 데이터 수집 상태, 품질 지표 및 시스템 현황',
    robots: {
        index: false,
        follow: false,
    },
};

export const dynamic = 'force-static';

export default function AdminPage() {
    const buildInfo = getDataBuildInfo();

    if (!buildInfo) {
        return (
            <AdminAuthGuard>
                <main className="min-h-screen bg-slate-950 px-4 py-10 text-white light:bg-slate-50 light:text-slate-900">
                    <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8 light:border-slate-200 light:bg-white">
                        <h1 className="text-2xl font-black">서비스 상태를 불러오지 못했습니다</h1>
                        <p className="mt-3 text-sm leading-6 text-slate-300 light:text-slate-600">
                            운영 메타데이터가 아직 생성되지 않았거나, 현재 빌드에 상태 정보가 포함되지 않았습니다.
                        </p>
                    </div>
                </main>
            </AdminAuthGuard>
        );
    }

    return (
        <AdminAuthGuard>
            <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_32%),linear-gradient(180deg,_#06111f_0%,_#08131e_48%,_#0b1020_100%)] px-4 py-8 text-white light:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f7f8fc_52%,_#eef3ff_100%)] light:text-slate-900 sm:px-6 lg:px-8">
                <ResetBodyScroll />
                <div className="mx-auto max-w-7xl pb-24">
                    <AdminDashboard buildInfo={buildInfo} />
                </div>
            </main>
        </AdminAuthGuard>
    );
}
