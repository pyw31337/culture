import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type DragState = {
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    distance: number;
};

export function useHorizontalDragScroll<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const dragState = useRef<DragState>({
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        distance: 0,
    });
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const endDrag = useCallback((event?: ReactPointerEvent<T>) => {
        const element = ref.current;
        if (event && element && dragState.current.pointerId === event.pointerId) {
            try {
                element.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture may already be released by the browser.
            }
        }
        dragState.current.pointerId = null;
        isDraggingRef.current = false;
        setIsDragging(false);
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
        };
        try {
            element.setPointerCapture(event.pointerId);
        } catch {
            // Some browser/input combinations do not allow capture here.
        }
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
            element.scrollLeft = state.startScrollLeft - deltaX;
            event.preventDefault();
        }
    }, []);

    const hasDragged = useCallback(() => {
        return isDraggingRef.current || dragState.current.distance > 10;
    }, []);

    return {
        ref,
        isDragging,
        hasDragged,
        dragHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onLostPointerCapture: endDrag,
        },
    };
}
