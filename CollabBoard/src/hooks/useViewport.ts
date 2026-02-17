import { useState, useCallback } from 'react';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

interface ViewportState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function useViewport() {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });

  const setPosition = useCallback((x: number, y: number) => {
    setViewport((prev) => ({ ...prev, x, y }));
  }, []);

  const setScale = useCallback((scale: number) => {
    const clamped = clampScale(scale);
    setViewport((prev) => ({ ...prev, scaleX: clamped, scaleY: clamped }));
  }, []);

  const zoomAtPoint = useCallback((newScale: number, pointerX: number, pointerY: number) => {
    const clamped = clampScale(newScale);
    setViewport((prev) => {
      const mousePointTo = {
        x: (pointerX - prev.x) / prev.scaleX,
        y: (pointerY - prev.y) / prev.scaleY,
      };
      return {
        x: pointerX - mousePointTo.x * clamped,
        y: pointerY - mousePointTo.y * clamped,
        scaleX: clamped,
        scaleY: clamped,
      };
    });
  }, []);

  return { viewport, setPosition, setScale, zoomAtPoint };
}
