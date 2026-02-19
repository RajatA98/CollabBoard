import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_SCALE = 0.01;  // Can zoom out to 1% (see huge area)
const MAX_SCALE = 100;    // Can zoom in to 10,000% (see tiny details)
const VIEWPORT_STORAGE_KEY = (boardId: string) => `collabboard_viewport_${boardId}`;
const PERSIST_DEBOUNCE_MS = 400;

export interface ViewportState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function getDefaultViewport(boardId: string | undefined): ViewportState {
  if (!boardId || typeof window === 'undefined') {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  }
  try {
    const raw = localStorage.getItem(VIEWPORT_STORAGE_KEY(boardId));
    if (raw) {
      const parsed = JSON.parse(raw) as ViewportState;
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.scaleX === 'number' &&
        typeof parsed.scaleY === 'number'
      ) {
        return {
          x: parsed.x,
          y: parsed.y,
          scaleX: clampScale(parsed.scaleX),
          scaleY: clampScale(parsed.scaleY),
        };
      }
    }
  } catch {
    // ignore invalid stored viewport
  }
  const centerX = window.innerWidth / 2;
  const centerY = (window.innerHeight - 48) / 2;
  return { x: centerX, y: centerY, scaleX: 1, scaleY: 1 };
}

export function useViewport(boardId?: string) {
  const [viewport, setViewportState] = useState<ViewportState>(() =>
    getDefaultViewport(boardId)
  );

  const boardIdRef = useRef(boardId);
  const viewportRef = useRef(viewport);
  boardIdRef.current = boardId;
  viewportRef.current = viewport;

  // When boardId changes, restore viewport for that board (or center for new)
  useEffect(() => {
    setViewportState(getDefaultViewport(boardId));
  }, [boardId]);

  const setViewport = useCallback((next: ViewportState | ((prev: ViewportState) => ViewportState)) => {
    setViewportState((prev) => {
      const nextState = typeof next === 'function' ? next(prev) : next;
      return {
        ...nextState,
        scaleX: clampScale(nextState.scaleX),
        scaleY: clampScale(nextState.scaleY),
      };
    });
  }, []);

  const setPosition = useCallback((x: number, y: number) => {
    setViewportState((prev) => ({ ...prev, x, y }));
  }, []);

  const setScale = useCallback((scale: number) => {
    const clamped = clampScale(scale);
    setViewportState((prev) => ({ ...prev, scaleX: clamped, scaleY: clamped }));
  }, []);

  const zoomAtPoint = useCallback((newScale: number, pointerX: number, pointerY: number) => {
    const clamped = clampScale(newScale);
    setViewportState((prev) => {
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

  // Persist viewport to localStorage (debounced) and on unload
  useEffect(() => {
    const bid = boardIdRef.current;
    if (!bid || typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(VIEWPORT_STORAGE_KEY(bid), JSON.stringify(viewport));
      } catch {
        // ignore quota / private browsing
      }
    }, PERSIST_DEBOUNCE_MS);

    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(VIEWPORT_STORAGE_KEY(bid), JSON.stringify(viewportRef.current));
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [viewport, boardId]);

  return { viewport, setViewport, setPosition, setScale, zoomAtPoint };
}
