import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import {
    Activity,
    ArrowLeft,
    BadgeCheck,
    CalendarClock,
    Database,
    LayoutGrid,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';
import ServiceStatusStrip from '@/components/performance/list/ServiceStatusStrip';
import {
    formatKoreanDateTime,
    getAvailableGenreCount,
    getQualityIssueCount,
    getQualityStatusLabel,
    getSourceFreshnessLabel,
    getSourceFreshnessTone,
    getSourceHealthStatusLabel,
} from '@/lib/build-info';
import { getDataBuildInfo } from '@/lib/performance-data';

export const metadata: Metadata = {
    title: '서비스 상태 | Culture Flow',
    description: 'Culture Flow의 최신 데이터 수집 상태, 콘텐츠 품질 점검 결과, 운영 카테고리 현황을 확인하세요.',
};

export const dynamic = 'force-static';

function SummaryCard({
    title,
    value,
    description,
    icon,
    tone = 'default',
}: {
    title: string;
    value: string;
    description: string;
    icon: ReactNode;
    tone?: 'default' | 'good' | 'warn';
}) {
    const toneClassName = {
        default: 'border-white/10 bg-white/5 text-white light:border-slate-200 light:bg-white light:text-slate-900',
        good: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-900',
        warn: 'border-amber-500/25 bg-amber-500/10 text-amber-50 light:border-amber-200 light:bg-amber-50 light:text-amber-900',
    }[tone];

    return (
        <article className={`rounded-3xl border p-5 shadow-sm ${toneClassName}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">{title}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
                </div>
                <div className="rounded-2xl bg-black/15 p-2.5 light:bg-white/70">
                    {icon}
                </div>
            </div>
            <p className="mt-3 text-sm opacity-80">{description}</p>
        </article>
    );
}

function getFreshnessBadgeClass(freshness: ReturnType<typeof getSourceFreshnessTone>) {
    return {
        good: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 light:border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700',
        default: 'border-white/10 bg-white/5 text-slate-200 light:border-slate-200 light:bg-slate-100 light:text-slate-700',
        muted: 'border-sky-500/25 bg-sky-500/10 text-sky-100 light:border-sky-500/20 light:bg-sky-50 light:text-sky-700',
        warn: 'border-amber-500/25 bg-amber-500/10 text-amber-100 light:border-amber-500/20 light:bg-amber-50 light:text-amber-700',
    }[freshness];
}

function formatAgeLabel(ageDays: number | null, seasonal: boolean) {
    if (seasonal) return '비시즌 포함';
    if (ageDays === null) return '경과 일수 미확인';
    if (ageDays === 0) return '오늘 갱신';
    if (ageDays === 1) return '1일 경과';
    return `${ageDays}일 경과`;
}

export default function StatusPage() {
    const buildInfo = getDataBuildInfo();

    if (!buildInfo) {
        return (
            <main className="min-h-screen bg-gray-950 px-4 py-10 text-white light:bg-slate-50 light:text-slate-900">
                <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 light:border-slate-200 light:bg-white">
                    <h1 className="text-2xl font-black">서비스 상태를 불러오지 못했습니다</h1>
                    <p className="mt-3 text-sm text-slate-300 light:text-slate-600">
                        운영 메타데이터가 아직 생성되지 않았거나, 현재 빌드에 상태 정보가 포함되지 않았습니다.
                    </p>
                </div>
            </main>
        );
    }

    const availableGenreCount = getAvailableGenreCount(buildInfo.genreCounts);
    const qualityIssueCount = getQualityIssueCount(buildInfo.qualitySummary);
    const sourceHealthSummary = buildInfo.sourceHealthSummary;
    const sortedSources = [...buildInfo.sourceSummaries].sort((a, b) => {
        const order = {
            stale: 0,
            unknown: 1,
            aging: 2,
            fresh: 3,
            offseason: 4,
        } as const;

        const priorityDiff = order[a.freshness] - order[b.freshness];
        if (priorityDiff !== 0) return priorityDiff;
        return b.itemCount - a.itemCount;
    });

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#050816_0%,_#0a0f1d_48%,_#09090b_100%)] px-4 py-6 text-white light:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_32%),linear-gradient(180deg,_#f8fbff_0%,_#f7f8fc_54%,_#eef2ff_100%)] light:text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl pb-24">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-sky-300/40 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-sky-300 light:hover:text-sky-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        홈으로 돌아가기
                    </Link>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 light:border-slate-200 light:bg-white light:text-slate-600">
                        최종 갱신 {formatKoreanDateTime(buildInfo.generatedAt)}
                    </div>
                </div>

                <section className="mt-8 rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl light:border-slate-200 light:bg-white/80">
                    <div className="max-w-3xl">
                        <p className="text-sm font-bold uppercase tracking-[0.32em] text-sky-300 light:text-sky-700">Service Status</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                            운영 상태를 사용자에게도 투명하게 보여주는 페이지입니다.
                        </h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300 light:text-slate-600 sm:text-base">
                            Culture Flow는 빈 카테고리를 숨기고, 링크·이미지·텍스트 누락은 최종 산출물 단계에서 보강한 뒤 배포합니다.
                            이 화면에서는 지금 어떤 소스가 최신인지, 비시즌인지, 품질 보강이 필요한지까지 직접 확인할 수 있습니다.
                        </p>
                    </div>

                    <div className="mt-6">
                        <ServiceStatusStrip
                            lastUpdated={`${formatKoreanDateTime(buildInfo.generatedAt)} `}
                            totalItemCount={buildInfo.itemCount}
                            availableGenreCount={availableGenreCount}
                            qualitySummary={buildInfo.qualitySummary}
                            sourceHealthSummary={sourceHealthSummary}
                        />
                    </div>
                </section>

                <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        title="전체 콘텐츠"
                        value={`${buildInfo.itemCount.toLocaleString()}건`}
                        description="최종 병합과 품질 보강을 통과한 현재 운영 데이터 기준 건수입니다."
                        icon={<Database className="h-5 w-5" />}
                    />
                    <SummaryCard
                        title="운영 카테고리"
                        value={`${availableGenreCount}개`}
                        description="빈 카테고리는 노출하지 않고, 실제 데이터가 있는 카테고리만 서비스에 표시합니다."
                        icon={<LayoutGrid className="h-5 w-5" />}
                    />
                    <SummaryCard
                        title="수집 소스 상태"
                        value={getSourceHealthStatusLabel(sourceHealthSummary)}
                        description={
                            sourceHealthSummary
                                ? `최신 ${sourceHealthSummary.freshCount}개 · 비시즌 ${sourceHealthSummary.offseasonCount}개 기준입니다.`
                                : '수집 소스 요약을 준비 중입니다.'
                        }
                        icon={<Activity className="h-5 w-5" />}
                        tone={sourceHealthSummary?.staleCount || sourceHealthSummary?.unknownCount ? 'warn' : 'good'}
                    />
                    <SummaryCard
                        title="콘텐츠 품질"
                        value={getQualityStatusLabel(buildInfo.qualitySummary)}
                        description={qualityIssueCount > 0 ? `현재 ${qualityIssueCount}건의 보강 필요 항목이 감지되었습니다.` : '링크, 설명, 이미지 품질 점검을 통과한 상태입니다.'}
                        icon={buildInfo.qualitySummary?.status === 'warn' ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                        tone={buildInfo.qualitySummary?.status === 'warn' ? 'warn' : 'good'}
                    />
                </section>

                <section className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/80">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">수집 소스 상세 상태</h2>
                                <p className="mt-2 text-sm text-slate-300 light:text-slate-600">
                                    문제가 생기면 먼저 보이게, 정상일 때는 왜 정상인지 알 수 있게 정리했습니다.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-200 light:bg-sky-100 light:text-sky-700">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {sortedSources.map((source) => {
                                const tone = getSourceFreshnessTone(source.freshness);

                                return (
                                    <article
                                        key={source.key}
                                        className="rounded-3xl border border-white/8 bg-black/20 p-5 transition hover:border-sky-300/25 hover:bg-black/25 light:border-slate-200 light:bg-white light:hover:border-sky-300"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-lg font-black tracking-tight">{source.label}</p>
                                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 light:text-slate-500">
                                                    {source.key}
                                                </p>
                                            </div>
                                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getFreshnessBadgeClass(tone)}`}>
                                                {getSourceFreshnessLabel(source.freshness)}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-2xl border border-white/8 bg-white/5 p-3 light:border-slate-200 light:bg-slate-50">
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 light:text-slate-500">콘텐츠 수</p>
                                                <p className="mt-2 text-xl font-black">{source.itemCount.toLocaleString()}건</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/8 bg-white/5 p-3 light:border-slate-200 light:bg-slate-50">
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 light:text-slate-500">상태 메모</p>
                                                <p className="mt-2 text-sm font-semibold">{formatAgeLabel(source.ageDays, source.seasonal)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-3 text-sm light:border-slate-200 light:bg-slate-50">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 light:text-slate-500">마지막 수집 시각</p>
                                            <p className="mt-2 font-semibold">{formatKoreanDateTime(source.updatedAt, '기록 없음')}</p>
                                            {source.seasonal && (
                                                <p className="mt-2 text-xs text-slate-400 light:text-slate-500">
                                                    시즌이 아닌 기간에는 카테고리를 서비스에서 숨깁니다.
                                                </p>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/80">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-200 light:bg-emerald-100 light:text-emerald-700">
                                    <BadgeCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black">운영 원칙</h2>
                                    <p className="mt-1 text-sm text-slate-300 light:text-slate-600">
                                        서비스 신뢰를 지키기 위해 화면 노출 기준을 명확히 둡니다.
                                    </p>
                                </div>
                            </div>
                            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200 light:text-slate-700">
                                <li>빈 카테고리는 메뉴, 사이트맵, 정적 경로에서 모두 숨깁니다.</li>
                                <li>수집기 원본이 비어도 링크·설명·포스터는 가능한 범위에서 자동 복구합니다.</li>
                                <li>영화를 포함한 핵심 장르는 품질 게이트를 통과해야만 배포됩니다.</li>
                            </ul>
                        </section>

                        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/80">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-200 light:bg-amber-100 light:text-amber-700">
                                    {buildInfo.qualitySummary?.status === 'warn' ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black">품질 점검 세부</h2>
                                    <p className="mt-1 text-sm text-slate-300 light:text-slate-600">
                                        배포 직전 기준으로 집계한 보강 지표입니다.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 grid gap-3 text-sm">
                                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>링크 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingLinkCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>설명 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingDescriptionCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>이미지 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingImageCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>깨진 로컬 포스터</span>
                                    <strong>{buildInfo.qualitySummary?.brokenLocalImageCount ?? 0}건</strong>
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </div>
        </main>
    );
}
