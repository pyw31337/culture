import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, List, Calendar, Heart, Star, ChevronDown, Check, Filter, Flame } from 'lucide-react';
import { GENRES, REGIONS } from '@/lib/constants';
import clsx from 'clsx';
import { useEffect } from 'react';

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;

    // View Mode
    viewMode: 'list' | 'map' | 'calendar';
    setViewMode: (mode: 'list' | 'map' | 'calendar') => void;

    // Filters
    selectedRegion: string;
    setSelectedRegion: (id: string) => void;
    selectedDistrict: string;
    setSelectedDistrict: (id: string) => void;
    selectedVenue: string;
    setSelectedVenue: (id: string) => void;
    selectedGenre: string;
    setSelectedGenre: (id: string) => void;

    // Toggles
    showLikes: boolean;
    setShowLikes: (show: boolean) => void;
    showFavoriteVenues: boolean;
    setShowFavoriteVenues: (show: boolean) => void;

    // Data
    districts: string[];
    venues: string[];
}

export default function SideMenu({
    isOpen,
    onClose,
    viewMode,
    setViewMode,
    selectedRegion,
    setSelectedRegion,
    selectedDistrict,
    setSelectedDistrict,
    selectedVenue,
    setSelectedVenue,
    selectedGenre,
    setSelectedGenre,
    showLikes,
    setShowLikes,
    showFavoriteVenues,
    setShowFavoriteVenues,
    districts,
    venues
}: SideMenuProps) {

    // Lock body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-[85%] max-w-[400px] bg-[#0a0a0a]/90 backdrop-blur-xl border-l border-white/10 z-[210] overflow-y-auto shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Filter className="w-5 h-5 text-[#a78bfa]" />
                                상세 설정
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                            {/* 1. View Mode */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">보기 모드</h3>
                                <div className="grid grid-cols-3 gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                                    {(['list', 'map', 'calendar'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            className={clsx(
                                                "flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 gap-1",
                                                viewMode === mode
                                                    ? "bg-gradient-to-br from-[#a78bfa] to-[#f472b6] text-white shadow-lg shadow-purple-500/20"
                                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                            )}
                                        >
                                            {mode === 'list' && <List className="w-5 h-5" />}
                                            {mode === 'map' && <Map className="w-5 h-5" />}
                                            {mode === 'calendar' && <Calendar className="w-5 h-5" />}
                                            <span className="text-xs font-medium">
                                                {mode === 'list' ? '리스트' : mode === 'map' ? '지도' : '달력'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 2. My Picks Toggle */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">나의 관심</h3>
                                <div className="space-y-3">
                                    {/* Likes Toggle */}
                                    <button
                                        onClick={() => setShowLikes(!showLikes)}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                                            showLikes
                                                ? "bg-pink-500/10 border-pink-500/50"
                                                : "bg-white/5 border-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("p-2 rounded-full", showLikes ? "bg-pink-500 text-white" : "bg-gray-800 text-gray-500")}>
                                                <Heart className={clsx("w-5 h-5", showLikes && "fill-current")} />
                                            </div>
                                            <div className="text-left">
                                                <div className={clsx("font-bold", showLikes ? "text-pink-400" : "text-gray-300")}>관심 공연</div>
                                                <div className="text-xs text-gray-500">찜한 공연 모아보기</div>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                                            showLikes ? "bg-pink-500" : "bg-gray-700"
                                        )}>
                                            <div className={clsx(
                                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-md",
                                                showLikes ? "left-7" : "left-1"
                                            )} />
                                        </div>
                                    </button>

                                    {/* Favorite Venues Toggle */}
                                    <button
                                        onClick={() => setShowFavoriteVenues(!showFavoriteVenues)}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                                            showFavoriteVenues
                                                ? "bg-yellow-500/10 border-yellow-500/50"
                                                : "bg-white/5 border-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("p-2 rounded-full", showFavoriteVenues ? "bg-yellow-500 text-white" : "bg-gray-800 text-gray-500")}>
                                                <Star className={clsx("w-5 h-5", showFavoriteVenues && "fill-current")} />
                                            </div>
                                            <div className="text-left">
                                                <div className={clsx("font-bold", showFavoriteVenues ? "text-yellow-400" : "text-gray-300")}>단골 공연장</div>
                                                <div className="text-xs text-gray-500">자주 가는 곳 모아보기</div>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                                            showFavoriteVenues ? "bg-yellow-500" : "bg-gray-700"
                                        )}>
                                            <div className={clsx(
                                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-md",
                                                showFavoriteVenues ? "left-7" : "left-1"
                                            )} />
                                        </div>
                                    </button>
                                </div>
                            </section>

                            {/* 3. Detailed Filter */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">상세 필터</h3>

                                {/* Region Grid */}
                                <div className="mb-6">
                                    <label className="text-xs text-gray-500 mb-2 block">지역 선택</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {REGIONS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedRegion(r.id);
                                                    setSelectedDistrict('all');
                                                    setSelectedVenue('all');
                                                }}
                                                className={clsx(
                                                    "py-2 rounded-lg text-xs font-bold transition-all",
                                                    selectedRegion === r.id
                                                        ? "bg-white text-black shadow-lg"
                                                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* District Select (Dependent) */}
                                {selectedRegion !== 'all' && (
                                    <div className="mb-6 animate-fadeIn">
                                        <label className="text-xs text-gray-500 mb-2 block">상세 지역</label>
                                        <div className="relative">
                                            <select
                                                value={selectedDistrict}
                                                onChange={(e) => {
                                                    setSelectedDistrict(e.target.value);
                                                    setSelectedVenue('all');
                                                }}
                                                className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#a78bfa] transition-colors"
                                            >
                                                <option value="all">전체 지역</option>
                                                {districts.map(d => (
                                                    <option key={d} value={d} className="bg-gray-900">{d}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {/* Venue Select (Dependent) */}
                                {(selectedRegion !== 'all' || selectedDistrict !== 'all') && (
                                    <div className="mb-6 animate-fadeIn">
                                        <label className="text-xs text-gray-500 mb-2 block">공연장 선택</label>
                                        <div className="relative">
                                            <select
                                                value={selectedVenue}
                                                onChange={(e) => setSelectedVenue(e.target.value)}
                                                className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#a78bfa] transition-colors"
                                            >
                                                <option value="all">전체 공연장</option>
                                                {venues.map(v => (
                                                    <option key={v} value={v} className="bg-gray-900">{v}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {/* Genre Chips */}
                                <div>
                                    <label className="text-xs text-gray-500 mb-2 block">장르 선택</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedGenre('all')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                selectedGenre === 'all'
                                                    ? "bg-white text-black border-white"
                                                    : "bg-transparent text-gray-400 border-white/20 hover:border-white/50"
                                            )}
                                        >
                                            전체
                                        </button>
                                        <button
                                            onClick={() => setSelectedGenre('hotdeal')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1",
                                                selectedGenre === 'hotdeal'
                                                    ? "bg-red-500 text-white border-red-500"
                                                    : "bg-transparent text-red-400 border-red-500/30 hover:border-red-500/60"
                                            )}
                                        >
                                            <Flame className="w-3 h-3" /> 핫딜
                                        </button>
                                        {GENRES.map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => setSelectedGenre(g.id)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                    selectedGenre === g.id
                                                        ? "bg-white text-black border-white"
                                                        : "bg-transparent text-gray-400 border-white/20 hover:border-white/50"
                                                )}
                                            >
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Footer (Reset / Close) */}
                        <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md absolute bottom-0 w-full flex gap-3">
                            <button
                                onClick={() => {
                                    // Reset all filters
                                    setSelectedRegion('all');
                                    setSelectedDistrict('all');
                                    setSelectedVenue('all');
                                    setSelectedGenre('all');
                                }}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-colors"
                            >
                                초기화
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#f472b6] text-white text-sm font-bold shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                            >
                                결과 보기
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
