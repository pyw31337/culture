import React from 'react';
import { Heart, Star, Search, Filter, Calendar, Zap, MapPin } from 'lucide-react';
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
    searchMode?: 'keyword' | 'location';
    setSearchMode?: (val: 'keyword' | 'location') => void;
    searchText?: string;
}

export default function EmptyState({
    viewMode,
    selectedGenre,
    setSelectedRegion,
    setSelectedDistrict,
    setSearchText,
    setUserLocation,
    setIsMapOpen,
    searchMode,
    setSearchMode,
    searchText
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
                    <h3 className="text-2xl font-extrabold text-pink-500 mb-2">좋아요한 컨텐츠가 없어요</h3>
                    <p className="text-gray-400 light:text-gray-600 mb-6 font-semibold">
                        마음에 드는 컨텐츠나 전시를 발견하면 하트를 눌러보세요.<br />
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
                        onClick={() => { setSelectedRegion('all'); setSelectedDistrict('all'); setSearchText(''); }}
                        className="bg-purple-600/20 text-purple-400 light:bg-purple-600 light:text-white px-6 py-3 rounded-xl hover:bg-purple-500/30 font-extrabold transition-all border border-purple-500/30"
                    >
                        컨텐츠 둘러보기
                    </button>
                </>
            ) : (
                <>
                    <motion.div
                        variants={floatVariant}
                        animate="animate"
                        className="mb-8 opacity-80"
                    >
                        {searchText ? (
                            <Search className="w-20 h-20 text-gray-700 light:text-gray-300" strokeWidth={1} />
                        ) : selectedGenre === 'baseball' || selectedGenre === 'soccer' ? (
                            <Calendar className="w-20 h-20 text-gray-700 light:text-gray-300" strokeWidth={1} />
                        ) : (
                            <Filter className="w-20 h-20 text-gray-700 light:text-gray-300" strokeWidth={1} />
                        )}
                    </motion.div>

                    <h3 className="text-2xl font-black text-white light:text-gray-900 mb-2">
                        {searchText ? (
                            selectedGenre !== 'all'
                                ? `'${searchText}' 키워드의 컨텐츠가 ${GENRES.find(g => g.id === selectedGenre)?.label || selectedGenre} 카테고리에서 발견되지 않았습니다.`
                                : '검색 결과가 없습니다 😢'
                        ) : (selectedGenre === 'baseball' || selectedGenre === 'soccer') ? (
                            '예정된 경기 일정이 없습니다 🏖️'
                        ) : (
                            '조건에 맞는 결과가 없네요 😢'
                        )}
                    </h3>
                    <p className="text-gray-400 light:text-gray-500 mb-8 text-sm">
                        {searchText
                            ? selectedGenre !== 'all'
                                ? '전체 카테고리로 이동하거나 다른 검색어로 시도해보세요.'
                                : `'${searchText}'에 대한 검색 결과가 없습니다.`
                            : '필터 조건을 변경하거나 다른 검색어로 시도해보세요.'}
                    </p>

                    <div className="flex gap-3 mb-12">
                        <button onClick={() => {
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSearchText('');
                            setUserLocation(null);
                        }} className="px-6 py-2.5 rounded-full bg-gray-800 light:bg-white text-gray-300 light:text-gray-700 font-extrabold border border-gray-700 light:border-gray-300 hover:border-blue-500 hover:text-blue-400 light:hover:text-blue-600 transition-all flex items-center gap-2">
                            <Zap size={16} />
                            필터 초기화
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
