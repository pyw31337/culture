import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, Clock3, Database, LayoutGrid, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { DataQualitySummary, DataSourceHealthSummary } from '@/lib/build-info';
import { getQualityIssueCount, getQualityStatusLabel, getSourceHealthStatusLabel } from '@/lib/build-info';

interface ServiceStatusStripProps {
    lastUpdated: string;
    totalItemCount: number;
    availableGenreCount: number;
    qualitySummary?: DataQualitySummary | null;
    sourceHealthSummary?: DataSourceHealthSummary | null;
}

function StatPill({
    icon,
    children,
    tone = 'default'
}: {
    icon: ReactNode;
    children: ReactNode;
    tone?: 'default' | 'good' | 'warn' | 'muted';
}) {
    const toneClassName = {
        default: 'border-white/10 bg-white/5 text-gray-300 light:border-black/10 light:bg-black/5 light:text-gray-700',
        good: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 light:border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700',
        warn: 'border-amber-500/30 bg-amber-500/10 text-amber-100 light:border-amber-500/25 light:bg-amber-50 light:text-amber-700',
        muted: 'border-sky-500/25 bg-sky-500/10 text-sky-100 light:border-sky-500/20 light:bg-sky-50 light:text-sky-700',
    }[tone];

    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold ${toneClassName}`}>
            {icon}
            {children}
        </span>
    );
}

export default function ServiceStatusStrip({
    lastUpdated,
    totalItemCount,
    availableGenreCount,
    qualitySummary,
    sourceHealthSummary
}: ServiceStatusStripProps) {
    const issueCount = getQualityIssueCount(qualitySummary);
    const qualityTone = qualitySummary?.status === 'warn' ? 'warn' : 'good';
    const sourceIssueCount = (sourceHealthSummary?.staleCount || 0) + (sourceHealthSummary?.unknownCount || 0);
    const sourceTone = sourceIssueCount > 0 ? 'warn' : sourceHealthSummary?.agingCount ? 'default' : 'good';
    const sourceSuffix = sourceHealthSummary?.offseasonCount
        ? ` · 비시즌 ${sourceHealthSummary.offseasonCount}개`
        : '';

    return (
        <div className="flex flex-wrap items-center gap-2 pt-3">
            <StatPill icon={<Clock3 className="h-3.5 w-3.5" />}>
                업데이트 {lastUpdated.trim()}
            </StatPill>
            <StatPill icon={<Database className="h-3.5 w-3.5" />}>
                전체 {totalItemCount.toLocaleString()}건
            </StatPill>
            <StatPill icon={<LayoutGrid className="h-3.5 w-3.5" />}>
                운영 카테고리 {availableGenreCount}개
            </StatPill>
            <StatPill icon={<Activity className="h-3.5 w-3.5" />} tone={sourceTone}>
                {getSourceHealthStatusLabel(sourceHealthSummary)}
                {sourceSuffix}
            </StatPill>
            <StatPill
                icon={qualitySummary?.status === 'warn'
                    ? <ShieldAlert className="h-3.5 w-3.5" />
                    : <ShieldCheck className="h-3.5 w-3.5" />}
                tone={qualityTone}
            >
                {getQualityStatusLabel(qualitySummary)}
                {qualitySummary?.status === 'warn' && issueCount > 0 ? ` · ${issueCount}건` : ''}
            </StatPill>
            <Link href="/status/" className="inline-flex">
                <StatPill icon={<ArrowUpRight className="h-3.5 w-3.5" />} tone="muted">
                    상태 페이지
                </StatPill>
            </Link>
        </div>
    );
}
