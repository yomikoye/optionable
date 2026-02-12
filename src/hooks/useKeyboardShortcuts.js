import { useEffect } from 'react';

export const useKeyboardShortcuts = ({ onEscape, isModalOpen, keyMap }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            // Escape - Close any modal
            if (e.key === 'Escape') {
                onEscape();
                return;
            }

            // Don't process other shortcuts if any modal is open
            if (isModalOpen) return;

            // Process key map
            if (keyMap[e.key] && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                keyMap[e.key]();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onEscape, isModalOpen, keyMap]);
};
