'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Activity, ArrowUpRight, Clock3, Database, Info, LayoutGrid, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import Portal from '@/components/ui/Portal';
import type { DataQualitySummary, DataSourceHealthSummary } from '@/lib/build-info';
import { getQualityIssueCount, getQualityStatusLabel, getSourceHealthStatusLabel } from '@/lib/build-info';

interface ServiceStatusStripProps {
    lastUpdated: string;
    totalItemCount: number;
    availableGenreCount: number;
    qualitySummary?: DataQualitySummary | null;
    sourceHealthSummary?: DataSourceHealthSummary | null;
    className?: string;
    buttonClassName?: string;
    iconOnly?: boolean;
}

function InfoRow({
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
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
            <div className="mt-0.5 text-slate-300 light:text-slate-500">
                {icon}
            </div>
            <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 light:text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-bold text-white light:text-slate-900">{value}</p>
                {detail && (
                    <p className="mt-1 text-xs leading-5 text-slate-300 light:text-slate-600">{detail}</p>
                )}
            </div>
        </div>
    );
}

export default function ServiceStatusStrip({
    lastUpdated,
    totalItemCount,
    availableGenreCount,
    qualitySummary,
    sourceHealthSummary,
    className,
    buttonClassName,
    iconOnly = true,
}: ServiceStatusStripProps) {
    const [isOpen, setIsOpen] = useState(false);
    const issueCount = getQualityIssueCount(qualitySummary);
    const qualityStatus = getQualityStatusLabel(qualitySummary);
    const sourceStatus = getSourceHealthStatusLabel(sourceHealthSummary);

    const sourceDetail = useMemo(() => {
        if (!sourceHealthSummary) return '수집 상태 메타데이터를 준비 중입니다.';

        const parts = [
            sourceHealthSummary.freshCount > 0 ? `최신 ${sourceHealthSummary.freshCount}개` : null,
            sourceHealthSummary.agingCount > 0 ? `관찰 ${sourceHealthSummary.agingCount}개` : null,
            sourceHealthSummary.staleCount > 0 ? `점검 ${sourceHealthSummary.staleCount}개` : null,
            sourceHealthSummary.offseasonCount > 0 ? `비시즌 ${sourceHealthSummary.offseasonCount}개` : null,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(' · ') : '수집 소스 상태를 정리 중입니다.';
    }, [sourceHealthSummary]);

    const qualityDetail = useMemo(() => {
        if (!qualitySummary) return '링크, 설명, 이미지 품질 점검 결과를 준비 중입니다.';
        if (qualitySummary.status === 'warn' && issueCount > 0) {
            return `링크 ${qualitySummary.missingLinkCount}건 · 설명 ${qualitySummary.missingDescriptionCount}건 · 이미지 ${qualitySummary.missingImageCount}건 · 로컬 포스터 ${qualitySummary.brokenLocalImageCount}건`;
        }

        return '링크, 설명, 이미지 핵심 검증을 통과한 상태입니다.';
    }, [issueCount, qualitySummary]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return (
        <>
            <div className={clsx('inline-flex', className)}>
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className={clsx(
                        'inline-flex items-center justify-center gap-2 rounded-full text-slate-300 transition hover:text-white light:text-slate-500 light:hover:text-slate-800',
                        iconOnly
                            ? 'h-6 w-6 border-0 bg-transparent p-0 hover:bg-slate-900/5 light:hover:bg-slate-100'
                            : 'border border-white/10 bg-white/6 px-2.5 py-2 text-sm font-semibold hover:border-sky-300/35 hover:bg-white/10 light:border-slate-200 light:bg-white light:hover:border-sky-300 light:hover:text-sky-700',
                        buttonClassName
                    )}
                    aria-label="운영 정보 보기"
                    title="운영 정보 보기"
                >
                    <Info className={clsx(iconOnly ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                    {!iconOnly && <span>운영 정보</span>}
                </button>
            </div>

            {isOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                        <div
                            className="w-full max-w-lg rounded-[2rem] border border-white/12 bg-[#07111f]/96 p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.42)] light:border-slate-200 light:bg-white light:text-slate-900"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300 light:text-sky-700">Service Snapshot</p>
                                    <h3 className="mt-2 text-2xl font-black tracking-tight">운영 정보를 조용히 모아둔 패널입니다.</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-600">
                                        자주 볼 정보는 아니지만, 지금 서비스가 어느 정도 최신이고 안정적인지는 여기에서 한 번에 확인할 수 있습니다.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
                                    aria-label="운영 정보 닫기"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-5 space-y-3">
                                <InfoRow
                                    label="업데이트"
                                    value={lastUpdated.trim()}
                                    detail="현재 화면이 참고하고 있는 최신 빌드 시각입니다."
                                    icon={<Clock3 className="h-4 w-4" />}
                                />
                                <InfoRow
                                    label="운영 범위"
                                    value={`전체 ${totalItemCount.toLocaleString()}건 · 카테고리 ${availableGenreCount}개`}
                                    detail="빈 카테고리는 숨기고, 실제 노출 가능한 콘텐츠만 서비스에 표시합니다."
                                    icon={<Database className="h-4 w-4" />}
                                />
                                <InfoRow
                                    label="수집 상태"
                                    value={sourceStatus}
                                    detail={sourceDetail}
                                    icon={<Activity className="h-4 w-4" />}
                                />
                                <InfoRow
                                    label="콘텐츠 품질"
                                    value={qualityStatus}
                                    detail={qualityDetail}
                                    icon={qualitySummary?.status === 'warn' ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                />
                            </div>

                            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 light:border-slate-200 light:bg-slate-50">
                                <div className="flex items-center gap-2 text-sm font-bold text-white light:text-slate-900">
                                    <LayoutGrid className="h-4 w-4 text-sky-300 light:text-sky-700" />
                                    더 자세한 운영 상태는 별도 페이지에서 확인할 수 있습니다.
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-300 light:text-slate-600">
                                    소스별 마지막 수집 시각, 비시즌 처리, 품질 보강 상태까지 상세하게 정리해 두었습니다.
                                </p>
                                <Link
                                    href="/status/"
                                    onClick={() => setIsOpen(false)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-400"
                                >
                                    상태 페이지로 이동
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
}
