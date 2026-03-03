import { useState, useEffect, useRef, useCallback } from 'react';
import { HERO_TEMPLATES, HeroTemplate } from '@/lib/hero-templates';
import { Performance } from '@/types';
import venueData from '@/data/venue-dictionary.json';
import { safeStorage } from '@/lib/safeStorage';

const venues = venueData as Record<string, any>;

interface UseHeroTemplatesProps {
    allPerformances: Performance[];
    initialPerformances: Performance[];
    searchMode?: 'keyword' | 'location';
}

export function useHeroTemplates({ allPerformances, initialPerformances, searchMode = 'keyword' }: UseHeroTemplatesProps) {
    const [heroText, setHeroText] = useState<HeroTemplate>(HERO_TEMPLATES.general[0]);
    const templatePoolRef = useRef<HeroTemplate[]>([]);

    const selectNextTemplate = useCallback(() => {
        setHeroText(currentHeroText => {
            const pool = templatePoolRef.current.length > 0 ? templatePoolRef.current : HERO_TEMPLATES.general;
            let selectedTemplate: HeroTemplate = HERO_TEMPLATES.general[0];
            let attempts = 0;
            const maxAttempts = 20;

            while (pool.length > 0 && attempts < maxAttempts) {
                const idx = Math.floor(Math.random() * pool.length);
                const candidate = pool[idx];
                attempts++;

                if (candidate.line1 === currentHeroText.line1) continue;

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

            if (selectedTemplate.line1 === currentHeroText.line1 || attempts >= maxAttempts) {
                const backups = HERO_TEMPLATES.general.filter(t => t.line1 !== currentHeroText.line1);
                selectedTemplate = backups[Math.floor(Math.random() * backups.length)] || HERO_TEMPLATES.general[0];
            }
            return selectedTemplate;
        });
    }, [allPerformances, initialPerformances]);

    useEffect(() => {
        const updateHeroTextPool = async () => {
            const now = new Date();
            const month = now.getMonth() + 1;
            const hour = now.getHours();
            const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
            let pool: HeroTemplate[] = [...HERO_TEMPLATES.general];

            // 1. Seasons
            let currentSeasonTemplates: HeroTemplate[] = [];
            if (month >= 3 && month <= 5) currentSeasonTemplates = HERO_TEMPLATES.season.spring;
            else if (month >= 6 && month <= 8) currentSeasonTemplates = HERO_TEMPLATES.season.summer;
            else if (month >= 9 && month <= 11) currentSeasonTemplates = HERO_TEMPLATES.season.autumn;
            else currentSeasonTemplates = HERO_TEMPLATES.season.winter;
            pool.push(...currentSeasonTemplates);

            // 2. Time of Day
            if (hour >= 5 && hour < 12) pool.push(...HERO_TEMPLATES.time.morning);
            else if (hour >= 12 && hour < 17) pool.push(...HERO_TEMPLATES.time.afternoon);
            else if (hour >= 17 && hour < 22) pool.push(...HERO_TEMPLATES.time.evening);
            else pool.push(...HERO_TEMPLATES.time.night);

            // 3. Special Days
            if (day === 5) pool.push(...HERO_TEMPLATES.time.friday);
            if (day === 0 || day === 6) pool.push(...HERO_TEMPLATES.time.weekend);

            // 4. Mode-based templates
            if (searchMode === 'location') pool.push(...HERO_TEMPLATES.location_mode);
            else pool.push(...HERO_TEMPLATES.search_mode);

            // 5. Keyword Context (from storage)
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
    }, [allPerformances, initialPerformances, searchMode, selectNextTemplate]);

    return {
        heroText,
        selectNextTemplate
    };
}
