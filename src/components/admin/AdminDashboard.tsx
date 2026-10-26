'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    Building2,
    Calendar,
    CalendarClock,
    Check,
    CheckCircle2,
    Clock,
    Coins,
    Database,
    ExternalLink,
    Filter,
    Flame,
    GitBranch,
    Grid,
    HelpCircle,
    Image as ImageIcon,
    Info,
    Landmark,
    Layers,
    LayoutGrid,
    List,
    MapPin,
    MapPinned,
    RefreshCw,
    Search,
    SearchCheck,
    Server,
    Shield,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Ticket,
    Workflow,
    Zap,
} from 'lucide-react';
import type { DataBuildInfo, DataSourceSummary } from '@/lib/build-info';
import {
    formatKoreanDateTime,
    getAvailableGenreCount,
    getQualityIssueCount,
    getQualityStatusLabel,
    getSourceFreshnessLabel,
    getSourceFreshnessTone,
    getSourceHealthStatusLabel,
} from '@/lib/build-info';

interface AdminDashboardProps {
    buildInfo: DataBuildInfo;
}

const GENRE_LABELS: Record<string, string> = {
    classic_tradition: '클래식/전통',
    exhibition: '전시/행사',
    museum: '박물관/체험관',
    musical: '뮤지컬',
    concert: '콘서트',
    activity: '액티비티',
    play: '연극',
    class: '클래스',
    tourism: '관광/여행',
    basketball: '농구',
    volleyball: '배구',
    movie: '영화',
    handball: '핸드볼',
    soccer: '축구',
    baseball: '야구',
    etc: '기타',
};

const GENRE_COLORS: Record<string, string> = {
    classic_tradition: '#f59e0b',
    exhibition: '#a855f7',
    museum: '#10b981',
    musical: '#f43f5e',
    concert: '#3b82f6',
    activity: '#06b6d4',
    play: '#22c55e',
    class: '#6366f1',
    tourism: '#14b8a6',
    basketball: '#f97316',
    volleyball: '#84cc16',
    movie: '#0ea5e9',
    handball: '#eab308',
    soccer: '#ef4444',
    baseball: '#2563eb',
    etc: '#94a3b8',
};

// SVG 원형 도넛/게이지 컴포넌트
function DonutSegment({
    percentage,
    strokeColor,
    strokeWidth = 8,
    radius = 38,
    offset = 0,
}: {
    percentage: number;
    strokeColor: string;
    strokeWidth?: number;
    radius?: number;
    offset?: number;
}) {
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((offset / 100) * circumference);

    return (
        <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
        />
    );
}

function CircularProgress({
    value,
    max = 100,
    label,
    sublabel,
    size = 110,
    strokeWidth = 10,
    color = '#38bdf8',
    bgColor = 'rgba(255, 255, 255, 0.08)',
    centerContent,
}: {
    value: number;
    max?: number;
    label?: string;
    sublabel?: string;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
    centerContent?: React.ReactNode;
}) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

    return (
        <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={bgColor}
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={0}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {centerContent || (
                        <>
                            <span className="text-xl font-black tracking-tight text-white light:text-slate-900">
                                {Math.round(percentage)}%
                            </span>
                        </>
                    )}
                </div>
            </div>
            {label && (
                <span className="mt-2 text-xs font-bold text-slate-300 light:text-slate-700">{label}</span>
            )}
            {sublabel && (
                <span className="text-[11px] text-slate-400 light:text-slate-500">{sublabel}</span>
            )}
        </div>
    );
}

