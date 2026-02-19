import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/database
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockRemove = vi.fn().mockResolvedValue(undefined);
const mockOnValue = vi.fn().mockReturnValue(vi.fn()); // returns unsubscribe
const mockOnDisconnect = vi.fn().mockReturnValue({ remove: vi.fn() });
const mockRef = vi.fn().mockReturnValue('mock-ref');

vi.mock('firebase/database', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  set: (...args: unknown[]) => mockSet(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  onValue: (...args: unknown[]) => mockOnValue(...args),
  onDisconnect: (...args: unknown[]) => mockOnDisconnect(...args),
}));

vi.mock('../config', () => ({
  rtdb: 'mock-rtdb',
}));

describe('RTDB Live Transform operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRef.mockReturnValue('mock-ref');
  });

  it('setTransform should write transform data to correct RTDB path', async () => {
    const { setTransform } = await import('../rtdb');
    const data = {
      objectId: 'obj-1',
      x: 100, y: 200, width: 300, height: 150, rotation: 45,
      userName: 'Alice', userColor: '#FF6B6B', lastActive: Date.now(),
    };

    await setTransform('board-1', 'user-1', data);

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/transforms/user-1');
    expect(mockSet).toHaveBeenCalledWith('mock-ref', data);
  });

  it('removeTransform should remove data at correct path', async () => {
    const { removeTransform } = await import('../rtdb');

    await removeTransform('board-1', 'user-1');

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/transforms/user-1');
    expect(mockRemove).toHaveBeenCalledWith('mock-ref');
  });

  it('onTransformsChange should listen to all transforms', async () => {
    const { onTransformsChange } = await import('../rtdb');
    const callback = vi.fn();

    const unsubscribe = onTransformsChange('board-1', callback);

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/transforms');
    expect(mockOnValue).toHaveBeenCalledWith('mock-ref', expect.any(Function), expect.any(Function));
    expect(typeof unsubscribe).toBe('function');
  });

  it('onTransformsChange callback should receive parsed data', async () => {
    const { onTransformsChange } = await import('../rtdb');
    const callback = vi.fn();

    // Capture the onValue callback
    mockOnValue.mockImplementation((_ref: unknown, cb: (snap: { val: () => unknown }) => void) => {
      cb({ val: () => ({ 'user-1': { objectId: 'obj-1', x: 10, y: 20 } }) });
      return vi.fn();
    });

    onTransformsChange('board-1', callback);

    expect(callback).toHaveBeenCalledWith({ 'user-1': { objectId: 'obj-1', x: 10, y: 20 } });
  });

  it('onTransformsChange should handle null snapshot', async () => {
    const { onTransformsChange } = await import('../rtdb');
    const callback = vi.fn();

    mockOnValue.mockImplementation((_ref: unknown, cb: (snap: { val: () => unknown }) => void) => {
      cb({ val: () => null });
      return vi.fn();
    });

    onTransformsChange('board-1', callback);

    expect(callback).toHaveBeenCalledWith({});
  });

  it('setupTransformDisconnect should set onDisconnect remove', async () => {
    const { setupTransformDisconnect } = await import('../rtdb');
    const mockDisconnectRemove = vi.fn();
    mockOnDisconnect.mockReturnValue({ remove: mockDisconnectRemove });

    setupTransformDisconnect('board-1', 'user-1');

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/transforms/user-1');
    expect(mockOnDisconnect).toHaveBeenCalledWith('mock-ref');
    expect(mockDisconnectRemove).toHaveBeenCalled();
  });
});

describe('RTDB Live Editing operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRef.mockReturnValue('mock-ref');
  });

  it('setEditing should write editing data to correct RTDB path', async () => {
    const { setEditing } = await import('../rtdb');
    const data = {
      objectId: 'obj-2',
      text: 'Hello world',
      userName: 'Bob', userColor: '#51CF66', lastActive: Date.now(),
    };

    await setEditing('board-1', 'user-2', data);

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/editing/user-2');
    expect(mockSet).toHaveBeenCalledWith('mock-ref', data);
  });

  it('removeEditing should remove data at correct path', async () => {
    const { removeEditing } = await import('../rtdb');

    await removeEditing('board-1', 'user-2');

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/editing/user-2');
    expect(mockRemove).toHaveBeenCalledWith('mock-ref');
  });

  it('onEditingsChange should listen to all editing data', async () => {
    const { onEditingsChange } = await import('../rtdb');
    const callback = vi.fn();

    const unsubscribe = onEditingsChange('board-1', callback);

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/editing');
    expect(mockOnValue).toHaveBeenCalledWith('mock-ref', expect.any(Function), expect.any(Function));
    expect(typeof unsubscribe).toBe('function');
  });

  it('onEditingsChange callback should receive parsed data', async () => {
    const { onEditingsChange } = await import('../rtdb');
    const callback = vi.fn();

    mockOnValue.mockImplementation((_ref: unknown, cb: (snap: { val: () => unknown }) => void) => {
      cb({ val: () => ({ 'user-2': { objectId: 'obj-2', text: 'typing...' } }) });
      return vi.fn();
    });

    onEditingsChange('board-1', callback);

    expect(callback).toHaveBeenCalledWith({ 'user-2': { objectId: 'obj-2', text: 'typing...' } });
  });

  it('setupEditingDisconnect should set onDisconnect remove', async () => {
    const { setupEditingDisconnect } = await import('../rtdb');
    const mockDisconnectRemove = vi.fn();
    mockOnDisconnect.mockReturnValue({ remove: mockDisconnectRemove });

    setupEditingDisconnect('board-1', 'user-2');

    expect(mockRef).toHaveBeenCalledWith('mock-rtdb', 'boards/board-1/editing/user-2');
    expect(mockOnDisconnect).toHaveBeenCalledWith('mock-ref');
    expect(mockDisconnectRemove).toHaveBeenCalled();
  });
});

describe('cleanupUserData should include transforms and editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRef.mockReturnValue('mock-ref');
  });

  it('should remove presence, cursor, transform, editing, and selection data', async () => {
    const { cleanupUserData } = await import('../rtdb');

    await cleanupUserData('board-1', 'user-1');

    // Should have been called with 5 different paths (presence, cursor, transform, editing, selection)
    const refCalls = mockRef.mock.calls.map((c: unknown[]) => c[1]);
    expect(refCalls).toContain('boards/board-1/presence/user-1');
    expect(refCalls).toContain('boards/board-1/cursors/user-1');
    expect(refCalls).toContain('boards/board-1/transforms/user-1');
    expect(refCalls).toContain('boards/board-1/editing/user-1');
    expect(refCalls).toContain('boards/board-1/selection/user-1');
    expect(mockRemove).toHaveBeenCalledTimes(5);
  });
});
