import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';
import type { BoardObject, LiveEditingData, LiveTransformData } from '../../../types';

const mockStickyNote = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="sticky-note" data-remote-editing={props.remoteEditing ? JSON.stringify(props.remoteEditing) : undefined} data-remote-transform={props.remoteTransform ? JSON.stringify(props.remoteTransform) : undefined} data-object-id={(props.object as BoardObject)?.id}>
    {(props.object as BoardObject)?.text}
  </div>
));
const mockRectangle = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="rectangle" data-remote-transform={props.remoteTransform ? JSON.stringify(props.remoteTransform) : undefined} data-object-id={(props.object as BoardObject)?.id} />
));
const mockTextElement = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="text-element" data-remote-editing={props.remoteEditing ? JSON.stringify(props.remoteEditing) : undefined} data-remote-transform={props.remoteTransform ? JSON.stringify(props.remoteTransform) : undefined} data-object-id={props.object?.id}>
    {props.object?.text}
  </div>
));

vi.mock('../StickyNote', () => ({ StickyNote: (props: Record<string, unknown>) => mockStickyNote(props) }));
vi.mock('../Rectangle', () => ({ Rectangle: (props: Record<string, unknown>) => mockRectangle(props) }));
vi.mock('../TextElement', () => ({ TextElement: (props: Record<string, unknown>) => mockTextElement(props) }));

vi.mock('react-konva', () => ({
  Stage: ({ children }: Record<string, unknown>) => (
    <div data-testid="konva-stage">{children as React.ReactNode}</div>
  ),
  Layer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="konva-layer">{children}</div>
  ),
  Rect: () => <div data-testid="konva-rect" />,
  Circle: () => <div data-testid="konva-circle" />,
  Group: ({ children }: Record<string, unknown>) => <div data-testid="konva-group">{children as React.ReactNode}</div>,
  Text: (props: Record<string, unknown>) => <span data-testid="konva-text">{props.text as string}</span>,
  Transformer: () => <div data-testid="transformer" />,
}));

vi.mock('../GridBackground', () => ({ GridBackground: () => <div data-testid="grid" /> }));
vi.mock('../RemoteCursor', () => ({ RemoteCursor: () => null }));
vi.mock('../SelectionRect', () => ({ SelectionRect: () => <div data-testid="selection-rect" /> }));

vi.mock('konva', () => ({
  default: {},
}));

