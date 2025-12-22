import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Search, Grid3X3, List, CalendarDays, Map, LayoutGrid, Mic2, Music, Ticket, Frame, Baby, Star } from 'lucide-react';
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

    // Helper to get genre icon
    const getGenreIcon = (id: string) => {
        switch (id) {
            case 'concert': return Mic2;
            case 'classic': return Music;
            case 'musical': return Ticket; // Fallback or specific
            case 'exhibition': return Frame;
            case 'kids': return Baby;
            default: return LayoutGrid;
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
                    "fixed bottom-16 left-0 right-0 z-[9985] bg-[#1a0b2e]/95 backdrop-blur-2xl border-t border-purple-500/20 rounded-t-3xl transition-transform duration-300 ease-out max-h-[70vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe",
                    activeMenu ? "translate-y-0 opacity-100" : "translate-y-full opacity-50"
                )}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-600/50 rounded-full cursor-pointer hover:bg-gray-500 transition-colors" />
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto custom-scrollbar">

                    {/* VIEW MENU */}
                    {activeMenu === 'view' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4 px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 보기 방식
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'grid', label: '썸네일 보기', desc: '포스터 중심', icon: Grid3X3, color: 'text-purple-400' },
                                    { id: 'list', label: '리스트 보기', desc: '정보 중심', icon: List, color: 'text-blue-400' },
                                    { id: 'calendar', label: '달력 보기', desc: '일자별 일정', icon: CalendarDays, color: 'text-green-400' },
                                    { id: 'map', label: '지도 보기', desc: '위치 기반', icon: Map, color: 'text-orange-400' }
                                ].map((mode) => {
                                    const Icon = mode.icon;
                                    const isSelected = viewMode === mode.id;
                                    return (
                                        <button
                                            key={mode.id}
                                            onClick={() => { onViewModeChange(mode.id); onClose(); }}
                                            className={clsx(
                                                "p-4 rounded-2xl border text-left transition-all duration-300 group hover:scale-[1.02]",
                                                isSelected
                                                    ? "bg-white/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                                    : "bg-gray-900/50 border-white/5 hover:bg-gray-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={clsx("p-2 rounded-lg bg-gray-800", isSelected ? "text-white" : mode.color)}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="text-sm font-bold text-gray-200">{mode.label}</div>
                                            </div>
                                            <div className={clsx("text-xs pl-1", isSelected ? "text-gray-300" : "text-gray-500")}>
                                                {mode.desc}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CATEGORY MENU */}
                    {activeMenu === 'category' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4 px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 카테고리
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                <button
                                    onClick={() => { onGenreSelect('all'); onClose(); }}
                                    className={clsx(
                                        "aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all border",
                                        selectedGenre === 'all'
                                            ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50"
                                            : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800 hover:border-white/10"
                                    )}
                                >
                                    <LayoutGrid size={24} />
                                    <span className="text-sm font-medium">전체</span>
                                </button>

                                {GENRES.filter(g => g.id !== 'hotdeal').map(genre => {
                                    const GenreIcon = getGenreIcon(genre.id);
                                    const isSelected = selectedGenre === genre.id;
                                    return (
                                        <button
                                            key={genre.id}
                                            onClick={() => { onGenreSelect(genre.id); onClose(); }}
                                            className={clsx(
                                                "aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all border",
                                                isSelected
                                                    ? `${GENRE_STYLES[genre.id]?.twBg.replace('bg-', 'bg-') || 'bg-gray-600'} text-white border-transparent ring-2 ring-white/20 shadow-lg`
                                                    : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800 hover:border-white/10"
                                            )}
                                        >
                                            <GenreIcon size={24} />
                                            <span className="text-sm font-medium">{genre.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* LOCATION MENU */}
                    {activeMenu === 'location' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 위치 및 검색
                            </h3>

                            {/* Search Bar */}
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="공연명, 출연진, 장소 검색..."
                                    className="w-full bg-gray-900/80 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-base"
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-400 transition-colors w-5 h-5" />
                            </div>

                            {/* Location Selectors */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block uppercase tracking-wider">지역 (시/도)</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => onRegionSelect('all')}
                                            className={clsx(
                                                "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                                                selectedRegion === 'all'
                                                    ? "bg-purple-600 text-white border-purple-500 shadow-md"
                                                    : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {REGIONS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => onRegionSelect(r.id)}
                                                className={clsx(
                                                    "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                                                    selectedRegion === r.id
                                                        ? "bg-white text-black border-white shadow-md font-bold"
                                                        : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800"
                                                )}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedRegion !== 'all' && (
                                    <div className="animate-fade-in-up">
                                        <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block uppercase tracking-wider">상세 지역 (구/군)</label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-gray-900/30 rounded-2xl border border-white/5">
                                            <button
                                                onClick={() => onDistrictSelect('all')}
                                                className={clsx(
                                                    "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                                    selectedDistrict === 'all'
                                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                                                        : "bg-gray-800 text-gray-400 border-gray-700"
                                                )}
                                            >
                                                전체
                                            </button>
                                            {districts.map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => onDistrictSelect(d)}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                                        selectedDistrict === d
                                                            ? "bg-white text-black border-white font-bold"
                                                            : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                                                    )}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ALARM MENU */}
                    {activeMenu === 'alarm' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 키워드 알림
                            </h3>
                            <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-4">
                                <p className="text-sm text-purple-200/80 leading-relaxed">
                                    등록한 키워드가 포함된 공연이 오픈되면<br />
                                    홈 화면에서 가장 먼저 알려드려요! 🔔
                                </p>
                            </div>

                            <form onSubmit={handleKeywordSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    placeholder="키워드 입력 (예: 뮤지컬, 아이유)"
                                    className="flex-1 bg-gray-900/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={!keywordInput.trim()}
                                    className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-500 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-purple-900/50"
                                >
                                    추가
                                </button>
                            </form>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-500 ml-1 block uppercase tracking-wider">등록된 키워드</label>
                                {keywords.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-2xl border border-dashed border-white/5">
                                        아직 등록된 키워드가 없어요.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map(k => (
                                            <div key={k} className="flex items-center gap-2 bg-gray-800 text-white pl-4 pr-2 py-2 rounded-full border border-gray-700 group hover:border-red-500/30 transition-all hover:bg-gray-750">
                                                <span className="text-sm font-medium">{k}</span>
                                                <button
                                                    onClick={() => onKeywordRemove(k)}
                                                    className="p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <X size={14} />
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
