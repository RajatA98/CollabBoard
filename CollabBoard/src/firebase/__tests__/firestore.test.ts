import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockGetDocs = vi.fn();
const mockWriteBatch = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
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
    mockWriteBatch.mockImplementation(() => ({
      delete: (...args: unknown[]) => mockBatchDelete(...args),
      commit: (...args: unknown[]) => mockBatchCommit(...args),
    }));
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

  it('clearObjects should batch delete all docs', async () => {
    const { clearObjects } = await import('../firestore');

    mockGetDocs.mockResolvedValue({
      docs: [{ ref: 'doc-ref-1' }, { ref: 'doc-ref-2' }, { ref: 'doc-ref-3' }],
    });

    await clearObjects('board-1');

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1', 'objects');
    expect(mockGetDocs).toHaveBeenCalledWith('mock-collection-ref');
    expect(mockWriteBatch).toHaveBeenCalledWith(expect.anything());
    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});
