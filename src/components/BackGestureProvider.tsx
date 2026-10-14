'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBackGesture, useBackNavigation } from '@/hooks/useBackGesture';

export function BackGestureProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { goBack, history } = useBackNavigation();
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);

  // Track history
  useEffect(() => {
    // Only add to history if it's a new route (not a back navigation)
    const lastPath = history[history.length - 1];
    if (pathname !== lastPath) {
      // We need to use the internal setter, but since we can't access it directly,
      // we'll rely on the hook's internal state
    }
  }, [pathname, history]);

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touch.clientX > 80) return;

    startX.current = touch.clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    if (deltaX < 0) return;

    const progress = Math.min(deltaX / 120, 1);
    setDragProgress(progress);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragProgress > 0.4) {
      const handled = goBack();
      if (handled) {
        setDragProgress(0);
        return;
      }
    }
    setDragProgress(0);
  };

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragProgress, goBack]);

  // Visual feedback overlay
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 9999,
    background: `linear-gradient(90deg, rgba(74, 111, 165, ${dragProgress * 0.1}) 0%, transparent 60%)`,
    transform: `translateX(${dragProgress * 30}px)`,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out, background 0.2s ease-out',
  };

  return (
    <>
      {children}
      {isDragging && dragProgress > 0 && (
        <div style={overlayStyle} aria-hidden="true" />
      )}
    </>
  );
}