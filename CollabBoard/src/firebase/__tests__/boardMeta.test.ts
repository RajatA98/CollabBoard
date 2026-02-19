import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockArrayUnion = vi.fn((val) => ({ __arrayUnion: val }));
const mockArrayRemove = vi.fn((val) => ({ __arrayRemove: val }));
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockClearObjects = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../config', () => ({
  db: {},
}));

vi.mock('../firestore', () => ({
  clearObjects: (boardId: string) => mockClearObjects(boardId),
}));

describe('boardMeta helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockCollection.mockReturnValue('mock-collection-ref');
    mockQuery.mockReturnValue('mock-query');
    mockWhere.mockReturnValue('mock-where');
  });

  it('createBoard should write board metadata to firestore', async () => {
    // doc().id for auto-generated ID
    mockDoc.mockReturnValueOnce({ id: 'auto-id' }).mockReturnValue('mock-doc-ref');

    const { createBoard } = await import('../boardMeta');
    const board = await createBoard('Test Board', 'user-1', 'User One');

    expect(board.name).toBe('Test Board');
    expect(board.creatorId).toBe('user-1');
    expect(board.creatorName).toBe('User One');
    expect(board.members).toEqual(['user-1']);
    expect(board.memberNames).toEqual({ 'user-1': 'User One' });
    expect(board.visibility).toBe('open');
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('joinBoard should add user to members array', async () => {
    const { joinBoard } = await import('../boardMeta');
    await joinBoard('board-1', 'user-2', 'User Two');

    expect(mockDoc).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      members: { __arrayUnion: 'user-2' },
      'memberNames.user-2': 'User Two',
    }));
  });

  it('leaveBoard should remove user from members array', async () => {
    const { leaveBoard } = await import('../boardMeta');
    await leaveBoard('board-1', 'user-2');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      members: { __arrayRemove: 'user-2' },
    }));
  });

  it('getBoardMeta should return board data when it exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'board-1',
      data: () => ({ name: 'Test Board', creatorId: 'user-1' }),
    });

    const { getBoardMeta } = await import('../boardMeta');
    const board = await getBoardMeta('board-1');

    expect(board).not.toBeNull();
    expect(board!.name).toBe('Test Board');
    expect(board!.id).toBe('board-1');
  });

  it('getBoardMeta should return null when board does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const { getBoardMeta } = await import('../boardMeta');
    const board = await getBoardMeta('nonexistent');
    expect(board).toBeNull();
  });

  it('onMyBoardsChange should set up a query with array-contains', async () => {
    const callback = vi.fn();
    const { onMyBoardsChange } = await import('../boardMeta');
    onMyBoardsChange('user-1', callback);

    expect(mockWhere).toHaveBeenCalledWith('members', 'array-contains', 'user-1');
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('onOpenBoardsChange should set up a query with visibility filter', async () => {
    const callback = vi.fn();
    const { onOpenBoardsChange } = await import('../boardMeta');
    onOpenBoardsChange(callback);

    expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'open');
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('deleteBoard should clear objects then delete board meta doc', async () => {
    const { deleteBoard } = await import('../boardMeta');
    await deleteBoard('board-1');

    expect(mockClearObjects).toHaveBeenCalledWith('board-1');
    expect(mockDoc).toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });
});
