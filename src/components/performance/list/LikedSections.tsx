import React from 'react';
import { Heart, MapPin } from 'lucide-react';
import PerformanceGrid from '../PerformanceGrid';
import ImageWithFallback from '../../ImageWithFallback';
import { FavoriteVenuePreference, Performance } from '@/types';
import { getRepresentativeVenueInfoForFavorite } from '@/lib/favorite-venues';

interface LikedSectionsProps {
    viewMode: string;
    allPerformances: Performance[];
    likedIds: string[];
    favoriteVenues: FavoriteVenuePreference[];
    venues: Record<string, any>;
    onToggleLike: (id: string, e: any) => void;
    onDetailOpen: (perf: Performance) => void;
    onSetSearchLocation: (loc: any) => void;
    onVenuePreview: (loc: any) => void;
    setIsMapOpen: (open: boolean) => void;
    copyItemShareUrl: (id: string) => Promise<boolean>;
    selectedGenre: string;
    searchMode: 'keyword' | 'location';
    searchText: string;
    setShowFavoriteListModal: (open: boolean) => void;
    layoutMode: 'grid' | 'list';
}

export const LikedSections = ({
    viewMode,
    allPerformances,
    likedIds,
    favoriteVenues,
    venues,
    onToggleLike,
    onDetailOpen,
    onSetSearchLocation,
    onVenuePreview,
    setIsMapOpen,
    copyItemShareUrl,
    selectedGenre,
    searchMode,
    searchText,
    setShowFavoriteListModal,
    layoutMode
}: LikedSectionsProps) => {
    if (viewMode !== 'likes-perf') return null;

    const likedPerformances = allPerformances.filter(p => likedIds.includes(p.id));

    return (
        <>
            {/* 좋아요한 컨텐츠 Section */}
            <h3 className="text-xl sm:text-2xl font-black text-white light:text-black flex items-center gap-3 mb-6">
                <Heart className="text-pink-400 light:text-pink-500 w-6 h-6 fill-pink-500 light:fill-pink-500" />
                좋아요한 컨텐츠 <span className="text-pink-400 light:text-pink-600 text-lg sm:text-xl">({likedPerformances.length})</span>
            </h3>
            {likedPerformances.length > 0 ? (
                <PerformanceGrid
                    items={likedPerformances}
                    hasMore={false}
                    observerRef={{ current: null } as any} // Not needed for likes
                    layoutMode={layoutMode}
                    selectedVenue="all"
                    activeLocation={null}
                    venues={venues}
                    likedIds={likedIds}
                    onToggleLike={onToggleLike}
                    handleDetailOpen={onDetailOpen}
                    setSearchLocation={onSetSearchLocation}
                    onVenuePreview={onVenuePreview}
                    setIsMapOpen={setIsMapOpen}
                    copyItemShareUrl={copyItemShareUrl}
                    selectedGenre={selectedGenre}
                    viewMode={viewMode}
                    searchMode={searchMode}
                    searchText={searchText}
                />
            ) : (
                <div className="text-center py-12 text-gray-400 light:text-gray-800">
                    <Heart className="w-12 h-12 mx-auto mb-4 text-gray-600 light:text-gray-400" />
                    <p className="text-lg font-semibold text-white light:text-black">좋아요한 컨텐츠가 없습니다</p>
                    <p className="text-sm mt-1 text-gray-500 light:text-gray-600">마음에 드는 공연/전시를 좋아요 해보세요!</p>
                </div>
            )}

            {/* 좋아요한 공연장 Section */}
            <div className="mb-10 mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl sm:text-2xl font-black text-white light:text-black flex items-center gap-3">
                        <MapPin className="text-pink-400 light:text-pink-500 w-6 h-6" />
                        좋아요한 공연장 <span className="text-pink-400 light:text-pink-600 text-lg sm:text-xl">({favoriteVenues.length})</span>
                    </h3>
                    <button
                        onClick={() => setShowFavoriteListModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300 transition-all text-sm font-semibold border border-pink-500/20"
                    >
                        공연장 편집
                    </button>
                </div>
                {favoriteVenues.length > 0 ? (
                    <div className="space-y-6 text-white light:text-black">
                        {favoriteVenues.map((favoriteVenue) => {
                            const venuePerfs = allPerformances.filter((performance) => {
                                if (favoriteVenue.locationKey && performance.locationKey) {
                                    return performance.locationKey === favoriteVenue.locationKey;
                                }
                                if (favoriteVenue.venueKey && performance.venueKey) {
                                    return performance.venueKey === favoriteVenue.venueKey;
                                }
                                return performance.venue === favoriteVenue.venueName;
                            });
                            return (
                                <div key={favoriteVenue.id}>
                                    <button
                                        onClick={() => {
                                            const vData = getRepresentativeVenueInfoForFavorite(favoriteVenue, venuePerfs, venues);
                                            onSetSearchLocation({ lat: vData?.lat || 0, lng: vData?.lng || 0, name: favoriteVenue.venueName });
                                            setIsMapOpen(true);
                                        }}
                                        className="flex items-center gap-2 mb-2 text-pink-300 light:text-pink-600 hover:text-pink-200 transition-colors"
                                    >
                                        <MapPin size={14} />
                                        <span className="font-semibold text-sm">{favoriteVenue.venueName}</span>
                                        <span className="text-xs text-gray-500">({venuePerfs.length}건)</span>
                                    </button>
                                    {venuePerfs.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {venuePerfs.slice(0, 5).map(perf => (
                                                <div
                                                    key={perf.id}
                                                    onClick={() => onDetailOpen(perf)}
                                                    className="cursor-pointer group/venue"
                                                >
                                                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-800 light:bg-gray-200 relative">
                                                        <ImageWithFallback
                                                            src={perf.image || perf.poster || ''}
                                                            backupSrc={perf.backupPoster || perf.posterUrl}
                                                            placeholderInput={{
                                                                title: perf.title,
                                                                genre: perf.genre,
                                                                matchLabel: perf.homeTeam && perf.awayTeam ? `${perf.homeTeam} vs ${perf.awayTeam}` : null,
                                                            }}
                                                            alt={perf.title}
                                                            fill
                                                            className="w-full h-full object-cover group-hover/venue:scale-105 transition-transform duration-300"
                                                            sizes="(max-width: 640px) 150px, 200px"
                                                            loading="lazy"
                                                            style={{ zIndex: 2 }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/venue:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-3 text-center z-20">
                                                            <h4 className="text-white font-bold text-xs sm:text-sm mb-2 line-clamp-2">{perf.title}</h4>
                                                            <div className="px-3 py-1.5 bg-white text-black font-extrabold text-[10px] sm:text-xs rounded-full shadow-xl">
                                                                자세히 보기
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 ml-6">현재 진행중인 공연이 없습니다</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-4 text-sm text-gray-500 light:text-black font-medium">
                        좋아요한 공연장이 없습니다. 지도에서 공연장을 좋아요 해보세요!
                    </div>
                )}
            </div>
        </>
    );
};
export default LikedSections;
