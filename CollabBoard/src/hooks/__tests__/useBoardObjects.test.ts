import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockAddObject = vi.fn();
const mockUpdateObject = vi.fn();
const mockDeleteObject = vi.fn();
const mockClearObjects = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

vi.mock('../../firebase/config', () => ({
  db: {},
}));

vi.mock('../../firebase/firestore', () => ({
  addObject: (...args: unknown[]) => mockAddObject(...args),
  updateObject: (...args: unknown[]) => mockUpdateObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  clearObjects: (...args: unknown[]) => mockClearObjects(...args),
}));

describe('useBoardObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('mock-collection');
    mockOnSnapshot.mockImplementation((_collection: unknown, callback: (snap: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
      callback({ docs: [] });
      return vi.fn();
    });
    mockAddObject.mockResolvedValue(undefined);
    mockUpdateObject.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);
    mockClearObjects.mockResolvedValue(undefined);
  });

  it('should return empty objects array initially', async () => {
    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));
    await waitFor(() => {
      expect(result.current.objects).toEqual([]);
    });
  });

  it('should update objects when snapshot fires', async () => {
    const mockObj = {
      id: 'obj-1',
      type: 'sticky',
      x: 100,
      y: 200,
      width: 150,
      height: 100,
      rotation: 0,
      text: 'Hello',
      color: '#FFE066',
      createdBy: 'user-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: 'user-1',
    };

    mockOnSnapshot.mockImplementation((_col: unknown, cb: (snap: { docs: Array<{ id: string; data: () => typeof mockObj }> }) => void) => {
      cb({
        docs: [{ id: 'obj-1', data: () => mockObj }],
      });
      return vi.fn();
    });

    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));
    await waitFor(() => {
      expect(result.current.objects).toHaveLength(1);
      expect(result.current.objects[0].id).toBe('obj-1');
    });
  });

  it('should call addObject when adding', async () => {
    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));

    await act(async () => {
      await result.current.addObject({
        id: 'obj-2',
        type: 'sticky',
        x: 0,
        y: 0,
        width: 150,
        height: 100,
        rotation: 0,
        text: '',
        color: '#FFE066',
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: 'user-1',
      });
    });

    expect(mockAddObject).toHaveBeenCalledWith('board-1', expect.objectContaining({ id: 'obj-2' }));
  });

  it('should call updateObject when updating', async () => {
    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));

    await act(async () => {
      await result.current.updateObject('obj-1', { x: 500 });
    });

    expect(mockUpdateObject).toHaveBeenCalledWith('board-1', 'obj-1', { x: 500 });
  });

  it('should call deleteObject when deleting', async () => {
    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));

    await act(async () => {
      await result.current.deleteObject('obj-1');
    });

    expect(mockDeleteObject).toHaveBeenCalledWith('board-1', 'obj-1');
  });

  it('should call clearObjects when clearing', async () => {
    const { useBoardObjects } = await import('../useBoardObjects');
    const { result } = renderHook(() => useBoardObjects('board-1'));

    await act(async () => {
      await result.current.clearObjects();
    });

    expect(mockClearObjects).toHaveBeenCalledWith('board-1');
  });
});
