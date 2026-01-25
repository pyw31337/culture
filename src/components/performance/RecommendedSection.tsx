import React from 'react';
import { Performance } from '@/types';
import { Sparkles } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { GENRES } from '@/lib/constants';

interface RecommendedSectionProps {
    recommendedItems: Performance[];
    onDetail: (perf: Performance) => void;
}

export default function RecommendedSection({ recommendedItems, onDetail }: RecommendedSectionProps) {
    if (!recommendedItems || recommendedItems.length === 0) return null;

    return (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400 animate-pulse-slow" />
                <h3 className="text-xl font-bold text-white light:text-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200 light:from-purple-600 light:to-pink-600">
                    회원님을 위한 맞춤 추천
                </h3>
            </div>

            <div className="relative group">
                {/* Horizontal Scroll Container */}
                <div className="flex overflow-x-auto gap-4 pb-4 px-1 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {recommendedItems.map((item, idx) => (
                        <div
                            key={`rec-${item.id}`}
                            onClick={() => onDetail(item)}
                            className="snap-start shrink-0 w-[160px] sm:w-[180px] flex flex-col gap-2 cursor-pointer group/card relative"
                        >
                            {/* Image Card */}
                            <div className="aspect-[3/4] relative rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover/card:shadow-purple-500/20 transition-all duration-300 group-hover/card:scale-[1.02]">
                                <ImageWithFallback
                                    src={item.image}
                                    alt={item.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                                    sizes="180px"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                                {/* Rank/Tag Badge */}
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-yellow-300 border border-yellow-500/30">
                                    추천 #{idx + 1}
                                </div>
                            </div>

                            {/* Text Info */}
                            <div>
                                <h4 className="text-white light:text-black font-bold text-sm truncate pr-2 group-hover/card:text-[#a78bfa] transition-colors">{item.title}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-400 light:text-gray-600">
                                    <span>{GENRES.find(g => g.id === item.genre)?.label || item.genre}</span>
                                    <span className="w-0.5 h-0.5 rounded-full bg-gray-500" />
                                    <span className="truncate max-w-[80px]">{item.date.split('~')[0].trim()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Scroll Fade Hints */}
                <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none sm:hidden light:from-white" />
            </div>
        </div>
    );
}
