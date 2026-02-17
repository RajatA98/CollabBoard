import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import { GridBackground } from './GridBackground';
import { StickyNote } from './StickyNote';
import { Rectangle } from './Rectangle';
import { RemoteCursor } from './RemoteCursor';
import { DimensionLabel } from './DimensionLabel';
import type { BoardObject, CursorData } from '../../types';

interface CanvasProps {
  objects: BoardObject[];
  onObjectUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onObjectDelete: (id: string) => void;
  onCanvasClick: () => void;
  onObjectDoubleClick?: (obj: BoardObject) => void;
  onObjectRightClick?: (obj: BoardObject, screenPos: { x: number; y: number }) => void;
  onDuplicateObject?: (id: string) => void;
  remoteCursors?: Record<string, CursorData>;
  onMouseMove?: (x: number, y: number) => void;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
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
/** Minimum size so sticky notes and shapes stay usable and don’t collapse. */
const MIN_OBJECT_SIZE = 60;

export function Canvas({
  objects,
  onObjectUpdate,
  onObjectDelete,
  onCanvasClick,
  onObjectDoubleClick,
  onObjectRightClick,
  onDuplicateObject,
  remoteCursors = {},
  onMouseMove,
  selectedObjectId,
  onSelectObject,
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
  /** Once user has rotated this gesture, keep showing rotation until transform ends */
  const isRotatingGestureRef = useRef(false);
  const [liveTransform, setLiveTransform] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null>(null);

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
      if (isEditingText) return;
      // Don't delete/duplicate when user is editing text in an input (e.g. Style panel)
      const active = document.activeElement;
      const isEditingInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable);
      if (isEditingInput) return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectId) {
        onObjectDelete(selectedObjectId);
        onSelectObject?.(null);
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedObjectId) {
        e.preventDefault();
        onDuplicateObject?.(selectedObjectId);
      }
    },
    [selectedObjectId, isEditingText, onObjectDelete, onSelectObject, onDuplicateObject]
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

  // Attach transformer to selected node
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;

    if (selectedObjectId) {
      const node = stage.findOne('#' + selectedObjectId);
      if (node) {
        transformer.nodes([node]);
      } else {
        transformer.nodes([]);
      }
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedObjectId]);

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
    >
      <Layer>
        <GridBackground viewport={viewport} stageSize={stageSize} />
      </Layer>
      <Layer>
        {/* Render non-selected objects first so selected object + handles draw on top */}
        {objects
          .filter((obj) => selectedObjectId !== obj.id)
          .map((obj) =>
            obj.type === 'sticky' ? (
              <StickyNote
                key={obj.id}
                object={obj}
                isSelected={false}
                onSelect={() => onSelectObject?.(obj.id)}
                onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                onDoubleClick={() => onObjectDoubleClick?.(obj)}
                onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
              />
            ) : (
              <Rectangle
                key={obj.id}
                object={obj}
                isSelected={false}
                onSelect={() => onSelectObject?.(obj.id)}
                onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                onDoubleClick={() => onObjectDoubleClick?.(obj)}
                onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
              />
            )
          )}
        {/* Render selected object and its TransformHandles last so they are on top */}
        {selectedObjectId &&
          objects
            .filter((obj) => obj.id === selectedObjectId)
            .map((obj) => {
              // During resize/rotate, pass live x/y/rotation so React doesn't overwrite the node with stale object and cause border/position lag
              const displayObject =
                liveTransform != null
                  ? { ...obj, x: liveTransform.x, y: liveTransform.y, rotation: liveTransform.rotation }
                  : obj;
              return (
              <React.Fragment key={obj.id}>
                {obj.type === 'sticky' ? (
                  <StickyNote
                    object={displayObject}
                    isSelected
                    onSelect={() => onSelectObject?.(obj.id)}
                    onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                    onDoubleClick={() => onObjectDoubleClick?.(obj)}
                    onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                  />
                ) : (
                  <Rectangle
                    object={displayObject}
                    isSelected
                    onSelect={() => onSelectObject?.(obj.id)}
                    onUpdate={(updates) => onObjectUpdate(obj.id, updates)}
                    onDoubleClick={() => onObjectDoubleClick?.(obj)}
                    onRightClick={(screenX, screenY) => onObjectRightClick?.(obj, { x: screenX, y: screenY })}
                  />
                )}
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
                    // Enforce minimum size so objects (especially sticky notes) don’t collapse
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

                    setLiveTransform(liveValues);
                    onLiveTransformChange?.(liveValues);
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
                    setLiveTransform(null);
                    onLiveTransformChange?.(null);
                    setTransformMode('idle');
                    isRotatingGestureRef.current = false;
                    lastRotationRef.current = node.rotation();
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
                />
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
  );
}
