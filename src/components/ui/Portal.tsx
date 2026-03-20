import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: React.ReactNode;
    customContainer?: HTMLElement | null;
}

export default function Portal({ children, customContainer }: PortalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(children, customContainer || document.body);
}
