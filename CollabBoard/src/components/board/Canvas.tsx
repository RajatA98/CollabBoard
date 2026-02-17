import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { GridBackground } from './GridBackground';
import { StickyNote } from './StickyNote';
import { Rectangle } from './Rectangle';
import { RemoteCursor } from './RemoteCursor';
import type { BoardObject, CursorData } from '../../types';

interface CanvasProps {
  objects: BoardObject[];
  onObjectUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onObjectDelete: (id: string) => void;
  onCanvasClick: () => void;
  onObjectDoubleClick?: (obj: BoardObject) => void;
  remoteCursors?: Record<string, CursorData>;
  onMouseMove?: (x: number, y: number) => void;
  onMouseLeave?: () => void;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
  setPosition: (x: number, y: number) => void;
  zoomAtPoint: (newScale: number, pointerX: number, pointerY: number) => void;
}

const ZOOM_SPEED = 1.05;

export function Canvas({
  objects,
  onObjectUpdate,
  onObjectDelete,
  onCanvasClick,
  onObjectDoubleClick,
  remoteCursors = {},
  onMouseMove,
  onMouseLeave,
  selectedObjectId,
  onSelectObject,
  viewport,
  setPosition,
  zoomAtPoint,
}: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 48 });

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight - 48 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewport.scaleX;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED;
      zoomAtPoint(newScale, pointer.x, pointer.y);
    },
    [viewport.scaleX, zoomAtPoint]
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === stageRef.current) {
        setPosition(e.target.x(), e.target.y());
      }
    },
    [setPosition]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        onSelectObject?.(null);
        onCanvasClick();
      }
    },
    [onCanvasClick, onSelectObject]
  );

  const handleMouseMove = useCallback(
    () => {
      if (!onMouseMove) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldX = (pointer.x - viewport.x) / viewport.scaleX;
      const worldY = (pointer.y - viewport.y) / viewport.scaleY;
      onMouseMove(worldX, worldY);
    },
    [onMouseMove, viewport]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectId) {
        onObjectDelete(selectedObjectId);
        onSelectObject?.(null);
      }
    },
    [selectedObjectId, onObjectDelete, onSelectObject]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      draggable
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scaleX}
      scaleY={viewport.scaleY}
      onWheel={handleWheel}
      onDragEnd={handleDragEnd}
      onClick={handleStageClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <Layer>
        <GridBackground viewport={viewport} stageSize={stageSize} />
      </Layer>
      <Layer>
        {objects.map((obj) => {
          console.log('🎨 Rendering object:', obj);
          return obj.type === 'sticky' ? (
            <StickyNote
              key={obj.id}
              object={obj}
              isSelected={selectedObjectId === obj.id}
              onSelect={() => onSelectObject?.(obj.id)}
              onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
              onDoubleClick={() => onObjectDoubleClick?.(obj)}
            />
          ) : (
            <Rectangle
              key={obj.id}
              object={obj}
              isSelected={selectedObjectId === obj.id}
              onSelect={() => onSelectObject?.(obj.id)}
              onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
            />
          );
        })}
      </Layer>
      <Layer>
        {Object.entries(remoteCursors).map(([userId, cursor]) => (
          <RemoteCursor key={userId} cursor={cursor} scale={viewport.scaleX} />
        ))}
      </Layer>
    </Stage>
  );
}
