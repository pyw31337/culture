'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { safeStorage } from '@/lib/safeStorage';

export default function InstallApp() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already dismissed or installed
        const hasDismissed = safeStorage.get('culture_install_dismissed', false);
        if (hasDismissed) return;

        const handler = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI to notify the user they can add to home screen
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Do not show again for this session/user
        safeStorage.set('culture_install_dismissed', true);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[9999] md:bottom-8 md:right-8 md:left-auto md:w-80 animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-[#a78bfa]/20 p-2 rounded-xl text-[#a78bfa]">
                        <Download size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">앱 설치하기</h4>
                        <p className="text-xs text-gray-400">더 빠르고 편하게 즐겨보세요!</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleInstallClick}
                        className="px-3 py-1.5 bg-[#a78bfa] hover:bg-[#9061f9] text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        설치
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-1.5 text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
