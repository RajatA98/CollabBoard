import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../config', () => ({
  db: {},
}));

describe('Firestore helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockCollection.mockReturnValue('mock-collection-ref');
  });

  it('addObject should write to firestore with correct path', async () => {
    const { addObject } = await import('../firestore');
    const obj = {
      id: 'obj-1',
      type: 'sticky' as const,
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

    await addObject('board-1', obj);
    expect(mockDoc).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('updateObject should update specific fields', async () => {
    const { updateObject } = await import('../firestore');
    await updateObject('board-1', 'obj-1', { x: 300, y: 400 });
    expect(mockDoc).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('deleteObject should remove the document', async () => {
    const { deleteObject } = await import('../firestore');
    await deleteObject('board-1', 'obj-1');
    expect(mockDoc).toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
