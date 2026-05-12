import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, MapPin, Heart } from 'lucide-react';
import type { FavoriteVenuePreference } from '@/types';
import Portal from './ui/Portal';

interface FavoriteVenuesModalProps {
    isOpen: boolean;
    onClose: () => void;
    favoriteVenues: FavoriteVenuePreference[];
    onRemove: (favoriteVenue: FavoriteVenuePreference) => void;
    onVenueClick: (favoriteVenue: FavoriteVenuePreference) => void;
}

const FavoriteVenuesModal = ({ isOpen, onClose, favoriteVenues, onRemove, onVenueClick }: FavoriteVenuesModalProps) => {
    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                        />

                        {/* Modal Container */}
                        <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                drag="y"
                                dragControls={undefined}
                                dragConstraints={{ top: 0, bottom: 0 }}
                                dragElastic={{ top: 0, bottom: 0.2 }}
                                onDragEnd={(e, info) => {
                                    if (info.offset.y > 100 || info.velocity.y > 500) {
                                        onClose();
                                    }
                                }}
                                className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col pointer-events-auto max-h-[80vh] cursor-grab active:cursor-grabbing"
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-white flex items-center gap-2"><Heart className="w-5 h-5 text-pink-500 fill-pink-500" />좋아요한 공연장</h2>
                                        <p className="text-sm text-gray-400 mt-1">
                                            총 <span className="text-pink-400 font-extrabold">{favoriteVenues.length}</span>개의 공연장이 있습니다
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Content - Scrollable List */}
                                <div className="overflow-y-auto p-4 flex-1">
                                    {favoriteVenues.length > 0 ? (
                                        <div className="space-y-3">
                                            {favoriteVenues.map((favoriteVenue) => (
                                                <motion.div
                                                    key={favoriteVenue.id}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl group hover:bg-white/10 transition-colors border border-white/5 hover:border-pink-500/30`}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 shrink-0">
                                                            <MapPin size={18} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                onClick={() => onVenueClick(favoriteVenue)}
                                                                className="text-gray-200 font-semibold truncate text-left hover:underline decoration-pink-400 decoration-2 underline-offset-4 block"
                                                            >
                                                                {favoriteVenue.venueName}
                                                            </button>
                                                            {favoriteVenue.address ? (
                                                                <p className="text-[11px] text-gray-500 mt-1 truncate">
                                                                    {favoriteVenue.address}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onRemove(favoriteVenue)}
                                                        className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 ml-2"
                                                        title="목록에서 삭제"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                                                <MapPin size={24} className="text-gray-600" />
                                            </div>
                                            <p className="text-gray-300 font-extrabold text-lg mb-1">좋아요한 공연장이 없습니다</p>
                                            <p className="text-gray-500 text-sm">지도에서 마음에 드는 공연장을 좋아요 해보세요!</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-white/10 bg-black/20 text-center">
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </Portal>
    );
};

export default FavoriteVenuesModal;
