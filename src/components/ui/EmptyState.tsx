'use client';

import React from 'react';
import { Search, Compass, Sparkles, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    type?: 'search' | 'filter' | 'error';
    searchQuery?: string;
    onReset?: () => void;
    suggestions?: { label: string; onClick: () => void }[];
}

/**
 * Empty State component for when no results are found.
 * Provides visual feedback and suggested actions to prevent user abandonment.
 */
export default function EmptyState({
    type = 'search',
    searchQuery = '',
    onReset,
    suggestions = []
}: EmptyStateProps) {
    const getContent = () => {
        switch (type) {
            case 'search':
                return {
                    icon: <Search className="w-16 h-16 text-gray-300 dark:text-gray-600" />,
                    title: '검색 결과가 없습니다',
                    description: searchQuery
                        ? `"${searchQuery}"에 대한 결과를 찾을 수 없습니다`
                        : '검색어를 입력해 주세요',
                };
            case 'filter':
                return {
                    icon: <Compass className="w-16 h-16 text-gray-300 dark:text-gray-600" />,
                    title: '조건에 맞는 결과가 없습니다',
                    description: '필터 조건을 변경해 보세요',
                };
            case 'error':
                return {
                    icon: <RefreshCw className="w-16 h-16 text-gray-300 dark:text-gray-600" />,
                    title: '데이터를 불러올 수 없습니다',
                    description: '잠시 후 다시 시도해 주세요',
                };
            default:
                return {
                    icon: <Sparkles className="w-16 h-16 text-gray-300 dark:text-gray-600" />,
                    title: '아직 컨텐츠가 없습니다',
                    description: '곧 새로운 컨텐츠가 추가됩니다',
                };
        }
    };

    const { icon, title, description } = getContent();

    // Default suggestions if none provided
    const defaultSuggestions = [
        { label: '🎭 뮤지컬', genre: 'musical' },
        { label: '🎵 콘서트', genre: 'concert' },
        { label: '🖼️ 전시', genre: 'exhibition' },
        { label: '🎪 축제', genre: 'festival' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
            {/* Animated Icon */}
            <motion.div
                animate={{
                    scale: [1, 1.05, 1],
                    rotate: type === 'error' ? [0, 360] : 0
                }}
                transition={{
                    scale: { repeat: Infinity, duration: 2 },
                    rotate: { duration: 2, ease: 'linear', repeat: type === 'error' ? Infinity : 0 }
                }}
                className="mb-6"
            >
                {icon}
            </motion.div>

            {/* Text */}
            <h3 className="text-xl font-extrabold text-gray-700 dark:text-gray-300 mb-2">
                {title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                {description}
            </p>

            {/* Reset Button */}
            {onReset && (
                <button
                    onClick={onReset}
                    className="mb-6 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 
                               text-white font-semibold rounded-full shadow-lg
                               hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                    전체 보기
                </button>
            )}

            {/* Suggestions */}
            {(suggestions.length > 0 || type === 'search') && (
                <div className="mt-4">
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
                        이런 카테고리는 어떠세요?
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {(suggestions.length > 0 ? suggestions : defaultSuggestions.map(s => ({
                            label: s.label,
                            onClick: () => window.location.href = `/culture/${s.genre}`
                        }))).map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={suggestion.onClick}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 
                                           text-gray-700 dark:text-gray-300 text-sm
                                           rounded-full hover:bg-gray-200 dark:hover:bg-gray-700
                                           transition-colors duration-200"
                            >
                                {suggestion.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
