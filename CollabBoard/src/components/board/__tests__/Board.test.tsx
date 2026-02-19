import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Board } from '../Board';
import type { BoardObject } from '../../../types';

const mockBroadcastEditing = vi.fn();
const mockClearEditing = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'a@test.com', displayName: 'Alice' },
    logout: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useBoardObjects', () => ({
  useBoardObjects: () => ({
    objects: [
      {
        id: 'sticky-1',
        type: 'sticky',
        x: 10,
        y: 20,
        width: 200,
        height: 200,
        rotation: 0,
        text: 'Hello',
        color: '#FFD54F',
        createdBy: 'user-1',
        createdAt: 1,
        updatedAt: 1,
        updatedBy: 'user-1',
      } as BoardObject,
    ],
    addObject: vi.fn(),
    updateObject: vi.fn(),
    deleteObject: vi.fn(),
    clearObjects: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useCursors', () => ({
  useCursors: () => ({ cursors: {}, updateCursor: vi.fn(), cleanupCursor: vi.fn() }),
}));

vi.mock('../../../hooks/usePresence', () => ({
  usePresence: () => ({ onlineUsers: [], cleanupPresence: vi.fn() }),
}));

vi.mock('../../../hooks/useViewport', () => ({
  useViewport: () => ({
    viewport: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
    setPosition: vi.fn(),
    zoomAtPoint: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useLiveTransforms', () => ({
  useLiveTransforms: () => ({
    remoteTransforms: {},
    broadcastTransform: vi.fn(),
    clearTransform: vi.fn(),
    cleanupTransform: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useLiveEditing', () => ({
  useLiveEditing: () => ({
    remoteEditings: {},
    broadcastEditing: mockBroadcastEditing,
    clearEditing: mockClearEditing,
    cleanupEditing: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useSelection', () => ({
  useSelection: () => ({
    remoteSelectionByObject: {},
    setLocalSelection: vi.fn(),
    cleanupSelection: vi.fn(),
  }),
}));

vi.mock('../../../firebase/boardMeta', () => ({
  onBoardMetaChange: (boardId: string, callback: (meta: unknown) => void) => {
    callback({ id: boardId, name: 'Test Board', creatorId: 'u1', creatorName: 'Alice', members: [], memberNames: {}, createdAt: 0, updatedAt: 0, visibility: 'open' });
    return () => {};
  },
  updateBoardName: vi.fn(),
}));

let capturedOnObjectDoubleClick: ((obj: BoardObject) => void) | null = null;

vi.mock('../Canvas', () => ({
  Canvas: (props: { onObjectDoubleClick?: (obj: BoardObject) => void }) => {
    capturedOnObjectDoubleClick = props.onObjectDoubleClick ?? null;
    return (
      <div data-testid="canvas">
        <button
          type="button"
          data-testid="trigger-double-click"
          onClick={() => props.onObjectDoubleClick?.({ id: 'sticky-1', type: 'sticky', x: 10, y: 20, width: 200, height: 200, rotation: 0, text: 'Hello', color: '#FFD54F', createdBy: 'u1', createdAt: 1, updatedAt: 1, updatedBy: 'u1' })}
        >
          Double-click sticky
        </button>
      </div>
    );
  },
}));

vi.mock('../TextEditor', () => ({
  TextEditor: () => <div data-testid="text-editor">TextEditor</div>,
}));

vi.mock('../Toolbar', () => ({ Toolbar: () => <div>Toolbar</div> }));
vi.mock('../PresenceBar', () => ({ PresenceBar: () => <div>PresenceBar</div> }));
vi.mock('../ShapeSidebar', () => ({ ShapeSidebar: () => <div>ShapeSidebar</div> }));
vi.mock('../StylePanel', () => ({ StylePanel: () => null }));
vi.mock('../ContextMenu', () => ({ ContextMenu: () => null }));

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls broadcastEditing when text editor is opened (double-click sticky)', async () => {
    render(
      <MemoryRouter initialEntries={['/board/test']}>
        <Routes>
          <Route path="/board/:boardId" element={<Board />} />
        </Routes>
      </MemoryRouter>
    );
    const trigger = screen.getByTestId('trigger-double-click');
    await act(async () => {
      trigger.click();
    });
    expect(mockBroadcastEditing).toHaveBeenCalledWith('sticky-1', 'Hello');
  });
});
