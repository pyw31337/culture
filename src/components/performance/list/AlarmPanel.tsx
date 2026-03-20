import React from 'react';
import { Bell, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

interface AlarmPanelProps {
    isOpen: boolean;
    onClose: () => void;
    keywordInput: string;
    onKeywordInputChange: (val: string) => void;
    onAddKeyword: (val: string) => void;
    savedKeywords: string[];
    onRemoveKeyword: (val: string) => void;
}

export const AlarmPanel = ({
    isOpen,
    onClose,
    keywordInput,
    onKeywordInputChange,
    onAddKeyword,
    savedKeywords,
    onRemoveKeyword
}: AlarmPanelProps) => {
    const t = useTranslations('Alarm');
    const ta = useTranslations('Actions');

    return (
        <div className={clsx(
            "absolute top-16 sm:top-20 left-0 right-0 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl border-b border-purple-500/20 light:border-black/5 shadow-2xl transition-all duration-300 ease-out overflow-hidden origin-top z-40",
            isOpen ? "max-h-[500px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-4"
        )}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-extrabold text-white light:text-black flex items-center gap-2">
                        <Bell size={18} className="text-purple-400 light:text-purple-600" />
                        <span className="text-purple-100 light:text-gray-800">{t('title')}</span>
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-500 hover:text-white light:hover:text-black hover:bg-white/10 light:hover:bg-black/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (keywordInput.trim()) {
                            onAddKeyword(keywordInput.trim());
                            onKeywordInputChange('');
                        }
                    }}
                    className="flex gap-2 mb-4"
                >
                    <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => onKeywordInputChange(e.target.value)}
                        placeholder={t('placeholder')}
                        className="flex-1 bg-gray-900/80 light:bg-gray-100 border border-white/10 light:border-black/10 rounded-lg px-3 py-2 text-sm text-white light:text-black focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!keywordInput.trim()}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-extrabold hover:bg-purple-500 disabled:opacity-50 transition-all font-semibold"
                    >
                        {ta('add')}
                    </button>
                </form>
                {/* Keyword List */}
                <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">{t('registered')}</label>
                    {savedKeywords.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-white/5 text-xs">
                            {t('empty')}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                            {savedKeywords.map(k => (
                                <div key={k} className="flex items-center gap-1.5 bg-gray-800 light:bg-white text-white light:text-black pl-3 pr-1.5 py-1.5 rounded-full border border-gray-700 light:border-gray-300 hover:border-purple-500/30 transition-all">
                                    <span className="text-xs font-semibold">{k}</span>
                                    <button
                                        onClick={() => onRemoveKeyword(k)}
                                        className="p-0.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default AlarmPanel;
