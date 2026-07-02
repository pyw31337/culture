import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

type DragState = {
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    distance: number;
    hasCapture: boolean;
};

export function useHorizontalDragScroll<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const dragState = useRef<DragState>({
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        distance: 0,
        hasCapture: false,
    });
    const isDraggingRef = useRef(false);
    const settleTimerRef = useRef<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [elasticOffset, setElasticOffset] = useState(0);
    const [isSettling, setIsSettling] = useState(false);

    useEffect(() => {
        return () => {
            if (settleTimerRef.current !== null) {
                window.clearTimeout(settleTimerRef.current);
            }
        };
    }, []);

    const endDrag = useCallback((event?: ReactPointerEvent<T>) => {
        const element = ref.current;
        if (event && element && dragState.current.pointerId === event.pointerId && dragState.current.hasCapture) {
            try {
                element.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture may already be released by the browser.
            }
        }
        dragState.current.pointerId = null;
        dragState.current.hasCapture = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        if (settleTimerRef.current !== null) {
            window.clearTimeout(settleTimerRef.current);
        }
        setIsSettling(true);
        setElasticOffset(0);
        settleTimerRef.current = window.setTimeout(() => {
            setIsSettling(false);
            settleTimerRef.current = null;
        }, 220);
    }, []);

    const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
        const element = ref.current;
        if (!element) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;

        dragState.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: element.scrollLeft,
            distance: 0,
            hasCapture: false,
        };
    }, []);

    const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
        const element = ref.current;
        const state = dragState.current;
        if (!element || state.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - state.startX;
        state.distance = Math.max(state.distance, Math.abs(deltaX));
        if (state.distance > 3) {
            isDraggingRef.current = true;
            setIsDragging(true);
            if (!state.hasCapture) {
                try {
                    element.setPointerCapture(event.pointerId);
                    state.hasCapture = true;
                } catch {
                    // Some browser/input combinations do not allow capture here.
                }
            }

            const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
            const nextScrollLeft = state.startScrollLeft - deltaX;
            if (nextScrollLeft < 0) {
                element.scrollLeft = 0;
                setElasticOffset(Math.min(72, -nextScrollLeft * 0.34));
            } else if (nextScrollLeft > maxScrollLeft) {
                element.scrollLeft = maxScrollLeft;
                setElasticOffset(-Math.min(72, (nextScrollLeft - maxScrollLeft) * 0.34));
            } else {
                element.scrollLeft = nextScrollLeft;
                setElasticOffset(0);
            }
            event.preventDefault();
        }
    }, []);

    const hasDragged = useCallback(() => {
        return isDraggingRef.current || dragState.current.distance > 10;
    }, []);

    const elasticStyle: CSSProperties = {
        transform: elasticOffset ? `translate3d(${elasticOffset}px, 0, 0)` : undefined,
        transition: isSettling ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
        willChange: isDragging || isSettling ? 'transform' : undefined,
    };

    return {
        ref,
        isDragging,
        hasDragged,
        elasticStyle,
        dragHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onLostPointerCapture: endDrag,
        },
    };
}
