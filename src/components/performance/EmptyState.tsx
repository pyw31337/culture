import React from 'react';
import { Heart, Star, Search, Filter, Calendar, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { GENRES } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';

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

    // Floating Animation Variant
    const floatVariant = {
        animate: {
            y: [0, -15, 0],
            transition: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut" as const
            }
        }
    };

    const RecommendationChip = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800/50 light:bg-gray-100 hover:bg-gray-700 light:hover:bg-gray-200 border border-gray-700 light:border-gray-300 transition-all transform hover:scale-105"
        >
            <span className="text-purple-400 light:text-purple-600 flex items-center justify-center">
                {icon}
            </span>
            <span className="text-sm font-extrabold text-gray-300 light:text-gray-700">{label}</span>
        </button>
    );

    const handleRedirect = (genre: string) => {
        // Simple redirect via window location (or we could expose setGenre prop)
        // Since PerformanceList manages genre via URL usually, we can just link to it
        window.location.href = `/culture/${genre}`;
    };

    return (
        <div className="flex flex-col items-center justify-center py-20 text-center w-full min-h-[50vh]">
            {viewMode === 'likes-perf' ? (
                <>
                    <motion.div
                        variants={floatVariant}
                        animate="animate"
                        className="w-24 h-24 rounded-full bg-pink-500/10 flex items-center justify-center mb-6 relative"
                    >
                        <Heart className="w-12 h-12 text-pink-500/60 fill-pink-500/10" />
                        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-pink-500 animate-pulse" />
                    </motion.div>
                    <h3 className="text-2xl font-extrabold text-pink-500 mb-2">좋아요한 공연이 없어요</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8 leading-relaxed">
                        마음에 드는 공연이나 전시를 발견하면 하트를 눌러보세요.<br />
                        나만의 문화 리스트가 만들어집니다! 💝
                    </p>
                    <a href="/culture/" className="px-8 py-3 rounded-xl bg-pink-500 text-white font-extrabold hover:bg-pink-600 transition-all shadow-lg hover:shadow-pink-500/30">
                        공연 둘러보기
                    </a>
                </>
            ) : viewMode === 'likes-venue' ? (
                <>
                    <motion.div
                        variants={floatVariant}
                        animate="animate"
                        className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 relative"
                    >
                        <Star className="w-12 h-12 text-emerald-500/60 fill-emerald-500/10" />
                        <div className="absolute top-0 left-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    </motion.div>
                    <h3 className="text-2xl font-extrabold text-emerald-500 mb-2">찜한 공연장이 없어요</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8 leading-relaxed">
                        자주 가는 공연장이나 관심 있는 장소를 찜해보세요.<br />
                        주변 맛집이나 티켓 오픈 소식을 더 빠르게 확인할 수 있습니다. 🏟️
                    </p>
                    <button
                        onClick={() => setIsMapOpen(true)}
                        className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-extrabold hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 mx-auto"
                    >
                        <Search size={18} />
                        지도에서 찾기
                    </button>
                </>
            ) : (
                <>
                    {/* General Empty State (Search/Filter) */}
                    <motion.div
                        variants={floatVariant}
                        animate="animate"
                        className="mb-8 opacity-80"
                    >
                        {selectedGenre === 'baseball' || selectedGenre === 'soccer' ? (
                            <Calendar className="w-20 h-20 text-gray-700 light:text-gray-300" strokeWidth={1} />
                        ) : (
                            <Filter className="w-20 h-20 text-gray-700 light:text-gray-300" strokeWidth={1} />
                        )}
                    </motion.div>

                    <h3 className="text-2xl font-black text-white light:text-gray-900 mb-2">
                        {(selectedGenre === 'baseball' || selectedGenre === 'soccer')
                            ? '예정된 경기 일정이 없습니다 🏖️'
                            : '조건에 맞는 결과가 없네요 😢'}
                    </h3>
                    <p className="text-gray-400 light:text-gray-500 mb-8 text-sm">
                        필터 조건을 변경하거나 다른 검색어로 시도해보세요.
                    </p>

                    <div className="flex gap-3 mb-12">
                        <button onClick={() => {
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSearchText('');
                            setUserLocation(null);
                        }} className="px-6 py-2.5 rounded-full bg-gray-800 light:bg-white text-gray-300 light:text-gray-700 font-extrabold border border-gray-700 light:border-gray-300 hover:border-purple-500 hover:text-purple-400 light:hover:text-purple-600 transition-all flex items-center gap-2">
                            <Zap size={16} />
                            필터 초기화
                        </button>
                    </div>

                    {/* Smart Recommendations */}
                    <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                        <span className="text-xs font-extrabold text-gray-500 uppercase tracking-widest bg-gray-900/50 light:bg-gray-100 px-3 py-1 rounded-full">
                            이런 카테고리는 어때요?
                        </span>
                        <div className="flex flex-wrap justify-center gap-3">
                            {['festival', 'musical', 'concert', 'exhibition'].map(id => {
                                const genre = GENRES.find(g => g.id === id);
                                if (!genre) return null;
                                return (
                                    <RecommendationChip
                                        key={id}
                                        icon={getGenreIcon(id, 14)}
                                        label={genre.label}
                                        onClick={() => handleRedirect(id)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
