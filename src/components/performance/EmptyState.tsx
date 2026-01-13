
import React from 'react';
import { Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface EmptyStateProps {
    viewMode: string;
    selectedGenre: string;
    setSelectedRegion: (val: string) => void;
    setSelectedDistrict: (val: string) => void;
    setSearchText: (val: string) => void;
    setUserLocation: (val: any) => void;
    setIsMapOpen: (val: boolean) => void;
}

export default function EmptyState({
    viewMode,
    selectedGenre,
    setSelectedRegion,
    setSelectedDistrict,
    setSearchText,
    setUserLocation,
    setIsMapOpen
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-gray-500 w-full text-center px-4">
            {viewMode === 'likes-perf' ? (
                <>
                    <div className="w-20 h-20 rounded-full bg-pink-500/10 flex items-center justify-center mb-6">
                        <Heart className="w-10 h-10 text-pink-500/50" />
                    </div>
                    <h3 className="text-xl font-bold text-pink-400 mb-2">좋아요한 컨텐츠가 없네요</h3>
                    <p className="text-gray-500">마음에 드는 컨텐츠에 하트를 눌러보세요!</p>
                </>
            ) : viewMode === 'likes-venue' ? (
                <>
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                        <Star className="w-10 h-10 text-emerald-500/50" />
                    </div>
                    <h3 className="text-xl font-bold text-emerald-400 mb-2">찜한 공연장이 없네요</h3>
                    <p className="text-gray-500 mb-6">자주 가는 공연장을 등록하고 일정을 확인해보세요.</p>
                    <button
                        onClick={() => setIsMapOpen(true)}
                        className="px-6 py-2.5 rounded-full bg-emerald-500/20 text-emerald-500 font-bold hover:bg-emerald-500 hover:text-black transition-all"
                    >
                        지도에서 찾기
                    </button>
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 mb-6 opacity-20 icon icon-tabler icons-tabler-outline icon-tabler-calendar-time">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" />
                        <path d="M14 18a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                        <path d="M15 3v4" />
                        <path d="M7 3v4" />
                        <path d="M3 11h16" />
                        <path d="M18 16.496v1.504l1 1" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">
                        {(selectedGenre === 'baseball' || selectedGenre === 'soccer')
                            ? '현재 경기 일정이 없습니다.'
                            : '조건에 맞는 공연이 없습니다.'}
                    </h3>
                    <p className="text-gray-500 mb-6">다른 검색어나 필터를 사용해보세요.</p>
                    <div className="flex flex-col gap-3 items-center">
                        <button onClick={() => {
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSearchText('');
                            setUserLocation(null);
                            // Keep selectedGenre unchanged
                        }} className="px-6 py-2.5 rounded-full bg-blue-500/20 text-blue-400 font-bold hover:bg-blue-500 hover:text-white transition-all">
                            필터 초기화
                        </button>
                        <a href="/culture/" className="px-6 py-2.5 rounded-full bg-gray-500/20 text-gray-400 font-bold hover:bg-gray-500 hover:text-white transition-all">
                            홈으로 가기
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}