describe('Canvas', () => {
  const mockViewport = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const mockSetPosition = vi.fn();
  const mockZoomAtPoint = vi.fn();
  const defaultCanvasProps = {
    onObjectUpdate: vi.fn(),
    onObjectDelete: vi.fn(),
    onCanvasClick: vi.fn(),
    onObjectDoubleClick: vi.fn(),
    viewport: mockViewport,
    setPosition: mockSetPosition,
    zoomAtPoint: mockZoomAtPoint,
    selectedObjectIds: [] as string[],
    onSelectObject: vi.fn() as (id: string, additive: boolean) => void,
    onClearSelection: vi.fn(),
  };

  const stickyObject: BoardObject = {
    id: 'sticky-1',
    type: 'sticky',
    x: 10,
    y: 20,
    width: 200,
    height: 200,
    rotation: 0,
    text: 'Original text',
    color: '#FFD54F',
    createdBy: 'user-1',
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'user-1',
  };

  const rectObject: BoardObject = {
    id: 'rect-1',
    type: 'rectangle',
    x: 50,
    y: 60,
    width: 150,
    height: 100,
    rotation: 0,
    color: '#90CAF9',
    createdBy: 'user-1',
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'user-1',
  };

  const textObject: BoardObject = {
    id: 'text-1',
    type: 'text',
    x: 80,
    y: 90,
    width: 200,
    height: 40,
    rotation: 0,
    text: 'Some text',
    color: 'transparent',
    createdBy: 'user-1',
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'user-1',
  };

  const baseProps = {
    ...defaultCanvasProps,
    objects: [] as BoardObject[],
  };

  beforeEach(() => {
    mockStickyNote.mockClear();
    mockRectangle.mockClear();
    mockTextElement.mockClear();
  });

  it('should render the stage', () => {
    render(<Canvas {...baseProps} />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('should render layers', () => {
    render(<Canvas {...baseProps} />);
    const layers = screen.getAllByTestId('konva-layer');
    expect(layers.length).toBeGreaterThanOrEqual(1);
  });

  it('passes remoteEditing and remoteTransform to selected StickyNote when another user is typing', () => {
    const remoteEditings: Record<string, LiveEditingData> = {
      'user-2': {
        objectId: 'sticky-1',
        text: 'Remote live text',
        userName: 'Alice',
        userColor: '#FF6B6B',
        lastActive: Date.now(),
      },
    };
    render(
      <Canvas
        objects={[stickyObject]}
        {...defaultCanvasProps}
        selectedObjectIds={['sticky-1']}
        remoteEditings={remoteEditings}
      />
    );
    const selectedCalls = mockStickyNote.mock.calls.filter((c) => c[0].isSelected === true);
    expect(selectedCalls.length).toBeGreaterThanOrEqual(1);
    const selectedProps = selectedCalls[0][0];
    expect(selectedProps.remoteEditing).toBeDefined();
    expect((selectedProps.remoteEditing as LiveEditingData).text).toBe('Remote live text');
  });

  it('passes remoteTransform to selected StickyNote when another user is moving it', () => {
    const remoteTransforms: Record<string, LiveTransformData> = {
      'user-2': {
        objectId: 'sticky-1',
        x: 100,
        y: 150,
        width: 200,
        height: 200,
        rotation: 15,
        userName: 'Bob',
        userColor: '#51CF66',
        lastActive: Date.now(),
      },
    };
    render(
      <Canvas
        objects={[stickyObject]}
        {...defaultCanvasProps}
        selectedObjectIds={['sticky-1']}
        remoteTransforms={remoteTransforms}
      />
    );
    const selectedCalls = mockStickyNote.mock.calls.filter((c) => c[0].isSelected === true);
    expect(selectedCalls.length).toBeGreaterThanOrEqual(1);
    const selectedProps = selectedCalls[0][0];
    expect(selectedProps.remoteTransform).toBeDefined();
    expect((selectedProps.remoteTransform as LiveTransformData).x).toBe(100);
    expect((selectedProps.remoteTransform as LiveTransformData).y).toBe(150);
  });

  it('applies remote transform to selected object display when another user is transforming', () => {
    const remoteTransforms: Record<string, LiveTransformData> = {
      'user-2': {
        objectId: 'sticky-1',
        x: 100,
        y: 150,
        width: 250,
        height: 220,
        rotation: 15,
        userName: 'Bob',
        userColor: '#51CF66',
        lastActive: Date.now(),
      },
    };
    render(
      <Canvas
        objects={[stickyObject]}
        {...defaultCanvasProps}
        selectedObjectIds={['sticky-1']}
        remoteTransforms={remoteTransforms}
      />
    );
    const selectedCalls = mockStickyNote.mock.calls.filter((c) => c[0].isSelected === true);
    expect(selectedCalls.length).toBeGreaterThanOrEqual(1);
    const displayObject = selectedCalls[0][0].object as BoardObject;
    expect(displayObject.x).toBe(100);
    expect(displayObject.y).toBe(150);
    expect(displayObject.width).toBe(250);
    expect(displayObject.height).toBe(220);
    expect(displayObject.rotation).toBe(15);
  });

  it('passes remoteTransform to selected Rectangle when another user is transforming it', () => {
    const remoteTransforms: Record<string, LiveTransformData> = {
      'user-2': {
        objectId: 'rect-1',
        x: 80,
        y: 90,
        width: 180,
        height: 120,
        rotation: 10,
        userName: 'Carol',
        userColor: '#339AF0',
        lastActive: Date.now(),
      },
    };
    render(
      <Canvas
        objects={[rectObject]}
        {...defaultCanvasProps}
        selectedObjectIds={['rect-1']}
        remoteTransforms={remoteTransforms}
      />
    );
    const selectedRectCalls = mockRectangle.mock.calls.filter((c) => c[0].isSelected === true);
    expect(selectedRectCalls.length).toBeGreaterThanOrEqual(1);
    const selectedProps = selectedRectCalls[0][0];
    expect(selectedProps.remoteTransform).toBeDefined();
    expect((selectedProps.remoteTransform as LiveTransformData).x).toBe(80);
  });

  it('renders TextElement for text type objects', () => {
    render(
      <Canvas
        objects={[textObject]}
        {...defaultCanvasProps}
      />
    );
    expect(screen.getByTestId('text-element')).toBeInTheDocument();
  });
});
