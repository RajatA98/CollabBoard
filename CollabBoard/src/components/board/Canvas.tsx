import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import { GridBackground } from './GridBackground';
import { StickyNote } from './StickyNote';
import { Rectangle } from './Rectangle';
import { TextElement } from './TextElement';
import { RemoteCursor } from './RemoteCursor';
import { DimensionLabel } from './DimensionLabel';
import { SelectionRect } from './SelectionRect';
import { rectsIntersect } from '../../utils/coordinates';
import type { BoardObject, CursorData, LiveTransformData, LiveEditingData } from '../../types';

interface CanvasProps {
  objects: BoardObject[];
  onObjectUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onBatchObjectUpdate?: (changes: { id: string; updates: Partial<BoardObject> }[]) => void;
  onObjectDelete?: (id: string) => void;
  onCanvasClick: () => void;
  onCanvasRightClick?: (screenPos: { x: number; y: number }) => void;
  onLastClickPosition?: (worldPos: { x: number; y: number }) => void;
  onObjectDoubleClick?: (obj: BoardObject) => void;
  onObjectRightClick?: (obj: BoardObject, screenPos: { x: number; y: number }) => void;
  remoteCursors?: Record<string, CursorData>;
  onMouseMove?: (x: number, y: number) => void;
  selectedObjectIds: string[];
  onSelectObject: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  onSetSelectedIds?: (ids: string[]) => void;
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
  setPosition: (x: number, y: number) => void;
  zoomAtPoint: (newScale: number, pointerX: number, pointerY: number) => void;
  isEditingText?: boolean;
  onLiveTransformChange?: (transform: {
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null) => void;
  remoteTransforms?: Record<string, LiveTransformData>;
  remoteEditings?: Record<string, LiveEditingData>;
  onBroadcastTransform?: (objectId: string, x: number, y: number, width: number, height: number, rotation: number) => void;
  onClearTransform?: () => void;
  /** When true, stage panning is disabled so HTML5 drop from sidebar is not stolen. */
  isDraggingShapeFromSidebar?: boolean;
}

const ZOOM_SPEED = 1.05;
/** Minimum size so sticky notes and shapes stay usable and don't collapse. */
const MIN_OBJECT_SIZE = 60;

export function Canvas({
  objects,
  onObjectUpdate,
  onBatchObjectUpdate,
  onObjectDelete: _onObjectDelete,
  onCanvasClick,
  onCanvasRightClick,
  onLastClickPosition,
  onObjectDoubleClick,
  onObjectRightClick,
  remoteCursors = {},
  onMouseMove,
  selectedObjectIds,
  onSelectObject,
  onClearSelection,
  onSelectAll: _onSelectAll,
  onDeleteSelected,
  onDuplicateSelected,
  onSetSelectedIds,
  viewport,
  setPosition,
  zoomAtPoint,
  isEditingText: _isEditingText = false,
  onLiveTransformChange,
  remoteTransforms = {},
  remoteEditings = {},
  onBroadcastTransform,
  onClearTransform,
  isDraggingShapeFromSidebar = false,
}: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 48 });
  const [isAltDown, setIsAltDown] = useState(false);
  const [transformMode, setTransformMode] = useState<'idle' | 'resize' | 'rotate'>('idle');
  const lastRotationRef = useRef<number>(0);
  const isRotatingGestureRef = useRef(false);
  const [liveTransform, setLiveTransform] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null>(null);
  const liveTransformRef = useRef<typeof liveTransform>(null);
  const isTransformingRef = useRef(false);
  const transformFlushScheduledRef = useRef(false);
  const transformingObjectIdRef = useRef<string | null>(null);
  const [dimensionLabelTick, setDimensionLabelTick] = useState(0);
  const dimensionLabelRafRef = useRef<number | null>(null);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const middleMousePanStartRef = useRef<{ pointerX: number; pointerY: number; viewportX: number; viewportY: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  const getWorldPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - viewport.x) / viewport.scaleX,
      y: (pointer.y - viewport.y) / viewport.scaleY,
    };
  }, [viewport]);

  // One rAF-driven re-render per frame during transform so DimensionLabel reads liveTransformRef without delay
  const startDimensionLabelRafLoop = useCallback(() => {
    const loop = () => {
      setDimensionLabelTick((t) => t + 1);
      if (isTransformingRef.current) {
        dimensionLabelRafRef.current = requestAnimationFrame(loop);
      }
    };
    dimensionLabelRafRef.current = requestAnimationFrame(loop);
  }, []);

  // Build lookup: objectId -> LiveTransformData for remote users' live transforms
  const remoteTransformByObjectId = useMemo(() => {
    const map: Record<string, LiveTransformData> = {};
    for (const transform of Object.values(remoteTransforms)) {
      map[transform.objectId] = transform;
    }
    return map;
  }, [remoteTransforms]);

  // Build lookup: objectId -> LiveEditingData for remote users' live editing
  const remoteEditingByObjectId = useMemo(() => {
    const map: Record<string, LiveEditingData> = {};
    for (const editing of Object.values(remoteEditings)) {
      map[editing.objectId] = editing;
    }
    return map;
  }, [remoteEditings]);

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight - 48 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMiddleMouseDown) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    const onWindowMouseMove = (e: MouseEvent) => {
      const start = middleMousePanStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.pointerX;
      const dy = e.clientY - start.pointerY;
      setPosition(start.viewportX + dx, start.viewportY + dy);
    };
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        middleMousePanStartRef.current = null;
        setIsMiddleMouseDown(false);
      }
    };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      document.body.style.cursor = prevCursor;
    };
  }, [isMiddleMouseDown, setPosition]);

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        setIsMiddleMouseDown(true);
        middleMousePanStartRef.current = {
          pointerX: e.evt.clientX,
          pointerY: e.evt.clientY,
          viewportX: viewport.x,
          viewportY: viewport.y,
        };
        return;
      }
      if (e.target !== stageRef.current) return;
      if (e.evt.button !== 0) return;
      const worldPos = getWorldPointer();
      if (!worldPos) return;
      setIsMarqueeSelecting(true);
      setMarqueeStart(worldPos);
      setMarqueeEnd(worldPos);
    },
    [getWorldPointer, viewport]
  );

  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (onMouseMove) {
        const worldPos = getWorldPointer();
        if (worldPos) onMouseMove(worldPos.x, worldPos.y);
      }
      if (isMarqueeSelecting) {
        const worldPos = getWorldPointer();
        if (worldPos) setMarqueeEnd(worldPos);
      }
    },
    [onMouseMove, getWorldPointer, isMarqueeSelecting]
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1) {
        setIsMiddleMouseDown(false);
        return;
      }
      if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) return;
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const width = Math.abs(marqueeEnd.x - marqueeStart.x);
      const height = Math.abs(marqueeEnd.y - marqueeStart.y);
      if (width > 5 || height > 5) {
        const marqueeRect = { x: minX, y: minY, width, height };
        const hitIds = objects
          .filter((obj) =>
            rectsIntersect(marqueeRect, { x: obj.x, y: obj.y, width: obj.width, height: obj.height })
          )
          .map((obj) => obj.id);
        if (hitIds.length > 0) {
          onSetSelectedIds?.(hitIds);
        } else {
          onClearSelection();
        }
      } else {
        onClearSelection();
        onCanvasClick();
      }
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    },
    [isMarqueeSelecting, marqueeStart, marqueeEnd, objects, onSetSelectedIds, onClearSelection, onCanvasClick]
  );

  const handleObjectDragStart = useCallback(
    (draggedId: string) => {
      if (selectedObjectIds.includes(draggedId) && selectedObjectIds.length > 1) {
        const stage = stageRef.current;
        if (!stage) return;
        const positions = new Map<string, { x: number; y: number }>();
        selectedObjectIds.forEach((id) => {
          const node = stage.findOne('#' + id);
          if (node) positions.set(id, { x: node.x(), y: node.y() });
        });
        dragStartPositionsRef.current = positions;
      } else {
        dragStartPositionsRef.current = null;
      }
    },
    [selectedObjectIds]
  );

  const handleObjectDragMove = useCallback(
    (draggedId: string, newX: number, newY: number) => {
      const positions = dragStartPositionsRef.current;
      if (!positions || selectedObjectIds.length <= 1) return;
      const startPos = positions.get(draggedId);
      if (!startPos) return;
      const dx = newX - startPos.x;
      const dy = newY - startPos.y;
      const stage = stageRef.current;
      if (!stage) return;
      selectedObjectIds.forEach((id) => {
        if (id === draggedId) return;
        const pos = positions.get(id);
        if (!pos) return;
        const node = stage.findOne('#' + id);
        if (node) {
          node.x(pos.x + dx);
          node.y(pos.y + dy);
        }
      });
      stage.findOne('.konva-transformer')?.getLayer()?.batchDraw();
    },
    [selectedObjectIds]
  );

  const handleObjectDragEnd = useCallback(
    (draggedId: string, finalX: number, finalY: number) => {
      const positions = dragStartPositionsRef.current;
      if (!positions || selectedObjectIds.length <= 1) {
        onObjectUpdate(draggedId, { x: finalX, y: finalY });
        return;
      }
      const startPos = positions.get(draggedId);
      if (!startPos) return;
      const dx = finalX - startPos.x;
      const dy = finalY - startPos.y;
      if (onBatchObjectUpdate) {
        const changes = selectedObjectIds
          .map((id) => {
            const pos = positions.get(id);
            return pos ? { id, updates: { x: pos.x + dx, y: pos.y + dy } as Partial<BoardObject> } : null;
          })
          .filter((c): c is { id: string; updates: Partial<BoardObject> } => c !== null);
        if (changes.length > 0) onBatchObjectUpdate(changes);
      } else {
        selectedObjectIds.forEach((id) => {
          const pos = positions.get(id);
          if (pos) onObjectUpdate(id, { x: pos.x + dx, y: pos.y + dy });
        });
      }
      dragStartPositionsRef.current = null;
    },
    [selectedObjectIds, onObjectUpdate, onBatchObjectUpdate]
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      if (isDraggingShapeFromSidebar) return;
      const stage = stageRef.current;
      if (!stage || viewport == null) return;

      const oldScale = viewport.scaleX;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED;
      zoomAtPoint(newScale, pointer.x, pointer.y);
    },
    [viewport, zoomAtPoint, isDraggingShapeFromSidebar]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos && onLastClickPosition) {
        const worldX = (pos.x - viewport.x) / viewport.scaleX;
        const worldY = (pos.y - viewport.y) / viewport.scaleY;
        onLastClickPosition({ x: worldX, y: worldY });
      }
    },
    [viewport, onLastClickPosition]
  );

  const handleStageContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      const target = e.target;
      const isStage = target === stage;
      const isLayer = (target as Konva.Node).getClassName?.() === 'Layer';
      if (isStage || isLayer) {
        e.evt.preventDefault();
        const pointer = stage?.getPointerPosition();
        if (pointer) onCanvasRightClick?.({ x: pointer.x, y: pointer.y });
      }
    },
    [onCanvasRightClick]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (_isEditingText) return;
      const active = document.activeElement;
      const isEditingInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable);
      if (isEditingInput) return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectIds.length > 0) {
        e.preventDefault();
        onDeleteSelected?.();
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedObjectIds.length > 0) {
        e.preventDefault();
        onDuplicateSelected?.();
      }
    },
    [selectedObjectIds.length, _isEditingText, onDeleteSelected, onDuplicateSelected]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Track Alt key for aspect ratio toggle
  useEffect(() => {
    const handleAltKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltDown(true);
    };
    const handleAltKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltDown(false);
    };
    window.addEventListener('keydown', handleAltKeyDown);
    window.addEventListener('keyup', handleAltKeyUp);
    return () => {
      window.removeEventListener('keydown', handleAltKeyDown);
      window.removeEventListener('keyup', handleAltKeyUp);
    };
  }, []);

  // Attach transformer only for single selection
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;
    if (selectedObjectIds.length === 1) {
      const node = stage.findOne('#' + selectedObjectIds[0]);
      transformer.nodes(node ? [node] : []);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedObjectIds]);

  // Helper to create onDragMove handler for broadcasting
  const makeDragMoveHandler = useCallback(
    (obj: BoardObject) => (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      handleObjectDragMove(obj.id, node.x(), node.y());
      onBroadcastTransform?.(obj.id, node.x(), node.y(), obj.width, obj.height, obj.rotation || 0);
    },
    [onBroadcastTransform, handleObjectDragMove]
  );

  const handleDragEndExtra = useCallback(() => {
    onClearTransform?.();
  }, [onClearTransform]);

  // Compute marquee rect in world coordinates for rendering
  const marqueeRect = marqueeStart && marqueeEnd ? {
    x: Math.min(marqueeStart.x, marqueeEnd.x),
    y: Math.min(marqueeStart.y, marqueeEnd.y),
    width: Math.abs(marqueeEnd.x - marqueeStart.x),
    height: Math.abs(marqueeEnd.y - marqueeStart.y),
  } : null;

  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: isDraggingShapeFromSidebar ? 'none' : 'auto' }}>
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scaleX}
      scaleY={viewport.scaleY}
      onWheel={handleWheel}
      onClick={handleStageClick}
      onContextMenu={handleStageContextMenu}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
    >
      <Layer>
        <GridBackground viewport={viewport} stageSize={stageSize} />
      </Layer>
      <Layer>
        {marqueeRect && isMarqueeSelecting && (
          <SelectionRect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            visible
          />
        )}
        {/* Render non-selected objects first so selected objects + Transformer draw on top */}
        {objects
          .filter((obj) => !selectedObjectIds.includes(obj.id))
          .map((obj) => {
            const remoteXform = remoteTransformByObjectId[obj.id];
            const remoteEdit = remoteEditingByObjectId[obj.id];
            const displayObj = remoteXform
              ? { ...obj, x: remoteXform.x, y: remoteXform.y, width: remoteXform.width, height: remoteXform.height, rotation: remoteXform.rotation }
              : obj;
            if (obj.type === 'sticky') {
              return (
                <StickyNote
                  key={obj.id}
                  object={displayObj}
                  isSelected={false}
                  onSelect={(additive) => onSelectObject(obj.id, additive)}
                  onDragStart={() => handleObjectDragStart(obj.id)}
                  onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                  onDoubleClick={() => onObjectDoubleClick?.(obj)}
                  onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                  onDragMove={makeDragMoveHandler(obj)}
                  onDragEndExtra={handleDragEndExtra}
                  remoteEditing={remoteEdit}
                  remoteTransform={remoteXform}
                />
              );
            } else if (obj.type === 'text') {
              return (
                <TextElement
                  key={obj.id}
                  object={displayObj}
                  isSelected={false}
                  onSelect={(additive) => onSelectObject(obj.id, additive)}
                  onDragStart={() => handleObjectDragStart(obj.id)}
                  onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                  onDoubleClick={() => onObjectDoubleClick?.(obj)}
                  onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                  onDragMove={makeDragMoveHandler(obj)}
                  onDragEndExtra={handleDragEndExtra}
                  remoteEditing={remoteEdit}
                  remoteTransform={remoteXform}
                />
              );
            } else {
              return (
                <Rectangle
                  key={obj.id}
                  object={displayObj}
                  isSelected={false}
                  onSelect={(additive) => onSelectObject(obj.id, additive)}
                  onDragStart={() => handleObjectDragStart(obj.id)}
                  onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                  onDoubleClick={() => onObjectDoubleClick?.(obj)}
                  onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                  onDragMove={makeDragMoveHandler(obj)}
                  onDragEndExtra={handleDragEndExtra}
                  remoteTransform={remoteXform}
                />
              );
            }
          })}
        {/* Render selected objects; Transformer only when exactly one selected */}
        {selectedObjectIds.length > 0 &&
          objects
            .filter((obj) => selectedObjectIds.includes(obj.id))
            .map((obj) => {
              const remoteXform = remoteTransformByObjectId[obj.id];
              const remoteEdit = remoteEditingByObjectId[obj.id];
              // During resize/rotate, pass live x/y/rotation; else use remote transform if another user is manipulating
              const displayObject =
                liveTransform != null
                  ? { ...obj, x: liveTransform.x, y: liveTransform.y, rotation: liveTransform.rotation, width: liveTransform.width, height: liveTransform.height }
                  : remoteXform != null
                    ? { ...obj, x: remoteXform.x, y: remoteXform.y, width: remoteXform.width, height: remoteXform.height, rotation: remoteXform.rotation }
                    : obj;
              return (
              <React.Fragment key={obj.id}>
                {obj.type === 'sticky' ? (
                  <StickyNote
                    object={displayObject}
                    isSelected
                    onSelect={(additive) => onSelectObject(obj.id, additive)}
                    onDragStart={() => handleObjectDragStart(obj.id)}
                    onUpdate={(updates) => {
                      if (updates.x !== undefined && updates.y !== undefined && selectedObjectIds.length > 1) {
                        handleObjectDragEnd(obj.id, updates.x, updates.y);
                      } else {
                        onObjectUpdate(obj.id, updates);
                      }
                    }}
                    onDoubleClick={() => onObjectDoubleClick?.(obj)}
                    onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                    onDragMove={makeDragMoveHandler(obj)}
                    onDragEndExtra={handleDragEndExtra}
                    remoteEditing={remoteEdit}
                    remoteTransform={remoteXform}
                  />
                ) : obj.type === 'text' ? (
                  <TextElement
                    object={displayObject}
                    isSelected
                    onSelect={(additive) => onSelectObject(obj.id, additive)}
                    onDragStart={() => handleObjectDragStart(obj.id)}
                    onUpdate={(updates) => {
                      if (updates.x !== undefined && updates.y !== undefined && selectedObjectIds.length > 1) {
                        handleObjectDragEnd(obj.id, updates.x, updates.y);
                      } else {
                        onObjectUpdate(obj.id, updates);
                      }
                    }}
                    onDoubleClick={() => onObjectDoubleClick?.(obj)}
                    onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                    onDragMove={makeDragMoveHandler(obj)}
                    onDragEndExtra={handleDragEndExtra}
                    remoteEditing={remoteEdit}
                    remoteTransform={remoteXform}
                  />
                ) : (
                  <Rectangle
                    object={displayObject}
                    isSelected
                    onSelect={(additive) => onSelectObject(obj.id, additive)}
                    onDragStart={() => handleObjectDragStart(obj.id)}
                    onUpdate={(updates) => {
                      if (updates.x !== undefined && updates.y !== undefined && selectedObjectIds.length > 1) {
                        handleObjectDragEnd(obj.id, updates.x, updates.y);
                      } else {
                        onObjectUpdate(obj.id, updates);
                      }
                    }}
                    onDoubleClick={() => onObjectDoubleClick?.(obj)}
                    onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                    onDragMove={makeDragMoveHandler(obj)}
                    onDragEndExtra={handleDragEndExtra}
                    remoteTransform={remoteXform}
                  />
                )}
                {selectedObjectIds.length === 1 && (
                <>
                <Transformer
                  ref={transformerRef}
                  keepRatio={!isAltDown}
                  borderStroke="#4285f4"
                  borderStrokeWidth={2}
                  borderDash={[6, 4]}
                  anchorFill="#ffffff"
                  anchorStroke="#4285f4"
                  anchorStrokeWidth={1.5}
                  anchorSize={8}
                  anchorCornerRadius={50}
                  enabledAnchors={[
                    'top-left',
                    'top-center',
                    'top-right',
                    'middle-left',
                    'middle-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ]}
                  rotateEnabled={true}
                  rotateLineVisible={false}
                  rotateAnchorAngle={
                    (() => {
                      const w = liveTransform?.width ?? obj.width;
                      const h = liveTransform?.height ?? obj.height;
                      return (Math.atan2(w, h) * 180) / Math.PI;
                    })()
                  }
                  rotateAnchorOffset={24}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Enforce minimum size so objects (especially sticky notes) don't collapse
                    if (newBox.width < MIN_OBJECT_SIZE || newBox.height < MIN_OBJECT_SIZE) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                  onTransformStart={() => {
                    isTransformingRef.current = true;
                    transformingObjectIdRef.current = obj.id;
                    startDimensionLabelRafLoop();
                    const activeAnchor = transformerRef.current?.getActiveAnchor?.() ?? null;
                    if (activeAnchor === 'rotater') {
                      isRotatingGestureRef.current = true;
                      setTransformMode('rotate');
                    } else {
                      isRotatingGestureRef.current = false;
                    }
                  }}
                  onTransform={(e) => {
                    const node = e.target;
                    const currentRotation = node.rotation();
                    // Detect if rotation changed (rotation mode) or size changed (resize mode).
                    // Once we're in rotate mode this gesture, stay in rotate so the label doesn't flip back to dimensions.
                    if (Math.abs(currentRotation - lastRotationRef.current) > 0.1) {
                      isRotatingGestureRef.current = true;
                      setTransformMode('rotate');
                    } else if (!isRotatingGestureRef.current) {
                      setTransformMode('resize');
                    }
                    lastRotationRef.current = currentRotation;

                    // Use object dimensions as base: Groups (e.g. StickyNote) don't have width/height,
                    // so node.width()/node.height() can be 0 or wrong and would clamp to MIN_OBJECT_SIZE
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const baseW = obj.width;
                    const baseH = obj.height;

                    const liveValues = {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(MIN_OBJECT_SIZE, baseW * scaleX),
                      height: Math.max(MIN_OBJECT_SIZE, baseH * scaleY),
                      rotation: currentRotation,
                    };

                    liveTransformRef.current = liveValues;
                    // Flush to state/callbacks once per frame for smooth 60fps updates
                    if (!transformFlushScheduledRef.current) {
                      transformFlushScheduledRef.current = true;
                      requestAnimationFrame(() => {
                        transformFlushScheduledRef.current = false;
                        const current = liveTransformRef.current;
                        if (current) {
                          setLiveTransform({ ...current });
                          onLiveTransformChange?.(current);
                          const id = transformingObjectIdRef.current;
                          if (id) {
                            onBroadcastTransform?.(id, current.x, current.y, current.width, current.height, current.rotation);
                          }
                        }
                      });
                    }
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // Reset scale so the node's visual size is correct on next render
                    node.scaleX(1);
                    node.scaleY(1);

                    // Base dimensions from object: Groups don't have reliable node.width()/height()
                    const baseW = obj.width;
                    const baseH = obj.height;

                    const newWidth = Math.max(MIN_OBJECT_SIZE, baseW * scaleX);
                    const newHeight = Math.max(MIN_OBJECT_SIZE, baseH * scaleY);

                    onObjectUpdate(obj.id, {
                      x: node.x(),
                      y: node.y(),
                      width: newWidth,
                      height: newHeight,
                      rotation: node.rotation(),
                    });

                    // Clear live transform
                    isTransformingRef.current = false;
                    transformingObjectIdRef.current = null;
                    liveTransformRef.current = null;
                    if (dimensionLabelRafRef.current != null) {
                      cancelAnimationFrame(dimensionLabelRafRef.current);
                      dimensionLabelRafRef.current = null;
                    }
                    setLiveTransform(null);
                    onLiveTransformChange?.(null);
                    setTransformMode('idle');
                    isRotatingGestureRef.current = false;
                    lastRotationRef.current = node.rotation();
                    // Clear RTDB transform
                    onClearTransform?.();
                  }}
                  rotateAnchorCursor="grab"
                  anchorStyleFunc={(anchor) => {
                    // Match image: thin solid line, almost complete circle, arrowhead at top-right
                    if ((anchor as Konva.Node).hasName('rotater')) {
                      (anchor as Konva.Shape).scale({ x: 1.15, y: 1.15 });
                      (anchor as Konva.Shape).sceneFunc(function (context: Konva.Context, shape: Konva.Shape) {
                        const w = shape.getAttr('width') ?? 10;
                        const h = shape.getAttr('height') ?? 10;
                        const size = Math.min(w, h, 14);
                        const cx = size / 2;
                        const cy = size / 2;
                        const r = Math.max(2.5, size / 2 - 0.5);
                        // Almost complete circle: from bottom-right (~45°) clockwise to top-right (~315°)
                        const startAngle = (45 * Math.PI) / 180;
                        const endAngle = (315 * Math.PI) / 180;
                        shape.fill('transparent');
                        shape.stroke('#4285f4');
                        shape.strokeWidth(1.25);
                        context.beginPath();
                        context.arc(cx, cy, r, startAngle, endAngle, false);
                        context.fillStrokeShape(shape);
                        // Small arrowhead at top-right segment (end of arc)
                        const tipX = cx + r * Math.cos(endAngle);
                        const tipY = cy - r * Math.sin(endAngle);
                        const arrowLen = size * 0.35;
                        const leftX = tipX - arrowLen * Math.cos(endAngle - 0.4);
                        const leftY = tipY + arrowLen * Math.sin(endAngle - 0.4);
                        const rightX = tipX - arrowLen * Math.cos(endAngle + 0.4);
                        const rightY = tipY + arrowLen * Math.sin(endAngle + 0.4);
                        context.beginPath();
                        context.moveTo(tipX, tipY);
                        context.lineTo(leftX, leftY);
                        context.lineTo(rightX, rightY);
                        context.closePath();
                        context.setAttr('fillStyle', '#4285f4');
                        context.fill();
                      });
                    }
                  }}
                />
                <DimensionLabel
                  object={obj}
                  transformMode={transformMode}
                  liveTransform={liveTransform}
                  liveTransformRef={liveTransformRef}
                  dimensionLabelTick={dimensionLabelTick}
                />
                </>
                )}
              </React.Fragment>
              );
            })}
      </Layer>
      <Layer>
        {Object.entries(remoteCursors).map(([userId, cursor]) => (
          <RemoteCursor key={userId} cursor={cursor} />
        ))}
      </Layer>
    </Stage>
    </div>
  );
}
