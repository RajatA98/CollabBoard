import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import { GridBackground } from './GridBackground';
import { StickyNote } from './StickyNote';
import { Rectangle } from './Rectangle';
import { RemoteCursor } from './RemoteCursor';
import { DimensionLabel } from './DimensionLabel';
import { SelectionRect } from './SelectionRect';
import { rectsIntersect } from '../../utils/coordinates';
import type { BoardObject, CursorData } from '../../types';

interface CanvasProps {
  objects: BoardObject[];
  onObjectUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onCanvasClick: () => void;
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
}

const ZOOM_SPEED = 1.05;
/** Minimum size so sticky notes and shapes stay usable and don't collapse. */
const MIN_OBJECT_SIZE = 60;

export function Canvas({
  objects,
  onObjectUpdate,
  onCanvasClick,
  onObjectDoubleClick,
  onObjectRightClick,
  remoteCursors = {},
  onMouseMove,
  selectedObjectIds,
  onSelectObject,
  onClearSelection,
  onSelectAll,
  onDeleteSelected,
  onDuplicateSelected,
  onSetSelectedIds,
  viewport,
  setPosition,
  zoomAtPoint,
  isEditingText = false,
  onLiveTransformChange,
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

  // Group drag refs
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Middle-mouse panning state
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);

  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight - 48 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debug: Log remote cursors
  useEffect(() => {
    console.log('👁️ Canvas: Remote cursors updated:', remoteCursors);
    console.log('👁️ Canvas: Number of remote cursors:', Object.keys(remoteCursors).length);
  }, [remoteCursors]);

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

  // Get world coordinates from screen pointer position
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

  // Handle middle-mouse drag end to persist stage position
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === stageRef.current) {
        setPosition(e.target.x(), e.target.y());
      }
    },
    [setPosition]
  );

  // --- Marquee selection handlers ---
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Middle mouse button (button === 1) = enable panning
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        setIsMiddleMouseDown(true);
        return;
      }

      // Only start marquee on left-click on the stage itself (not on objects)
      if (e.target !== stageRef.current) return;
      if (e.evt.button !== 0) return;

      const worldPos = getWorldPointer();
      if (!worldPos) return;

      setIsMarqueeSelecting(true);
      setMarqueeStart(worldPos);
      setMarqueeEnd(worldPos);
    },
    [getWorldPointer]
  );

  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // Track cursor for remote cursors
      if (onMouseMove) {
        const worldPos = getWorldPointer();
        if (worldPos) {
          onMouseMove(worldPos.x, worldPos.y);
        }
      }

      // Update marquee
      if (isMarqueeSelecting) {
        const worldPos = getWorldPointer();
        if (worldPos) {
          setMarqueeEnd(worldPos);
        }
      }
    },
    [onMouseMove, getWorldPointer, isMarqueeSelecting]
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Release middle-mouse panning
      if (e.evt.button === 1) {
        setIsMiddleMouseDown(false);
        return;
      }

      if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) return;

      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const width = Math.abs(marqueeEnd.x - marqueeStart.x);
      const height = Math.abs(marqueeEnd.y - marqueeStart.y);

      // Only select if the marquee has some area (not just a click)
      if (width > 5 || height > 5) {
        const marqueeRect = { x: minX, y: minY, width, height };
        const hitIds = objects
          .filter(obj => rectsIntersect(marqueeRect, { x: obj.x, y: obj.y, width: obj.width, height: obj.height }))
          .map(obj => obj.id);

        if (hitIds.length > 0) {
          onSetSelectedIds?.(hitIds);
        } else {
          onClearSelection();
        }
      } else {
        // Tiny drag = treat as a click on empty canvas
        onClearSelection();
        onCanvasClick();
      }

      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    },
    [isMarqueeSelecting, marqueeStart, marqueeEnd, objects, onSetSelectedIds, onClearSelection, onCanvasClick]
  );

  // --- Group drag handlers ---
  const handleObjectDragStart = useCallback(
    (draggedId: string) => {
      if (selectedObjectIds.includes(draggedId) && selectedObjectIds.length > 1) {
        const stage = stageRef.current;
        if (!stage) return;
        const positions = new Map<string, { x: number; y: number }>();
        selectedObjectIds.forEach(id => {
          const node = stage.findOne('#' + id);
          if (node) {
            positions.set(id, { x: node.x(), y: node.y() });
          }
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

      selectedObjectIds.forEach(id => {
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
        // Single object drag — just persist normally
        onObjectUpdate(draggedId, { x: finalX, y: finalY });
        return;
      }

      const startPos = positions.get(draggedId);
      if (!startPos) return;
      const dx = finalX - startPos.x;
      const dy = finalY - startPos.y;

      // Persist all selected object positions
      selectedObjectIds.forEach(id => {
        const pos = positions.get(id);
        if (pos) {
          onObjectUpdate(id, { x: pos.x + dx, y: pos.y + dy });
        }
      });

      dragStartPositionsRef.current = null;
    },
    [selectedObjectIds, onObjectUpdate]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Don't handle clicks if we just finished a marquee
      if (e.target === stageRef.current && !isMarqueeSelecting) {
        // Only clear if we didn't already handle via mouseUp
      }
    },
    [isMarqueeSelecting]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditingText) return;
      const active = document.activeElement;
      const isEditingInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable);
      if (isEditingInput) return;

      const mod = e.metaKey || e.ctrlKey;

      // Select all: Ctrl/Cmd+A
      if (e.key === 'a' && mod) {
        e.preventDefault();
        onSelectAll?.();
        return;
      }

      // Delete/Backspace: cut (delete + copy to clipboard) handled in Board
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectIds.length > 0) {
        onDeleteSelected?.();
        return;
      }

      // Duplicate: Ctrl/Cmd+D
      if (e.key === 'd' && mod && selectedObjectIds.length > 0) {
        e.preventDefault();
        onDuplicateSelected?.();
        return;
      }
    },
    [selectedObjectIds, isEditingText, onDeleteSelected, onSelectAll, onDuplicateSelected]
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

  // Attach transformer to selected nodes (supports multi-select)
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;

    if (selectedObjectIds.length > 0) {
      const nodes = selectedObjectIds
        .map(id => stage.findOne('#' + id))
        .filter(Boolean) as Konva.Node[];
      transformer.nodes(nodes);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedObjectIds]);

  // Helper to render an object component
  const renderObject = (obj: BoardObject, isSelected: boolean, displayObject?: BoardObject) => {
    const objToRender = displayObject || obj;
    const commonProps = {
      key: obj.id,
      object: objToRender,
      isSelected,
      onSelect: (additive: boolean) => onSelectObject(obj.id, additive),
      onUpdate: (updates: Partial<BoardObject>) => {
        // For single objects, update directly; for group drag, handled via dragEnd
        if (!isSelected || selectedObjectIds.length <= 1) {
          onObjectUpdate(obj.id, updates);
        }
      },
      onDoubleClick: () => onObjectDoubleClick?.(obj),
      onRightClick: (screenX: number, screenY: number) => onObjectRightClick?.(obj, { x: screenX, y: screenY }),
      onDragStart: () => handleObjectDragStart(obj.id),
      onDragMove: (x: number, y: number) => handleObjectDragMove(obj.id, x, y),
    };

    if (obj.type === 'sticky') {
      return <StickyNote {...commonProps} onUpdate={(updates) => {
        if (updates.x !== undefined && updates.y !== undefined && isSelected && selectedObjectIds.length > 1) {
          handleObjectDragEnd(obj.id, updates.x, updates.y);
        } else {
          onObjectUpdate(obj.id, updates);
        }
      }} />;
    }
    return <Rectangle {...commonProps} onUpdate={(updates) => {
      if (updates.x !== undefined && updates.y !== undefined && isSelected && selectedObjectIds.length > 1) {
        handleObjectDragEnd(obj.id, updates.x, updates.y);
      } else {
        onObjectUpdate(obj.id, updates);
      }
    }} />;
  };

  // Get the single selected object for DimensionLabel (only when 1 selected)
  const singleSelectedObj = selectedObjectIds.length === 1
    ? objects.find(o => o.id === selectedObjectIds[0])
    : undefined;

  // Compute marquee rect in world coordinates for rendering
  const marqueeRect = marqueeStart && marqueeEnd ? {
    x: Math.min(marqueeStart.x, marqueeEnd.x),
    y: Math.min(marqueeStart.y, marqueeEnd.y),
    width: Math.abs(marqueeEnd.x - marqueeStart.x),
    height: Math.abs(marqueeEnd.y - marqueeStart.y),
  } : null;

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      draggable={isMiddleMouseDown}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scaleX}
      scaleY={viewport.scaleY}
      onWheel={handleWheel}
      onDragEnd={handleDragEnd}
      onClick={handleStageClick}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
    >
      <Layer>
        <GridBackground viewport={viewport} stageSize={stageSize} />
      </Layer>
      <Layer>
        {/* Render non-selected objects first */}
        {objects
          .filter(obj => !selectedObjectIds.includes(obj.id))
          .map(obj => renderObject(obj, false))}

        {/* Render selected objects on top */}
        {objects
          .filter(obj => selectedObjectIds.includes(obj.id))
          .map(obj => {
            const displayObject =
              liveTransform != null && selectedObjectIds.length === 1
                ? { ...obj, x: liveTransform.x, y: liveTransform.y, rotation: liveTransform.rotation }
                : obj;
            return renderObject(obj, true, displayObject);
          })}

        {/* Transformer for selected objects */}
        {selectedObjectIds.length > 0 && (
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
              rotateEnabled={selectedObjectIds.length === 1}
              rotateLineVisible={false}
              rotateAnchorAngle={
                singleSelectedObj
                  ? (() => {
                      const w = liveTransform?.width ?? singleSelectedObj.width;
                      const h = liveTransform?.height ?? singleSelectedObj.height;
                      return (Math.atan2(w, h) * 180) / Math.PI;
                    })()
                  : 0
              }
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < MIN_OBJECT_SIZE || newBox.height < MIN_OBJECT_SIZE) {
                  return oldBox;
                }
                return newBox;
              }}
              onTransformStart={() => {
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
                if (Math.abs(currentRotation - lastRotationRef.current) > 0.1) {
                  isRotatingGestureRef.current = true;
                  setTransformMode('rotate');
                } else if (!isRotatingGestureRef.current) {
                  setTransformMode('resize');
                }
                lastRotationRef.current = currentRotation;

                if (singleSelectedObj) {
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  const baseW = singleSelectedObj.width;
                  const baseH = singleSelectedObj.height;

                  const liveValues = {
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(MIN_OBJECT_SIZE, baseW * scaleX),
                    height: Math.max(MIN_OBJECT_SIZE, baseH * scaleY),
                    rotation: currentRotation,
                  };

                  setLiveTransform(liveValues);
                  onLiveTransformChange?.(liveValues);
                }
              }}
              onTransformEnd={(e) => {
                // Handle multi-node transform end
                const transformer = transformerRef.current;
                if (!transformer) return;

                const nodes = transformer.nodes();
                nodes.forEach((node: Konva.Node) => {
                  const objId = node.id();
                  const obj = objects.find(o => o.id === objId);
                  if (!obj) return;

                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);

                  const baseW = obj.width;
                  const baseH = obj.height;
                  const newWidth = Math.max(MIN_OBJECT_SIZE, baseW * scaleX);
                  const newHeight = Math.max(MIN_OBJECT_SIZE, baseH * scaleY);

                  onObjectUpdate(objId, {
                    x: node.x(),
                    y: node.y(),
                    width: newWidth,
                    height: newHeight,
                    rotation: node.rotation(),
                  });
                });

                setLiveTransform(null);
                onLiveTransformChange?.(null);
                setTransformMode('idle');
                isRotatingGestureRef.current = false;
                lastRotationRef.current = e.target.rotation();
              }}
              rotateAnchorCursor="grab"
              anchorStyleFunc={(anchor) => {
                if ((anchor as Konva.Node).hasName('rotater')) {
                  (anchor as Konva.Shape).scale({ x: 1.15, y: 1.15 });
                  (anchor as Konva.Shape).sceneFunc(function (context: Konva.Context, shape: Konva.Shape) {
                    const w = shape.getAttr('width') ?? 10;
                    const h = shape.getAttr('height') ?? 10;
                    const size = Math.min(w, h, 14);
                    const cx = size / 2;
                    const cy = size / 2;
                    const r = Math.max(2.5, size / 2 - 0.5);
                    const startAngle = (45 * Math.PI) / 180;
                    const endAngle = (315 * Math.PI) / 180;
                    shape.fill('transparent');
                    shape.stroke('#4285f4');
                    shape.strokeWidth(1.25);
                    context.beginPath();
                    context.arc(cx, cy, r, startAngle, endAngle, false);
                    context.fillStrokeShape(shape);
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
            {singleSelectedObj && (
              <DimensionLabel
                object={singleSelectedObj}
                transformMode={transformMode}
                liveTransform={liveTransform}
              />
            )}
          </>
        )}

        {/* Marquee selection rectangle */}
        {marqueeRect && (
          <SelectionRect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            visible={isMarqueeSelecting}
          />
        )}
      </Layer>
      <Layer>
        {Object.entries(remoteCursors).map(([userId, cursor]) => (
          <RemoteCursor key={userId} cursor={cursor} />
        ))}
      </Layer>
    </Stage>
  );
}
