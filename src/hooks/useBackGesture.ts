'use client';

import { useEffect, useRef, useState } from 'react';

interface UseBackGestureOptions {
  onBack?: () => boolean;
  threshold?: number;
  enabled?: boolean;
}

export function useBackGesture({
  onBack,
  threshold = 80,
  enabled = true,
}: UseBackGestureOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const startX = useRef(0);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX > threshold) return;

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

      if (dragProgress > 0.4 && onBack) {
        const handled = onBack();
        if (handled) return;
      }
      setDragProgress(0);
    };

    const target = elementRef.current || document.documentElement;
    target.addEventListener('touchstart', handleTouchStart, { passive: true });
    target.addEventListener('touchmove', handleTouchMove, { passive: true });
    target.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      target.removeEventListener('touchstart', handleTouchStart);
      target.removeEventListener('touchmove', handleTouchMove);
      target.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, onBack, isDragging, dragProgress]);

  return { isDragging, dragProgress, ref: elementRef };
}

export function useBackNavigation() {
  const [navHistory, setNavHistory] = useState<string[]>([]);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      setNavHistory((prev) => [...prev.slice(-10), url]);
    };

    handleRouteChange(window.location.pathname + window.location.search);

    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args) {
      originalPushState(...args);
      handleRouteChange(window.location.pathname + window.location.search);
    };

    const onPopState = () => {
      handleRouteChange(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.history.pushState = originalPushState;
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const goBack = () => {
    if (navHistory.length > 1) {
      window.history.back();
      return true;
    }
    return false;
  };

  return { goBack, history: navHistory };
}