import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../Dashboard';

const navigateMock = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseBoards = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useBoards', () => ({
  useBoards: (...args: unknown[]) => mockUseBoards(...args),
}));

const defaultAuth = {
  user: { uid: 'u1', email: 'test@test.com', displayName: 'Test User' },
  loading: false,
  error: null,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

const defaultBoards = {
  myBoards: [],
  joinableBoards: [],
  loading: false,
  createBoard: vi.fn(),
  joinBoard: vi.fn(),
  leaveBoard: vi.fn(),
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuth);
    mockUseBoards.mockReturnValue(defaultBoards);
  });

  it('renders the dashboard header with brand and logout', () => {
    renderDashboard();
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders My Boards and Join Board tabs', () => {
    renderDashboard();
    expect(screen.getByText('My Boards')).toBeInTheDocument();
    expect(screen.getByText('Join Board')).toBeInTheDocument();
  });

  it('renders Create Board button', () => {
    renderDashboard();
    expect(screen.getByText('+ Create Board')).toBeInTheDocument();
  });

  it('shows empty state when no boards exist', () => {
    renderDashboard();
    expect(screen.getByText(/haven't joined any boards/i)).toBeInTheDocument();
  });

  it('shows my boards in the My Boards tab', () => {
    mockUseBoards.mockReturnValue({
      ...defaultBoards,
      myBoards: [
        {
          id: 'b1',
          name: 'Project Alpha',
          creatorId: 'u1',
          creatorName: 'Test User',
          members: ['u1'],
          memberNames: { u1: 'Test User' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'open',
        },
      ],
    });

    renderDashboard();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('switches to Join Board tab and shows joinable boards', async () => {
    const user = userEvent.setup();
    mockUseBoards.mockReturnValue({
      ...defaultBoards,
      joinableBoards: [
        {
          id: 'b2',
          name: 'Public Board',
          creatorId: 'u2',
          creatorName: 'Other User',
          members: ['u2'],
          memberNames: { u2: 'Other User' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'open',
        },
      ],
    });

    renderDashboard();
    await user.click(screen.getByText('Join Board'));
    expect(screen.getByText('Public Board')).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  it('opens and closes the create board modal', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByText('+ Create Board'));
    expect(screen.getByText('Create New Board')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create New Board')).not.toBeInTheDocument();
  });

  it('creates a board and navigates to it', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn().mockResolvedValue({ id: 'new-board-id' });
    mockUseBoards.mockReturnValue({
      ...defaultBoards,
      createBoard: mockCreate,
    });

    renderDashboard();
    await user.click(screen.getByText('+ Create Board'));
    await user.type(screen.getByLabelText(/board name/i), 'My New Board');
    await user.click(screen.getByRole('button', { name: /^create board$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('My New Board');
      expect(navigateMock).toHaveBeenCalledWith('/board/new-board-id');
    });
  });

  it('navigates to board when Open is clicked', async () => {
    const user = userEvent.setup();
    mockUseBoards.mockReturnValue({
      ...defaultBoards,
      myBoards: [
        {
          id: 'b1',
          name: 'My Board',
          creatorId: 'u1',
          creatorName: 'Test User',
          members: ['u1'],
          memberNames: { u1: 'Test User' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'open',
        },
      ],
    });

    renderDashboard();
    await user.click(screen.getByText('Open'));
    expect(navigateMock).toHaveBeenCalledWith('/board/b1');
  });

  it('joins a board and navigates to it', async () => {
    const user = userEvent.setup();
    const mockJoin = vi.fn().mockResolvedValue(undefined);
    mockUseBoards.mockReturnValue({
      ...defaultBoards,
      joinBoard: mockJoin,
      joinableBoards: [
        {
          id: 'b3',
          name: 'Open Board',
          creatorId: 'u2',
          creatorName: 'Other',
          members: ['u2'],
          memberNames: { u2: 'Other' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'open',
        },
      ],
    });

    renderDashboard();
    await user.click(screen.getByText('Join Board'));
    await user.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(mockJoin).toHaveBeenCalledWith('b3');
      expect(navigateMock).toHaveBeenCalledWith('/board/b3');
    });
  });

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();
    mockUseAuth.mockReturnValue({ ...defaultAuth, logout: mockLogout });

    renderDashboard();
    await user.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockUseBoards.mockReturnValue({ ...defaultBoards, loading: true });
    renderDashboard();
    expect(screen.getByText('Loading boards...')).toBeInTheDocument();
  });
});
