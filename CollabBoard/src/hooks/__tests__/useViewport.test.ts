import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from '../useViewport';

describe('useViewport', () => {
  it('should return default viewport state', () => {
    const { result } = renderHook(() => useViewport());
    expect(result.current.viewport).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('should update position on pan', () => {
    const { result } = renderHook(() => useViewport());
    act(() => {
      result.current.setPosition(100, 200);
    });
    expect(result.current.viewport.x).toBe(100);
    expect(result.current.viewport.y).toBe(200);
  });

  it('should clamp zoom between 0.01 and 100', () => {
    const { result } = renderHook(() => useViewport());

    act(() => {
      result.current.setScale(0.001);
    });
    expect(result.current.viewport.scaleX).toBe(0.01);
    expect(result.current.viewport.scaleY).toBe(0.01);

    act(() => {
      result.current.setScale(200);
    });
    expect(result.current.viewport.scaleX).toBe(100);
    expect(result.current.viewport.scaleY).toBe(100);
  });

  it('should handle zoom toward a point', () => {
    const { result } = renderHook(() => useViewport());
    act(() => {
      result.current.zoomAtPoint(1.5, 400, 300);
    });
    expect(result.current.viewport.scaleX).toBe(1.5);
    expect(result.current.viewport.scaleY).toBe(1.5);
    // Position should adjust to keep the point fixed
    expect(result.current.viewport.x).not.toBe(0);
    expect(result.current.viewport.y).not.toBe(0);
  });

  it('should set valid scale values', () => {
    const { result } = renderHook(() => useViewport());
    act(() => {
      result.current.setScale(2);
    });
    expect(result.current.viewport.scaleX).toBe(2);
    expect(result.current.viewport.scaleY).toBe(2);
  });
});