export default function AdminDashboard({ buildInfo }: AdminDashboardProps) {
    const [selectedTab, setSelectedTab] = useState<'overview' | 'sources' | 'quality' | 'venues' | 'system'>('overview');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'fresh' | 'aging' | 'stale' | 'offseason'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceSort, setSourceSort] = useState<'items' | 'freshness' | 'name'>('freshness');
    const [sourceViewMode, setSourceViewMode] = useState<'grid' | 'table'>('grid');

    const availableGenreCount = getAvailableGenreCount(buildInfo.genreCounts);
    const qualityIssueCount = getQualityIssueCount(buildInfo.qualitySummary);
    const sourceHealth = buildInfo.sourceHealthSummary;
    const priceSummary = buildInfo.priceCoverageSummary;
    const integritySummary = buildInfo.displayIntegritySummary;
    const funnelSummary = buildInfo.sourceFunnelSummary;
    const oppSummary = buildInfo.sourceQualityOpportunitySummary;
    const venueCanonical = buildInfo.venueCanonicalizationSummary;
    const venueMaster = buildInfo.venueMasterSummary;
    const venueMatching = buildInfo.venuePlaceMatchingSummary;
    const opsSummary = buildInfo.operationsSummary;

    // 카테고리 데이터 가공 & 정렬
    const sortedGenres = useMemo(() => {
        return Object.entries(buildInfo.genreCounts || {})
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a);
    }, [buildInfo.genreCounts]);

    const maxGenreCount = sortedGenres[0]?.[1] || 1;

    // 소스 필터 및 정렬
    const filteredSources = useMemo(() => {
        let list = [...buildInfo.sourceSummaries];

        if (sourceFilter !== 'all') {
            list = list.filter((s) => s.freshness === sourceFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (s) =>
                    s.label.toLowerCase().includes(q) ||
                    s.key.toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            if (sourceSort === 'items') {
                return b.itemCount - a.itemCount;
            }
            if (sourceSort === 'name') {
                return a.label.localeCompare(b.label, 'ko');
            }
            // freshness order
            const order: Record<string, number> = {
                stale: 0,
                unknown: 1,
                aging: 2,
                fresh: 3,
                offseason: 4,
            };
            const diff = (order[a.freshness] ?? 5) - (order[b.freshness] ?? 5);
            if (diff !== 0) return diff;
            return b.itemCount - a.itemCount;
        });

        return list;
    }, [buildInfo.sourceSummaries, sourceFilter, searchQuery, sourceSort]);

    // 전체 소스 건강도 비율 계산
    const totalSources = sourceHealth?.totalSources || buildInfo.sourceSummaries.length || 1;
    const freshPct = Math.round(((sourceHealth?.freshCount || 0) / totalSources) * 100);
    const agingPct = Math.round(((sourceHealth?.agingCount || 0) / totalSources) * 100);
    const stalePct = Math.round(((sourceHealth?.staleCount || 0) / totalSources) * 100);
    const offseasonPct = Math.round(((sourceHealth?.offseasonCount || 0) / totalSources) * 100);

    // 품질 통과 점수
    const qualityTotal = buildInfo.itemCount || 1;
    const qualityDefects = qualityIssueCount;
    const qualityScore = Math.max(0, Math.round(((qualityTotal - qualityDefects) / qualityTotal) * 100));

    // 가격 커버리지
    const priceRate = Math.round((priceSummary?.coverageRate || 0) * 100);

    return (
        <div className="space-y-8">
            {/* 1. 상단 브레드크럼 & 헤더 배너 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-sky-400/40 hover:bg-white/10 hover:text-white light:border-slate-300 light:bg-white light:text-slate-700 light:hover:border-sky-400"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>홈으로</span>
                    </Link>
                    <div className="flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-300 light:border-sky-300 light:bg-sky-50 light:text-sky-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                        </span>
                        <span>실시간 운영 대시보드</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 light:text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>최종 데이터 갱신: </span>
                    <strong className="text-slate-200 light:text-slate-800">
                        {formatKoreanDateTime(buildInfo.generatedAt)}
                    </strong>
                </div>
            </div>

            {/* 2. 대시보드 내비게이션 탭 바 */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 light:border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedTab('overview')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                            selectedTab === 'overview'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700'
                        }`}
                    >
                        <BarChart3 className="h-4 w-4" />
                        <span>통합 개요</span>
                    </button>
                    <button
                        onClick={() => setSelectedTab('sources')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                            selectedTab === 'sources'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700'
                        }`}
                    >
                        <Database className="h-4 w-4" />
                        <span>수집 소스 ({buildInfo.sourceSummaries.length})</span>
                    </button>
                    <button
                        onClick={() => setSelectedTab('quality')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                            selectedTab === 'quality'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700'
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        <span>품질 & 정합성</span>
                        {qualityIssueCount > 0 && (
                            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 light:bg-amber-100 light:text-amber-800">
                                {qualityIssueCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setSelectedTab('venues')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                            selectedTab === 'venues'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700'
                        }`}
                    >
                        <Landmark className="h-4 w-4" />
                        <span>공연장 & 마스터</span>
                    </button>
                    <button
                        onClick={() => setSelectedTab('system')}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                            selectedTab === 'system'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700'
                        }`}
                    >
                        <Server className="h-4 w-4" />
                        <span>운영 & 자동화</span>
                    </button>
                </div>
            </div>

            {/* 3. 상단 핵심 KPI 통계 카드 4종 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 카드 1: 전체 운영 콘텐츠 */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-xl backdrop-blur-xl transition hover:border-sky-400/30 light:border-slate-200 light:bg-white light:shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 light:text-slate-500">
                            운영 콘텐츠
                        </span>
                        <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400 light:bg-blue-50 light:text-blue-600">
                            <Layers className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-white light:text-slate-900">
                                {buildInfo.itemCount.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-400">건</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
                                <Sparkles className="h-3 w-3" />
                                {availableGenreCount}개 카테고리
                            </span>
                            <span className="text-[11px] text-slate-400 light:text-slate-500">
                                총 {buildInfo.sourceSummaries.length}개 소스
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10 light:bg-slate-100">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
                    </div>
                </div>

                {/* 카드 2: 수집 소스 건강도 */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-xl backdrop-blur-xl transition hover:border-emerald-400/30 light:border-slate-200 light:bg-white light:shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 light:text-slate-500">
                            소스 건강도
                        </span>
                        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 light:bg-emerald-50 light:text-emerald-600">
                            <Activity className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-white light:text-slate-900">
                                {freshPct}%
                            </span>
                            <span className="text-xs font-bold text-emerald-400">최신 정상</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300 light:bg-emerald-100 light:text-emerald-800">
                                최신 {sourceHealth?.freshCount ?? 0}
                            </span>
                            <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300 light:bg-amber-100 light:text-amber-800">
                                관찰 {sourceHealth?.agingCount ?? 0}
                            </span>
                            {(sourceHealth?.staleCount ?? 0) > 0 ? (
                                <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 font-bold text-rose-300 light:bg-rose-100 light:text-rose-800">
                                    점검 {sourceHealth?.staleCount}
                                </span>
                            ) : (
                                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-slate-400 light:bg-slate-100">
                                    점검 0
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10 light:bg-slate-100">
                        <div style={{ width: `${freshPct}%` }} className="bg-emerald-500" />
                        <div style={{ width: `${agingPct}%` }} className="bg-amber-500" />
                        <div style={{ width: `${stalePct}%` }} className="bg-rose-500" />
                        <div style={{ width: `${offseasonPct}%` }} className="bg-sky-400" />
                    </div>
                </div>

                {/* 카드 3: 콘텐츠 품질 지수 */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-xl backdrop-blur-xl transition hover:border-purple-400/30 light:border-slate-200 light:bg-white light:shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 light:text-slate-500">
                            품질 신뢰도
                        </span>
                        <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400 light:bg-purple-50 light:text-purple-600">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-white light:text-slate-900">
                                {qualityScore}%
                            </span>
                            <span className="text-xs font-bold text-slate-400">통과</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            {qualityIssueCount > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300 light:bg-amber-50 light:text-amber-700">
                                    <AlertTriangle className="h-3 w-3" />
                                    이미지 보강 {buildInfo.qualitySummary?.missingImageCount || 0}건
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    전체 검증 완료
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10 light:bg-slate-100">
                        <div
                            style={{ width: `${qualityScore}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400"
                        />
                    </div>
                </div>

                {/* 카드 4: 가격 커버리지 */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-xl backdrop-blur-xl transition hover:border-amber-400/30 light:border-slate-200 light:bg-white light:shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 light:text-slate-500">
                            가격 식별률
                        </span>
                        <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 light:bg-amber-50 light:text-amber-600">
                            <Ticket className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-white light:text-slate-900">
                                {priceRate}%
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                ({priceSummary?.pricedCount.toLocaleString() ?? 0}건)
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 light:text-slate-500">
                            <span>보강 필요:</span>
                            <strong className="text-amber-300 light:text-amber-700">
                                {priceSummary?.actionableUnknownCount.toLocaleString() ?? 0}건
                            </strong>
                        </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10 light:bg-slate-100">
                        <div
                            style={{ width: `${priceRate}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                        />
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: 통합 개요 (Overview)                                     */}
            {/* ============================================================== */}
            {(selectedTab === 'overview' || selectedTab === 'sources') && (
                <div className="space-y-8">
                    {/* 그래픽 시각화 섹션: 카테고리 분포 바 차트 + 소스 건강도 도넛 차트 */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* 1. 카테고리별 콘텐츠 수량 랭킹 (바 차트) */}
                        <div className="lg:col-span-2 rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b border-white/10 pb-4 light:border-slate-100">
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-sky-400" />
                                        카테고리별 콘텐츠 수량 분포
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                        총 {buildInfo.itemCount.toLocaleString()}건의 실시간 카테고리 비중
                                    </p>
                                </div>
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300 light:bg-slate-100 light:text-slate-700">
                                    {sortedGenres.length}개 분야
                                </span>
                            </div>

                            <div className="mt-6 space-y-3.5">
                                {sortedGenres.map(([genreKey, count]) => {
                                    const label = GENRE_LABELS[genreKey] || genreKey;
                                    const color = GENRE_COLORS[genreKey] || '#38bdf8';
                                    const percent = ((count / buildInfo.itemCount) * 100).toFixed(1);
                                    const barWidth = Math.max(4, Math.round((count / maxGenreCount) * 100));

                                    return (
                                        <div key={genreKey} className="group">
                                            <div className="flex items-center justify-between text-xs font-semibold">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="text-slate-200 group-hover:text-white light:text-slate-800 transition">
                                                        {label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 uppercase">
                                                        ({genreKey})
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono">
                                                    <strong className="text-white light:text-slate-900">
                                                        {count.toLocaleString()}건
                                                    </strong>
                                                    <span className="text-[11px] text-slate-400 light:text-slate-500 w-11 text-right">
                                                        {percent}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5 light:bg-slate-100">
                                                <div
                                                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                                                    className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. 소스 상태 도넛 게이지 & 요약 */}
                        <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl">
                            <div>
                                <div className="border-b border-white/10 pb-4 light:border-slate-100">
                                    <h3 className="text-base font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-emerald-400" />
                                        수집 파이프라인 상태
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                        27개 데이터 소스 갱신 주기 모니터링
                                    </p>
                                </div>

                                {/* 도넛 차트 */}
                                <div className="mt-6 flex justify-center py-2">
                                    <div className="relative h-44 w-44">
                                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                                            {/* 기본 배경 링 */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="38"
                                                fill="transparent"
                                                stroke="rgba(255, 255, 255, 0.08)"
                                                strokeWidth="10"
                                            />
                                            {/* 최신 세그먼트 */}
                                            {freshPct > 0 && (
                                                <DonutSegment
                                                    percentage={freshPct}
                                                    strokeColor="#10b981"
                                                    strokeWidth={10}
                                                    offset={0}
                                                />
                                            )}
                                            {/* 관찰 세그먼트 */}
                                            {agingPct > 0 && (
                                                <DonutSegment
                                                    percentage={agingPct}
                                                    strokeColor="#f59e0b"
                                                    strokeWidth={10}
                                                    offset={freshPct}
                                                />
                                            )}
                                            {/* 점검필요 세그먼트 */}
                                            {stalePct > 0 && (
                                                <DonutSegment
                                                    percentage={stalePct}
                                                    strokeColor="#ef4444"
                                                    strokeWidth={10}
                                                    offset={freshPct + agingPct}
                                                />
                                            )}
                                            {/* 비시즌 세그먼트 */}
                                            {offseasonPct > 0 && (
                                                <DonutSegment
                                                    percentage={offseasonPct}
                                                    strokeColor="#38bdf8"
                                                    strokeWidth={10}
                                                    offset={freshPct + agingPct + stalePct}
                                                />
                                            )}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                            <span className="text-2xl font-black text-white light:text-slate-900">
                                                {sourceHealth?.freshCount ?? 0}
                                                <span className="text-xs font-normal text-slate-400">/{totalSources}</span>
                                            </span>
                                            <span className="text-[11px] font-bold text-emerald-400">정상 수집</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 범례 (Legend) */}
                                <div className="mt-4 space-y-2 text-xs">
                                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 light:bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-emerald-500" />
                                            <span className="font-bold text-white light:text-slate-800">최신 (Fresh)</span>
                                        </div>
                                        <span className="font-mono font-bold text-emerald-400">
                                            {sourceHealth?.freshCount ?? 0}개 ({freshPct}%)
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 light:bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-amber-500" />
                                            <span className="font-bold text-white light:text-slate-800">관찰 (Aging)</span>
                                        </div>
                                        <span className="font-mono font-bold text-amber-400">
                                            {sourceHealth?.agingCount ?? 0}개 ({agingPct}%)
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 light:bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-rose-500" />
                                            <span className="font-bold text-white light:text-slate-800">점검 필요 (Stale)</span>
                                        </div>
                                        <span className="font-mono font-bold text-rose-400">
                                            {sourceHealth?.staleCount ?? 0}개 ({stalePct}%)
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 light:bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-sky-400" />
                                            <span className="font-bold text-white light:text-slate-800">비시즌 (Offseason)</span>
                                        </div>
                                        <span className="font-mono font-bold text-sky-400">
                                            {sourceHealth?.offseasonCount ?? 0}개 ({offseasonPct}%)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 상태 가이드 팁 */}
                            <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200 light:border-sky-300 light:bg-sky-50 light:text-sky-800">
                                <div className="flex items-center gap-1.5 font-bold mb-1">
                                    <Sparkles className="h-4 w-4" />
                                    <span>자동화 시스템 운영 가이드</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-sky-200/80 light:text-sky-700">
                                    자정 스케줄러가 실패할 경우 GitHub Actions가 fallback 수집을 수행하여 무중단 상태를 유지합니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 데이터 파이프라인 퍼널 시각화 (Raw ➡️ 정제 ➡️ 최종 운영 산출물) */}
                    {funnelSummary && (
                        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-slate-900/40 p-6 backdrop-blur-xl light:border-slate-200 light:bg-slate-50">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-4 light:border-slate-200">
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                        <Workflow className="h-5 w-5 text-purple-400" />
                                        데이터 수집 & 파이프라인 퍼널 (Funnel)
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                                        원천 Raw 데이터가 정제 및 중복제거를 거쳐 최종 서비스에 도달하는 흐름
                                    </p>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                    funnelSummary.status === 'pass'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}>
                                    {funnelSummary.status === 'pass' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                    <span>{funnelSummary.status === 'pass' ? '퍼널 정상 가동' : '퍼널 점검 필요'}</span>
                                </span>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                                {/* 스텝 1: 원천 수집 (Raw) */}
                                <div className="relative rounded-2xl border border-white/10 bg-black/25 p-5 light:border-slate-200 light:bg-white">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                                        <span>STEP 1. 원천 데이터 (Raw)</span>
                                        <Database className="h-4 w-4 text-sky-400" />
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-2xl font-black text-white light:text-slate-900">
                                            {funnelSummary.rawItemCount.toLocaleString()}
                                        </span>
                                        <span className="ml-1 text-xs font-medium text-slate-400">건 수집</span>
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-400 light:text-slate-500">
                                        등록 소스 {funnelSummary.registeredSourceCount}개 · 활성 {funnelSummary.activeSourceCount}개
                                    </p>
                                </div>

                                {/* 스텝 2: 정제 & 정합성 검증 */}
                                <div className="relative rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 light:border-purple-200 light:bg-purple-50/50">
                                    <div className="flex items-center justify-between text-xs font-bold text-purple-300 light:text-purple-700">
                                        <span>STEP 2. 정제 & 표준화</span>
                                        <SlidersHorizontal className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-2xl font-black text-white light:text-slate-900">
                                            100%
                                        </span>
                                        <span className="ml-1 text-xs font-medium text-purple-300 light:text-purple-700">무결성 검사</span>
                                    </div>
                                    <p className="mt-2 text-[11px] text-purple-200/80 light:text-purple-600">
                                        장소 canonical 표준화 · 링크 복원 · 중복 날짜 배제
                                    </p>
                                </div>

                                {/* 스텝 3: 최종 배포 (Live Output) */}
                                <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 light:border-emerald-200 light:bg-emerald-50/50">
                                    <div className="flex items-center justify-between text-xs font-bold text-emerald-300 light:text-emerald-700">
                                        <span>STEP 3. 최종 서비스 노출</span>
                                        <Sparkles className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-2xl font-black text-white light:text-slate-900">
                                            {funnelSummary.finalItemCount.toLocaleString()}
                                        </span>
                                        <span className="ml-1 text-xs font-medium text-emerald-300 light:text-emerald-700">건 반영</span>
                                    </div>
                                    <p className="mt-2 text-[11px] text-emerald-200/80 light:text-emerald-600">
                                        빈 카테고리 자동 숨김 · 검증 완료된 실시간 콘텐츠만 제공
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* 소스 수집 원장 (Source Ledger) - 탭 필터, 실시간 검색, 그리드/테이블 뷰 */}
                    {/* ============================================================== */}
                    <div className="rounded-[2.25rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl sm:p-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-6 light:border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-400">
                                        Source Ledger
                                    </span>
                                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-slate-200 light:bg-slate-100 light:text-slate-700">
                                        총 {buildInfo.sourceSummaries.length}개 소스
                                    </span>
                                </div>
                                <h2 className="mt-1 text-2xl font-black tracking-tight text-white light:text-slate-900">
                                    수집 소스별 실시간 상태 모니터
                                </h2>
                                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                    각 데이터 수집 파이프라인의 최근 갱신 시각과 현재 서비스 반영 건수를 확인하세요.
                                </p>
                            </div>

                            {/* 검색 및 뷰 토글 컨트롤 */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* 실시간 검색창 */}
                                <div className="relative min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="소스명/키 검색..."
                                        className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>

                                {/* 정렬 셀렉트 */}
                                <select
                                    value={sourceSort}
                                    onChange={(e) => setSourceSort(e.target.value as any)}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-sky-400 focus:outline-none light:border-slate-300 light:bg-slate-50 light:text-slate-900"
                                >
                                    <option value="freshness" className="bg-slate-900 text-white">상태순 (점검 우선)</option>
                                    <option value="items" className="bg-slate-900 text-white">건수 많은 순</option>
                                    <option value="name" className="bg-slate-900 text-white">이름순 (가나다)</option>
                                </select>

                                {/* 뷰 모드 토글 (그리드 vs 테이블) */}
                                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5 light:border-slate-300 light:bg-slate-100">
                                    <button
                                        onClick={() => setSourceViewMode('grid')}
                                        className={`rounded-lg p-1.5 transition ${
                                            sourceViewMode === 'grid'
                                                ? 'bg-sky-500 text-white shadow'
                                                : 'text-slate-400 hover:text-white light:text-slate-600'
                                        }`}
                                        title="그리드 뷰"
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setSourceViewMode('table')}
                                        className={`rounded-lg p-1.5 transition ${
                                            sourceViewMode === 'table'
                                                ? 'bg-sky-500 text-white shadow'
                                                : 'text-slate-400 hover:text-white light:text-slate-600'
                                        }`}
                                        title="테이블 뷰"
                                    >
                                        <List className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 필터 탭 바 (전체 / 최신 / 관찰 / 점검필요 / 비시즌) */}
                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setSourceFilter('all')}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                    sourceFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-md light:bg-slate-900 light:text-white'
                                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white light:bg-slate-100 light:text-slate-700'
                                }`}
                            >
                                전체 ({buildInfo.sourceSummaries.length})
                            </button>
                            <button
                                onClick={() => setSourceFilter('fresh')}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                    sourceFilter === 'fresh'
                                        ? 'bg-emerald-500 text-white shadow-md'
                                        : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 light:bg-emerald-50 light:text-emerald-700'
                                }`}
                            >
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                최신 ({sourceHealth?.freshCount ?? 0})
                            </button>
                            <button
                                onClick={() => setSourceFilter('aging')}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                    sourceFilter === 'aging'
                                        ? 'bg-amber-500 text-white shadow-md'
                                        : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 light:bg-amber-50 light:text-amber-700'
                                }`}
                            >
                                <span className="h-2 w-2 rounded-full bg-amber-400" />
                                관찰 ({sourceHealth?.agingCount ?? 0})
                            </button>
                            {(sourceHealth?.staleCount ?? 0) > 0 && (
                                <button
                                    onClick={() => setSourceFilter('stale')}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                        sourceFilter === 'stale'
                                            ? 'bg-rose-500 text-white shadow-md'
                                            : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 light:bg-rose-50 light:text-rose-700'
                                    }`}
                                >
                                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                                    점검 필요 ({sourceHealth?.staleCount})
                                </button>
                            )}
                            {(sourceHealth?.offseasonCount ?? 0) > 0 && (
                                <button
                                    onClick={() => setSourceFilter('offseason')}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                        sourceFilter === 'offseason'
                                            ? 'bg-sky-500 text-white shadow-md'
                                            : 'bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 light:bg-sky-50 light:text-sky-700'
                                    }`}
                                >
                                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                                    비시즌 ({sourceHealth?.offseasonCount})
                                </button>
                            )}
                        </div>

                        {/* 소스 목록: 그리드 뷰 */}
                        {sourceViewMode === 'grid' && (
                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredSources.map((source) => {
                                    const tone = getSourceFreshnessTone(source.freshness);
                                    const percent = ((source.itemCount / buildInfo.itemCount) * 100).toFixed(1);

                                    const badgeStyles = {
                                        good: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-700',
                                        default: 'border-slate-500/30 bg-slate-500/15 text-slate-300 light:border-slate-300 light:bg-slate-100 light:text-slate-700',
                                        warn: 'border-amber-500/30 bg-amber-500/15 text-amber-300 light:border-amber-300 light:bg-amber-50 light:text-amber-700',
                                        muted: 'border-sky-500/30 bg-sky-500/15 text-sky-300 light:border-sky-300 light:bg-sky-50 light:text-sky-700',
                                    }[tone];

                                    return (
                                        <article
                                            key={source.key}
                                            className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:border-sky-400/40 hover:bg-white/[0.08] hover:shadow-lg light:border-slate-200 light:bg-white light:hover:border-sky-400"
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="text-base font-black tracking-tight text-white group-hover:text-sky-300 light:text-slate-900 transition">
                                                            {source.label}
                                                        </h4>
                                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 light:text-slate-500">
                                                            {source.key}
                                                        </span>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeStyles}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${
                                                            tone === 'good' ? 'bg-emerald-400' :
                                                            tone === 'warn' ? 'bg-amber-400' :
                                                            tone === 'muted' ? 'bg-sky-400' : 'bg-slate-400'
                                                        }`} />
                                                        {getSourceFreshnessLabel(source.freshness)}
                                                    </span>
                                                </div>

                                                <div className="mt-4 flex items-baseline justify-between">
                                                    <span className="text-2xl font-black text-white light:text-slate-900">
                                                        {source.itemCount.toLocaleString()}
                                                        <span className="ml-1 text-xs font-semibold text-slate-400">건</span>
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-400">
                                                        전체의 {percent}%
                                                    </span>
                                                </div>

                                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10 light:bg-slate-100">
                                                    <div
                                                        style={{ width: `${Math.min(100, Math.max(3, Number(percent) * 3))}%` }}
                                                        className="h-full rounded-full bg-sky-400 group-hover:bg-sky-300"
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400 light:border-slate-100 light:text-slate-500">
                                                <div className="flex items-center justify-between">
                                                    <span>마지막 수집</span>
                                                    <strong className="text-slate-300 light:text-slate-700">
                                                        {formatKoreanDateTime(source.updatedAt, '기록 없음')}
                                                    </strong>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span>경과 일수</span>
                                                    <span className={source.ageDays !== null && source.ageDays > 2 ? 'text-amber-400 font-bold' : ''}>
                                                        {source.seasonal
                                                            ? '비시즌 자동 조정'
                                                            : source.ageDays === null
                                                            ? '-'
                                                            : source.ageDays === 0
                                                            ? '오늘 갱신됨'
                                                            : `${source.ageDays}일 경과`}
                                                    </span>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {/* 소스 목록: 콤팩트 테이블 뷰 */}
                        {sourceViewMode === 'table' && (
                            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 light:border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-white/10 bg-white/5 uppercase text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 font-bold">소스명</th>
                                            <th className="px-4 py-3 font-bold">식별 키</th>
                                            <th className="px-4 py-3 font-bold">상태</th>
                                            <th className="px-4 py-3 font-bold text-right">반영 건수</th>
                                            <th className="px-4 py-3 font-bold">마지막 갱신</th>
                                            <th className="px-4 py-3 font-bold text-right">경과</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 light:divide-slate-100">
                                        {filteredSources.map((source) => {
                                            const tone = getSourceFreshnessTone(source.freshness);
                                            return (
                                                <tr
                                                    key={source.key}
                                                    className="hover:bg-white/5 light:hover:bg-slate-50 transition"
                                                >
                                                    <td className="px-4 py-3 font-black text-white light:text-slate-900">
                                                        {source.label}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                                                        {source.key}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                            tone === 'good' ? 'bg-emerald-500/20 text-emerald-300' :
                                                            tone === 'warn' ? 'bg-amber-500/20 text-amber-300' :
                                                            tone === 'muted' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'
                                                        }`}>
                                                            {getSourceFreshnessLabel(source.freshness)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-white light:text-slate-900">
                                                        {source.itemCount.toLocaleString()}건
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300 light:text-slate-600">
                                                        {formatKoreanDateTime(source.updatedAt, '-')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-400">
                                                        {source.seasonal ? '비시즌' : source.ageDays !== null ? `${source.ageDays}일` : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {filteredSources.length === 0 && (
                            <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
                                <Search className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                                <p className="text-sm font-bold">검색 결과가 없습니다</p>
                                <p className="mt-1 text-xs">검색어 또는 필터 조건을 다시 확인해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: 품질 & 정합성 (Quality & Integrity)                      */}
            {/* ============================================================== */}
            {(selectedTab === 'overview' || selectedTab === 'quality') && (
                <div className="space-y-6">
                    <div className="rounded-[2.25rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl sm:p-8">
                        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 light:border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-400">
                                    Quality Assurance
                                </span>
                                <h3 className="mt-1 text-2xl font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                                    데이터 품질 & 핵심 필드 무결성 모니터
                                </h3>
                                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                    사용자에게 노출되는 링크, 설명, 포스터 이미지의 누락 상태를 실시간 집계합니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                                    품질 지수 {qualityScore}%
                                </span>
                            </div>
                        </div>

                        {/* 품질 4대 핵심 검증 카드 그리드 */}
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {/* 링크 유효성 */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 light:text-slate-600">상세 링크 유효성</span>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div className="mt-2">
                                    <span className="text-2xl font-black text-white light:text-slate-900">
                                        {(buildInfo.qualitySummary?.missingLinkCount ?? 0) === 0 ? '100%' : '점검 필요'}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    누락 {buildInfo.qualitySummary?.missingLinkCount ?? 0}건 · 모든 링크 정상
                                </p>
                                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 light:bg-slate-200">
                                    <div className="h-full w-full rounded-full bg-emerald-500" />
                                </div>
                            </div>

                            {/* 상세 설명 충실도 */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 light:text-slate-600">설명문 충실도</span>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div className="mt-2">
                                    <span className="text-2xl font-black text-white light:text-slate-900">
                                        {(buildInfo.qualitySummary?.missingDescriptionCount ?? 0) === 0 ? '100%' : '점검 필요'}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    누락 {buildInfo.qualitySummary?.missingDescriptionCount ?? 0}건 · 본문 확보 완료
                                </p>
                                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 light:bg-slate-200">
                                    <div className="h-full w-full rounded-full bg-emerald-500" />
                                </div>
                            </div>

                            {/* 포스터 이미지 */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 light:text-slate-600">포스터/이미지</span>
                                    <ImageIcon className="h-4 w-4 text-amber-400" />
                                </div>
                                <div className="mt-2">
                                    <span className="text-2xl font-black text-white light:text-slate-900">
                                        {Math.round(((qualityTotal - (buildInfo.qualitySummary?.missingImageCount ?? 0)) / qualityTotal) * 100)}%
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-amber-300 light:text-amber-700">
                                    보강 대상 {buildInfo.qualitySummary?.missingImageCount ?? 0}건
                                </p>
                                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 light:bg-slate-200">
                                    <div
                                        style={{ width: `${Math.round(((qualityTotal - (buildInfo.qualitySummary?.missingImageCount ?? 0)) / qualityTotal) * 100)}%` }}
                                        className="h-full rounded-full bg-amber-500"
                                    />
                                </div>
                            </div>

                            {/* 로컬 포스터 무결성 */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 light:text-slate-600">로컬 포스터 무결성</span>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div className="mt-2">
                                    <span className="text-2xl font-black text-white light:text-slate-900">
                                        100%
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    깨진 로컬 이미지 {buildInfo.qualitySummary?.brokenLocalImageCount ?? 0}건
                                </p>
                                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 light:bg-slate-200">
                                    <div className="h-full w-full rounded-full bg-emerald-500" />
                                </div>
                            </div>
                        </div>

                        {/* 품질 보강 우선순위 & 가격 미상 소스 TOP 리스트 */}
                        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {/* 1. 가격 보강 우선 소스 랭킹 */}
                            {priceSummary?.topUnknownBySource && priceSummary.topUnknownBySource.length > 0 && (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 light:border-slate-200 light:bg-slate-50">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3 light:border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-amber-400" />
                                            <h4 className="text-sm font-bold text-white light:text-slate-900">
                                                가격 보강 우선순위 소스
                                            </h4>
                                        </div>
                                        <span className="text-[11px] text-slate-400">
                                            총 미상 {priceSummary.actionableUnknownCount.toLocaleString()}건
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2.5">
                                        {priceSummary.topUnknownBySource.slice(0, 5).map((s) => {
                                            const pct = Math.round((s.actionableUnknownCount / s.itemCount) * 100);
                                            return (
                                                <div key={s.key} className="rounded-xl bg-black/20 p-2.5 light:bg-white">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-200 light:text-slate-800">
                                                            {s.label}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-amber-400 font-mono font-bold">
                                                                {s.actionableUnknownCount.toLocaleString()}건
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                (미상률 {pct}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 light:bg-slate-100">
                                                        <div
                                                            style={{ width: `${pct}%` }}
                                                            className="h-full rounded-full bg-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 2. 종합 품질 개선 기회 점수 */}
                            {oppSummary?.topSourceOpportunities && oppSummary.topSourceOpportunities.length > 0 && (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 light:border-slate-200 light:bg-slate-50">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3 light:border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-emerald-400" />
                                            <h4 className="text-sm font-bold text-white light:text-slate-900">
                                                수집 품질 개선 우선순위
                                            </h4>
                                        </div>
                                        <span className="text-[11px] text-emerald-400 font-semibold">
                                            기회 점수 기준
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2.5">
                                        {oppSummary.topSourceOpportunities.slice(0, 4).map((s) => (
                                            <div key={s.key} className="rounded-xl bg-black/20 p-3 light:bg-white">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-white light:text-slate-900">
                                                        {s.label}
                                                    </span>
                                                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300 light:bg-emerald-100 light:text-emerald-800">
                                                        {s.opportunityScore}점
                                                    </span>
                                                </div>
                                                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300 light:text-slate-600">
                                                    {s.recommendedAction}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: 공연장 & 마스터 (Venues & Places)                         */}
            {/* ============================================================== */}
            {(selectedTab === 'overview' || selectedTab === 'venues') && (
                <div className="space-y-6">
                    <div className="rounded-[2.25rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl sm:p-8">
                        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 light:border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-400">
                                    Venue Master Intelligence
                                </span>
                                <h3 className="mt-1 text-2xl font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                    <Building2 className="h-6 w-6 text-cyan-400" />
                                    공연장 표준화 및 공식 장소 매칭 현황
                                </h3>
                                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                    좌표 오염 방지, 하위홀 그룹화, 고신뢰 placeId 매칭을 누적 관리합니다.
                                </p>
                            </div>
                            <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">
                                표준 마스터 {venueMaster?.entryCount.toLocaleString() ?? 0}개
                            </span>
                        </div>

                        {/* 통계 요약 4열 */}
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">표준 공연장 등록</span>
                                <div className="mt-2 text-2xl font-black text-white light:text-slate-900">
                                    {venueMaster?.entryCount.toLocaleString() ?? 0}
                                    <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">누적 canonical 마스터</p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">하위홀/복합공간 그룹</span>
                                <div className="mt-2 text-2xl font-black text-white light:text-slate-900">
                                    {venueMaster?.parentChildGroupCount.toLocaleString() ?? 0}
                                    <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">대극장/소극장 관계 정돈</p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">공식 장소 매칭</span>
                                <div className="mt-2 text-2xl font-black text-emerald-400">
                                    {venueMatching?.matchedCount.toLocaleString() ?? 0}
                                    <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    고신뢰 확정 {venueMatching?.highConfidenceMatchCount ?? 0}개
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">공식 검색 대기열</span>
                                <div className="mt-2 text-2xl font-black text-amber-400">
                                    {venueMatching?.pendingLookupCount.toLocaleString() ?? 0}
                                    <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">우선순위 순차 반영</p>
                            </div>
                        </div>

                        {/* 대기열 큐 렌더링 */}
                        {venueMatching?.topQueue && venueMatching.topQueue.length > 0 && (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3 light:border-slate-200">
                                    <h4 className="text-sm font-bold text-white light:text-slate-900 flex items-center gap-2">
                                        <MapPinned className="h-4 w-4 text-cyan-400" />
                                        공식 장소 매칭 우선순위 대기열 (Top Queue)
                                    </h4>
                                    <span className="text-xs text-slate-400">
                                        공연 건수 많은 순
                                    </span>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {venueMatching.topQueue.slice(0, 6).map((venue, idx) => (
                                        <div
                                            key={venue.venueId}
                                            className="flex items-start justify-between rounded-xl bg-black/20 p-3 light:bg-white border border-white/5 light:border-slate-200"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-black text-sky-400">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="truncate text-xs font-bold text-white light:text-slate-900">
                                                        {venue.officialName}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-[11px] text-slate-400 light:text-slate-500">
                                                    {venue.address || venue.query}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 font-mono text-[11px] font-bold text-cyan-300 light:bg-slate-100 light:text-cyan-700">
                                                {venue.performanceCount}건
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: 시스템 & 운영 자동화 (System & Cron)                     */}
            {/* ============================================================== */}
            {(selectedTab === 'overview' || selectedTab === 'system') && (
                <div className="space-y-6">
                    <div className="rounded-[2.25rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl light:border-slate-200 light:bg-white shadow-xl sm:p-8">
                        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 light:border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                                    Automation & Schedules
                                </span>
                                <h3 className="mt-1 text-2xl font-black tracking-tight text-white light:text-slate-900 flex items-center gap-2">
                                    <Server className="h-6 w-6 text-emerald-400" />
                                    운영 자동화 및 스케줄러 상태
                                </h3>
                                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                                    로컬 자정 스케줄러와 GitHub Actions 수집 파이프라인의 최근 가동 현황입니다.
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                {opsSummary?.schedulerConfigured ? '자정 스케줄러 가동 중' : '스케줄러 확인'}
                            </span>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">최근 로컬 수집 실행</span>
                                <p className="mt-2 text-sm font-bold text-white light:text-slate-900">
                                    {formatKoreanDateTime(opsSummary?.latestLocalUpdateAt, '기록 없음')}
                                </p>
                                <div className="mt-2">
                                    {opsSummary?.latestLocalUpdateCompleted ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                            <Check className="h-3 w-3" /> 정상 완료 확인
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                            <Clock className="h-3 w-3" /> 완료 확인 대기
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">최근 실패 소스 감지</span>
                                <p className="mt-2 text-2xl font-black text-white light:text-slate-900">
                                    {opsSummary?.lastFailureCount ?? 0}
                                    <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    {(opsSummary?.lastFailureCount ?? 0) === 0 ? '모든 소스 수집 성공' : '실패 소스 점검 필요'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 light:border-slate-200 light:bg-slate-50">
                                <span className="text-xs font-bold text-slate-400">운영 원칙 준수율</span>
                                <p className="mt-2 text-2xl font-black text-emerald-400">
                                    100%
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    빈 카테고리 숨김 · 비시즌 자동 분리
                                </p>
                            </div>
                        </div>

                        {opsSummary?.latestLocalUpdateLog && (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-slate-300 light:bg-slate-900 light:text-slate-200">
                                <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-2 font-bold uppercase tracking-wider">
                                    <Activity className="h-3.5 w-3.5 text-sky-400" />
                                    <span>Latest Local Update Log</span>
                                </div>
                                <p className="break-all leading-relaxed">
                                    {opsSummary.latestLocalUpdateLog}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
