import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import {
    Activity,
    ArrowLeft,
    CalendarClock,
    CircleCheckBig,
    Database,
    GitBranch,
    MapPinned,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';
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

function SnapshotLine({
    label,
    value,
    detail,
    icon,
}: {
    label: string;
    value: string;
    detail?: string;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-3xl border border-white/12 bg-white/6 px-4 py-4 light:border-slate-200 light:bg-slate-50">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-black/15 p-2 text-slate-200 light:bg-white light:text-slate-600">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">{label}</p>
                    <p className="mt-1 text-base font-black tracking-tight text-white light:text-slate-900">{value}</p>
                    {detail && (
                        <p className="mt-1 text-sm leading-6 text-slate-300 light:text-slate-600">{detail}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function LegendRow({
    title,
    description,
    tone,
}: {
    title: string;
    description: string;
    tone: 'good' | 'default' | 'warn' | 'muted';
}) {
    const toneClassName = {
        good: 'bg-emerald-500',
        default: 'bg-slate-400',
        warn: 'bg-amber-500',
        muted: 'bg-sky-500',
    }[tone];

    return (
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
            <span className={`mt-2 block h-2.5 w-2.5 rounded-full ${toneClassName}`} />
            <div>
                <p className="text-sm font-bold text-white light:text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300 light:text-slate-600">{description}</p>
            </div>
        </div>
    );
}

function getFreshnessBadgeClass(tone: ReturnType<typeof getSourceFreshnessTone>) {
    return {
        good: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 light:border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700',
        default: 'border-slate-500/20 bg-slate-500/10 text-slate-200 light:border-slate-300 light:bg-slate-100 light:text-slate-700',
        muted: 'border-sky-500/25 bg-sky-500/10 text-sky-100 light:border-sky-500/20 light:bg-sky-50 light:text-sky-700',
        warn: 'border-amber-500/25 bg-amber-500/10 text-amber-100 light:border-amber-500/20 light:bg-amber-50 light:text-amber-700',
    }[tone];
}

function formatAgeLabel(ageDays: number | null, seasonal: boolean) {
    if (seasonal) return '비시즌에 따라 노출을 자동 조정합니다.';
    if (ageDays === null) return '경과 일수를 계산할 수 없습니다.';
    if (ageDays === 0) return '오늘 갱신된 소스입니다.';
    if (ageDays === 1) return '1일 경과했습니다.';
    return `${ageDays}일 경과했습니다.`;
}

export default function StatusPage() {
    const buildInfo = getDataBuildInfo();

    if (!buildInfo) {
        return (
            <main className="min-h-screen bg-slate-950 px-4 py-10 text-white light:bg-slate-50 light:text-slate-900">
                <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8 light:border-slate-200 light:bg-white">
                    <h1 className="text-2xl font-black">서비스 상태를 불러오지 못했습니다</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-300 light:text-slate-600">
                        운영 메타데이터가 아직 생성되지 않았거나, 현재 빌드에 상태 정보가 포함되지 않았습니다.
                    </p>
                </div>
            </main>
        );
    }

    const availableGenreCount = getAvailableGenreCount(buildInfo.genreCounts);
    const qualityIssueCount = getQualityIssueCount(buildInfo.qualitySummary);
    const displayIntegritySummary = buildInfo.displayIntegritySummary;
    const displayIntegrityWarningCount = displayIntegritySummary
        ? displayIntegritySummary.bracketLocationMismatchCount +
            displayIntegritySummary.unknownPriceCount +
            displayIntegritySummary.invalidDateCount +
            displayIntegritySummary.duplicateTimeCount +
            displayIntegritySummary.outOfSeasonCount
        : 0;
    const displayIntegrityStatusLabel = displayIntegritySummary
        ? displayIntegritySummary.blockingIssueCount > 0
            ? `표시 정합성 차단 ${displayIntegritySummary.blockingIssueCount}건`
            : displayIntegrityWarningCount > 0
                ? `표시 정합성 참고 ${displayIntegrityWarningCount}건`
                : '표시 정합성 통과'
        : '표시 정합성 점검 준비 중';
    const sourceHealthSummary = buildInfo.sourceHealthSummary;
    const sourceOverviewText = sourceHealthSummary
        ? [
            sourceHealthSummary.freshCount > 0 ? `최신 ${sourceHealthSummary.freshCount}개` : null,
            sourceHealthSummary.agingCount > 0 ? `관찰 ${sourceHealthSummary.agingCount}개` : null,
            sourceHealthSummary.staleCount > 0 ? `점검 ${sourceHealthSummary.staleCount}개` : null,
            sourceHealthSummary.offseasonCount > 0 ? `비시즌 ${sourceHealthSummary.offseasonCount}개` : null,
        ].filter(Boolean).join(' · ')
        : '수집 소스 요약을 준비 중입니다.';
    const sourceFunnelSummary = buildInfo.sourceFunnelSummary;
    const sourceFunnelStatusLabel = sourceFunnelSummary
        ? sourceFunnelSummary.status === 'warn'
            ? `퍼널 점검 ${sourceFunnelSummary.highLossSourceCount + sourceFunnelSummary.noFinalOutputSourceCount + sourceFunnelSummary.unregisteredDataFileCount}건`
            : '소스 퍼널 정상'
        : '소스 퍼널 점검 준비 중';
    const sourceFunnelDetail = sourceFunnelSummary
        ? `raw ${sourceFunnelSummary.rawItemCount.toLocaleString()}건 → 운영 ${sourceFunnelSummary.finalItemCount.toLocaleString()}건 · 활성 소스 ${sourceFunnelSummary.activeSourceCount}개`
        : 'raw 수집 데이터가 최종 산출물에 어떻게 반영되는지 추적합니다.';
    const venueCanonicalizationSummary = buildInfo.venueCanonicalizationSummary;
    const venueCanonicalizationStatusLabel = venueCanonicalizationSummary
        ? venueCanonicalizationSummary.status === 'warn'
            ? `공연장 표준화 후보 ${venueCanonicalizationSummary.highConfidenceMergeCandidateCount + venueCanonicalizationSummary.reviewCandidateCount}건`
            : '공연장 표준화 정상'
        : '공연장 표준화 점검 준비 중';
    const venueCanonicalizationDetail = venueCanonicalizationSummary
        ? `사용 공연장 ${venueCanonicalizationSummary.usedVenueCount.toLocaleString()}개 · 고신뢰 통합 ${venueCanonicalizationSummary.highConfidenceMergeCandidateCount}건 · 좌표 재확인 ${venueCanonicalizationSummary.coordinateRiskGroupCount}건`
        : '공식명칭, 주소, 좌표, 하위홀 관계를 함께 점검합니다.';

    const sortedSources = [...buildInfo.sourceSummaries].sort((a, b) => {
        const order = {
            stale: 0,
            unknown: 1,
            aging: 2,
            fresh: 3,
            offseason: 4,
        } as const;

        const diff = order[a.freshness] - order[b.freshness];
        if (diff !== 0) return diff;
        return b.itemCount - a.itemCount;
    });

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_#06111f_0%,_#08131e_48%,_#0b1020_100%)] px-4 py-6 text-white light:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f7f8fc_52%,_#eef3ff_100%)] light:text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl pb-24">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-sky-300/35 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-sky-300 light:hover:text-sky-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        홈으로 돌아가기
                    </Link>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 light:border-slate-200 light:bg-white light:text-slate-600">
                        최종 갱신 {formatKoreanDateTime(buildInfo.generatedAt)}
                    </div>
                </div>

                <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[2.25rem] border border-white/10 bg-black/25 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl light:border-slate-200 light:bg-white/80 sm:p-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-sky-300 light:text-sky-700">Service Status</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-[2.8rem] sm:leading-[1.05]">
                            운영 상태를 과장 없이, 읽기 쉽게 보여주는 페이지로 정리했습니다.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 light:text-slate-600 sm:text-base">
                            Culture Flow는 빈 카테고리를 숨기고, 링크·이미지·텍스트가 비어 있는 콘텐츠는 최종 산출물 단계에서 먼저 보강합니다.
                            여기서는 지금 어떤 소스가 최신인지, 어떤 소스가 조금 늦는지, 품질 점검은 통과했는지를 한 화면에서 확인할 수 있습니다.
                        </p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <SnapshotLine
                                label="운영 범위"
                                value={`전체 ${buildInfo.itemCount.toLocaleString()}건 · 카테고리 ${availableGenreCount}개`}
                                detail="실제로 노출 가능한 콘텐츠만 남긴 현재 운영 기준입니다."
                                icon={<Database className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="수집 상태"
                                value={getSourceHealthStatusLabel(sourceHealthSummary)}
                                detail={sourceOverviewText}
                                icon={<Activity className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="콘텐츠 품질"
                                value={getQualityStatusLabel(buildInfo.qualitySummary)}
                                detail={qualityIssueCount > 0 ? `총 ${qualityIssueCount}건의 보강 필요 항목이 감지되었습니다.` : '링크, 설명, 이미지 핵심 검증을 통과했습니다.'}
                                icon={buildInfo.qualitySummary?.status === 'warn' ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="표시 정합성"
                                value={displayIntegrityStatusLabel}
                                detail={displayIntegritySummary
                                    ? `위치 충돌 ${displayIntegritySummary.locationMismatchCount}건 · 무료 오표기 의심 ${displayIntegritySummary.suspiciousFreePriceCount}건 · 시간 중복 ${displayIntegritySummary.duplicateTimeCount}건`
                                    : '장소, 가격, 날짜, 시간 중복을 표시 기준으로 점검합니다.'}
                                icon={displayIntegritySummary?.blockingIssueCount ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="소스 퍼널"
                                value={sourceFunnelStatusLabel}
                                detail={sourceFunnelDetail}
                                icon={sourceFunnelSummary?.status === 'warn' ? <GitBranch className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="공연장 표준화"
                                value={venueCanonicalizationStatusLabel}
                                detail={venueCanonicalizationDetail}
                                icon={venueCanonicalizationSummary?.status === 'warn' ? <MapPinned className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            />
                            <SnapshotLine
                                label="갱신 시각"
                                value={formatKoreanDateTime(buildInfo.generatedAt)}
                                detail="빌드에 반영된 최신 데이터 생성 시각입니다."
                                icon={<CalendarClock className="h-4 w-4" />}
                            />
                        </div>
                    </div>

                    <div className="rounded-[2.25rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/85 sm:p-8">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-200 light:bg-emerald-100 light:text-emerald-700">
                                <CircleCheckBig className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-black">이번 운영 상태 한줄 요약</p>
                                <p className="mt-1 text-sm leading-6 text-slate-300 light:text-slate-600">
                                    사용자가 믿고 써도 되는 수준인지 빠르게 판단할 수 있게 정리했습니다.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="border-b border-white/10 pb-4 light:border-slate-200">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">현재 상태</p>
                                <p className="mt-2 text-xl font-black tracking-tight">{getSourceHealthStatusLabel(sourceHealthSummary)}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">{sourceOverviewText}</p>
                            </div>
                            <div className="border-b border-white/10 pb-4 light:border-slate-200">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">품질 게이트</p>
                                <p className="mt-2 text-xl font-black tracking-tight">{getQualityStatusLabel(buildInfo.qualitySummary)}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">
                                    {buildInfo.qualitySummary?.status === 'warn'
                                        ? `배포 전 보강이 필요한 항목 ${qualityIssueCount}건이 감지되었습니다.`
                                        : '핵심 링크, 설명, 이미지 검증을 통과한 상태입니다.'}
                                </p>
                            </div>
                            <div className="border-b border-white/10 pb-4 light:border-slate-200">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">표시 정합성</p>
                                <p className="mt-2 text-xl font-black tracking-tight">{displayIntegrityStatusLabel}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">
                                    {displayIntegritySummary
                                        ? `장소/주소 충돌, 무료 뱃지 오표기, 날짜 해석, 시간 중복, 비시즌 노출을 함께 점검합니다. 차단 이슈는 ${displayIntegritySummary.blockingIssueCount}건입니다.`
                                        : '다음 데이터 생성부터 표시 정합성 요약이 함께 노출됩니다.'}
                                </p>
                            </div>
                            <div className="border-b border-white/10 pb-4 light:border-slate-200">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">데이터 퍼널</p>
                                <p className="mt-2 text-xl font-black tracking-tight">{sourceFunnelStatusLabel}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">{sourceFunnelDetail}</p>
                            </div>
                            <div className="border-b border-white/10 pb-4 light:border-slate-200">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">공연장/좌표</p>
                                <p className="mt-2 text-xl font-black tracking-tight">{venueCanonicalizationStatusLabel}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">{venueCanonicalizationDetail}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">운영 원칙</p>
                                <div className="mt-2 space-y-2 text-sm leading-6 text-slate-300 light:text-slate-600">
                                    <p>빈 카테고리는 메뉴와 사이트맵에서 함께 숨깁니다.</p>
                                    <p>원본이 비어도 링크·설명·포스터는 가능한 범위에서 자동 복구합니다.</p>
                                    <p>비시즌 스포츠는 오류가 아니라 의도된 숨김 상태로 구분합니다.</p>
                                    <p>공연장은 좌표만 보고 합치지 않고 공식 placeId와 도로명주소를 우선합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-[2.25rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/85 sm:p-8">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-300 light:text-sky-700">Source Ledger</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight">소스별 마지막 수집 상태</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">
                                    먼저 점검이 필요한 소스가 위로 오도록 정렬했습니다. 읽는 방식은 단순합니다. 상태, 마지막 수집 시각, 현재 반영 건수를 같이 보면 됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            {sortedSources.map((source) => {
                                const tone = getSourceFreshnessTone(source.freshness);

                                return (
                                    <article
                                        key={source.key}
                                        className="rounded-3xl border border-white/10 bg-black/18 px-4 py-4 transition hover:border-sky-300/25 light:border-slate-200 light:bg-white"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-lg font-black tracking-tight">{source.label}</p>
                                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 light:text-slate-500">{source.key}</p>
                                            </div>
                                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getFreshnessBadgeClass(tone)}`}>
                                                {getSourceFreshnessLabel(source.freshness)}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-2 text-sm text-slate-200 light:text-slate-700">
                                            <p>
                                                마지막 수집 시각은 <strong>{formatKoreanDateTime(source.updatedAt, '기록 없음')}</strong> 입니다.
                                            </p>
                                            <p>
                                                현재 운영 산출물에는 <strong>{source.itemCount.toLocaleString()}건</strong>이 반영되어 있습니다.
                                            </p>
                                            <p className="text-slate-400 light:text-slate-500">
                                                {formatAgeLabel(source.ageDays, source.seasonal)}
                                            </p>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/85">
                            <h2 className="text-xl font-black">상태 읽는 법</h2>
                            <div className="mt-5 space-y-3">
                                <LegendRow title="최신" description="최근 기준 안에서 정상적으로 갱신된 소스입니다." tone="good" />
                                <LegendRow title="관찰" description="바로 문제라고 보긴 어렵지만, 업데이트 주기를 보고 있는 소스입니다." tone="default" />
                                <LegendRow title="점검 필요" description="기대 주기보다 오래 멈춰 있어 우선 확인이 필요한 소스입니다." tone="warn" />
                                <LegendRow title="비시즌" description="스포츠처럼 시즌이 아닐 때 의도적으로 비노출 처리하는 상태입니다." tone="muted" />
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/85">
                            <h2 className="text-xl font-black">품질 보강 현황</h2>
                            <div className="mt-5 space-y-3 text-sm">
                                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>링크 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingLinkCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>설명 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingDescriptionCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>이미지 누락</span>
                                    <strong>{buildInfo.qualitySummary?.missingImageCount ?? 0}건</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <span>깨진 로컬 포스터</span>
                                    <strong>{buildInfo.qualitySummary?.brokenLocalImageCount ?? 0}건</strong>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white/85">
                            <h2 className="text-xl font-black">정합성 감사 현황</h2>
                            <div className="mt-5 space-y-3 text-sm">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <div className="flex items-center justify-between gap-3">
                                        <span>미등록 수집 데이터</span>
                                        <strong>{sourceFunnelSummary?.unregisteredDataFileCount ?? 0}개</strong>
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-400 light:text-slate-500">
                                        수집은 됐지만 운영 레지스트리에 연결되지 않은 파일을 찾습니다.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <div className="flex items-center justify-between gap-3">
                                        <span>고신뢰 공연장 통합 후보</span>
                                        <strong>{venueCanonicalizationSummary?.highConfidenceMergeCandidateCount ?? 0}건</strong>
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-400 light:text-slate-500">
                                        같은 주소와 유사 명칭을 먼저 묶고, 공식 장소 검색으로 최종 확정합니다.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                    <div className="flex items-center justify-between gap-3">
                                        <span>좌표 fallback 의심</span>
                                        <strong>{venueCanonicalizationSummary?.coordinateRiskGroupCount ?? 0}그룹</strong>
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-400 light:text-slate-500">
                                        여러 장소가 같은 좌표를 공유하면 자동 병합하지 않고 재검색 대상으로 분리합니다.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </div>
        </main>
    );
}
