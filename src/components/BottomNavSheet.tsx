import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Search } from 'lucide-react';
import { BottomMenuType } from './BottomNav';
import { GENRES, GENRE_STYLES, REGIONS } from '@/lib/constants';

interface BottomNavSheetProps {
    activeMenu: BottomMenuType;
    onClose: () => void;
    // Props for sub-features
    viewMode: string;
    onViewModeChange: (mode: string) => void;
    selectedGenre: string;
    onGenreSelect: (genre: string) => void;
    searchText: string;
    onSearchChange: (text: string) => void;
    selectedRegion: string;
    onRegionSelect: (region: string) => void;
    selectedDistrict: string;
    onDistrictSelect: (district: string) => void;
    keywords: string[];
    onKeywordAdd: (keyword: string) => void;
    onKeywordRemove: (keyword: string) => void;
    districts: string[]; // Passed from parent based on selectedRegion
}

export default function BottomNavSheet({
    activeMenu,
    onClose,
    viewMode,
    onViewModeChange,
    selectedGenre,
    onGenreSelect,
    searchText,
    onSearchChange,
    selectedRegion,
    onRegionSelect,
    selectedDistrict,
    onDistrictSelect,
    keywords,
    onKeywordAdd,
    onKeywordRemove,
    districts
}: BottomNavSheetProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

    useEffect(() => {
        if (activeMenu) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [activeMenu]);

    if (!activeMenu && !isVisible) return null;

    const handleKeywordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (keywordInput.trim()) {
            onKeywordAdd(keywordInput.trim());
            setKeywordInput('');
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-[9980] transition-opacity duration-300",
                    activeMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={clsx(
                    "fixed bottom-16 left-0 right-0 z-[9985] bg-[#1a1a1a]/90 backdrop-blur-2xl border-t border-white/10 rounded-t-2xl transition-transform duration-300 ease-out max-h-[70vh] flex flex-col shadow-2xl pb-safe",
                    activeMenu ? "translate-y-0 opacity-100" : "translate-y-full opacity-50"
                )}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-600 rounded-full cursor-pointer hover:bg-gray-500 transition-colors" />
                </div>

                {/* Content Area */}
                <div className="p-4 overflow-y-auto custom-scrollbar">

                    {/* VIEW MENU */}
                    {activeMenu === 'view' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-white mb-4 px-1">보기 방식 선택</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { id: 'grid', label: '썸네일 보기', desc: '포스터 중심' },
                                    { id: 'list', label: '리스트 보기', desc: '정보 중심' },
                                    { id: 'calendar', label: '달력 보기', desc: '일자별 일정' },
                                    { id: 'map', label: '지도 보기', desc: '위치 기반' }
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => { onViewModeChange(mode.id); onClose(); }}
                                        className={clsx(
                                            "p-4 rounded-xl border text-left transition-all hover:scale-[1.02]",
                                            viewMode === mode.id
                                                ? "bg-white text-black border-white shadow-lg"
                                                : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                                        )}
                                    >
                                        <div className="text-sm font-bold mb-1">{mode.label}</div>
                                        <div className={clsx("text-xs opacity-70", viewMode === mode.id ? "text-gray-600" : "text-gray-500")}>
                                            {mode.desc}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CATEGORY MENU */}
                    {activeMenu === 'category' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-white mb-4 px-1">카테고리 선택</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                <button
                                    onClick={() => { onGenreSelect('all'); onClose(); }}
                                    className={clsx(
                                        "px-3 py-3 rounded-xl text-sm font-medium transition-all border",
                                        selectedGenre === 'all'
                                            ? "bg-white text-black border-white font-bold"
                                            : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                                    )}
                                >
                                    전체
                                </button>
                                {GENRES.filter(g => g.id !== 'hotdeal').map(genre => (
                                    <button
                                        key={genre.id}
                                        onClick={() => { onGenreSelect(genre.id); onClose(); }}
                                        className={clsx(
                                            "px-3 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all border flex flex-col items-center justify-center gap-1",
                                            selectedGenre === genre.id
                                                ? `${GENRE_STYLES[genre.id]?.twBg.replace('bg-', 'bg-') || 'bg-gray-600'} text-white border-transparent ring-2 ring-white`
                                                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-gray-200"
                                        )}
                                    >
                                        {genre.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LOCATION MENU */}
                    {activeMenu === 'location' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-white px-1">위치 및 검색</h3>

                            {/* Search Bar */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="공연명, 출연진, 장소 검색..."
                                    className="w-full bg-gray-800 border-none rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 transition-all text-base"
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            </div>

                            {/* Location Selectors */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs text-gray-400 ml-1">지역 (시/도)</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        <button
                                            onClick={() => onRegionSelect('all')}
                                            className={clsx(
                                                "py-2.5 rounded-lg text-xs font-medium border transition-colors",
                                                selectedRegion === 'all' ? "bg-white text-black border-white" : "bg-gray-800 text-gray-400 border-gray-700"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {REGIONS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => onRegionSelect(r.id)}
                                                className={clsx(
                                                    "py-2.5 rounded-lg text-xs font-medium border transition-colors",
                                                    selectedRegion === r.id ? "bg-white text-black border-white" : "bg-gray-800 text-gray-400 border-gray-700"
                                                )}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {selectedRegion !== 'all' && (
                                <div className="space-y-2 animate-scale-in">
                                    <label className="text-xs text-gray-400 ml-1">상세 지역 (구/군)</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => onDistrictSelect('all')}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                                                selectedDistrict === 'all' ? "bg-white text-black border-white" : "bg-gray-800 text-gray-400 border-gray-700"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {districts.map(d => (
                                            <button
                                                key={d}
                                                onClick={() => onDistrictSelect(d)}
                                                className={clsx(
                                                    "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                                                    selectedDistrict === d ? "bg-white text-black border-white" : "bg-gray-800 text-gray-400 border-gray-700"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ALARM MENU */}
                    {activeMenu === 'alarm' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-white px-1">키워드 알림 설정</h3>
                            <p className="text-sm text-gray-400 px-1">
                                등록한 키워드가 포함된 공연이 있으면 홈 화면 타이틀에서 알려드려요.
                            </p>

                            <form onSubmit={handleKeywordSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    placeholder="키워드 입력 (예: 뮤지컬, 아이유)"
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={!keywordInput.trim()}
                                    className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    추가
                                </button>
                            </form>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 ml-1">등록된 키워드</label>
                                {keywords.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                                        등록된 키워드가 없습니다.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map(k => (
                                            <div key={k} className="flex items-center gap-2 bg-gray-800 text-white px-3 py-1.5 rounded-full border border-gray-700 group hover:border-red-500/50 transition-colors">
                                                <span className="text-sm">{k}</span>
                                                <button
                                                    onClick={() => onKeywordRemove(k)}
                                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}
