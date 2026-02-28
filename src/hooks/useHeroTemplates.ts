import { useState, useEffect, useRef, useCallback } from 'react';
import { HERO_TEMPLATES, HeroTemplate } from '@/lib/hero-templates';
import { Performance } from '@/types';
import venueData from '@/data/venue-dictionary.json';
import { safeStorage } from '@/lib/safeStorage';

const venues = venueData as Record<string, any>;

interface UseHeroTemplatesProps {
    allPerformances: Performance[];
    initialPerformances: Performance[];
}

export function useHeroTemplates({ allPerformances, initialPerformances }: UseHeroTemplatesProps) {
    const [heroText, setHeroText] = useState<HeroTemplate>(HERO_TEMPLATES.general[0]);
    const templatePoolRef = useRef<HeroTemplate[]>([]);

    const selectNextTemplate = useCallback(() => {
        const pool = templatePoolRef.current.length > 0 ? templatePoolRef.current : HERO_TEMPLATES.general;
        let selectedTemplate: HeroTemplate = HERO_TEMPLATES.general[0];
        let attempts = 0;
        const maxAttempts = 20;

        while (pool.length > 0 && attempts < maxAttempts) {
            const idx = Math.floor(Math.random() * pool.length);
            const candidate = pool[idx];
            attempts++;

            if (candidate.line1 === heroText.line1) continue;

            if (candidate.keywords && candidate.keywords.length > 0) {
                const source = allPerformances.length > 0 ? allPerformances : initialPerformances;
                const hasMatch = source.some(p =>
                    candidate.keywords!.some(k =>
                        (p.title || '').includes(k) ||
                        (p.genre || '').includes(k) ||
                        (p.venue || '').includes(k) ||
                        (venues[p.venue || '']?.district?.includes(k))
                    )
                );
                if (!hasMatch) continue;
            }
            selectedTemplate = candidate;
            break;
        }

        if (selectedTemplate === heroText || attempts >= maxAttempts) {
            const backups = HERO_TEMPLATES.general.filter(t => t.line1 !== heroText.line1);
            selectedTemplate = backups[Math.floor(Math.random() * backups.length)] || HERO_TEMPLATES.general[0];
        }
        setHeroText(selectedTemplate);
    }, [heroText, allPerformances, initialPerformances]);

    useEffect(() => {
        const updateHeroTextPool = async () => {
            const now = new Date();
            const month = now.getMonth() + 1;
            let pool: typeof HERO_TEMPLATES.general = [...HERO_TEMPLATES.general];

            // Basic Seasons
            let currentSeasonTemplates: typeof HERO_TEMPLATES.general = [];
            if (month >= 3 && month <= 5) currentSeasonTemplates = HERO_TEMPLATES.season.spring;
            else if (month >= 6 && month <= 8) currentSeasonTemplates = HERO_TEMPLATES.season.summer;
            else if (month >= 9 && month <= 11) currentSeasonTemplates = HERO_TEMPLATES.season.autumn;
            else currentSeasonTemplates = HERO_TEMPLATES.season.winter;
            pool.push(...currentSeasonTemplates);

            // Keyword Context
            const sk = safeStorage.get<string[]>('culture_keywords', []);
            if (sk.length > 0) {
                const keywordTemplates = HERO_TEMPLATES.keyword.map(t => {
                    const randomKeyword = sk[Math.floor(Math.random() * sk.length)];
                    return {
                        ...t,
                        highlight: t.highlight.replace('{keyword}', randomKeyword),
                        keywords: t.keywords.map(k => k.replace('{keyword}', randomKeyword))
                    };
                });
                pool.push(...keywordTemplates);
            }

            templatePoolRef.current = pool;
            selectNextTemplate();
        };

        updateHeroTextPool();
    }, [allPerformances, initialPerformances]);

    return {
        heroText,
        selectNextTemplate
    };
}
