import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer, Circle as KonvaCircle, Rect as KonvaRect, Line as KonvaLine } from 'react-konva';
import type Konva from 'konva';
import { GridBackground } from './GridBackground';
import { StickyNote } from './StickyNote';
import { Rectangle } from './Rectangle';
import { Circle } from './Circle';
import { Triangle } from './Triangle';
import { StarShape } from './StarShape';
import { LineShape, buildLinePointObjects } from './LineShape';
import { ConnectionPoints } from './ConnectionPoints';
import { TextElement } from './TextElement';
import { Frame } from './Frame';
import { PenStroke } from './PenStroke';
import { RemoteCursor } from './RemoteCursor';
import { SelectionRect } from './SelectionRect';
import { rectsIntersect } from '../../utils/coordinates';
import { getConnectionPoints, getConnectionPointById } from '../../utils/connectionPoints';
import type { Direction } from '../../utils/connectionPoints';
import { routeOrthogonal } from '../../utils/routing';
import type { BoardObject, CursorData, LiveTransformData, LiveEditingData, Waypoint } from '../../types';

const SNAP_RADIUS = 32;

interface LineOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  waypoints?: Waypoint[];
}

interface SnapCandidate {
  shapeId: string;
  pointId: string;
  x: number;
  y: number;
}

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
  /** Current canvas interaction mode */
  canvasMode?: 'cursor' | 'grab' | 'pen' | 'eraser';
  /** Pen tool settings */
  penColor?: string;
  penStrokeWidth?: number;
  /** Called when a pen stroke is completed */
  onAddPenStroke?: (stroke: BoardObject) => void;
  /** When true, stage panning is disabled so HTML5 drop from sidebar is not stolen. */
  isDraggingShapeFromSidebar?: boolean;
  /** Notify parent which object IDs just started dragging (so Firestore snapshots don't reset their positions). */
  onDragStart?: (ids: string[]) => void;
  /** Notify parent which object IDs just finished dragging. */
  onDragEnd?: (ids: string[]) => void;
  /** Called when user drag-connects shapes via connection X marks. toId/toPoint are empty for free-ended lines. */
  onConnectShapes?: (
    fromId: string, fromPoint: string,
    toId: string, toPoint: string,
    startX: number, startY: number,
    endX: number, endY: number,
    waypoints: Waypoint[],
  ) => void;
}

const ZOOM_SPEED = 1.05;
/** Minimum size so sticky notes and shapes stay usable and don't collapse. */
const MIN_OBJECT_SIZE = 60;

/** Coerce numeric fields to finite so Konva and connection points never receive NaN. */
function coerceDisplayObject<T extends { x: number; y: number; width: number; height: number; rotation?: number }>(
  display: T,
  fallback: { x: number; y: number; width: number; height: number; rotation?: number },
): T {
  const n = (v: number, d: number) => (Number.isFinite(v) ? v : d);
  const r = display.rotation ?? fallback.rotation ?? 0;
  return {
    ...display,
    x: n(display.x, fallback.x),
    y: n(display.y, fallback.y),
    width: Math.max(MIN_OBJECT_SIZE, n(display.width, fallback.width)),
    height: Math.max(MIN_OBJECT_SIZE, n(display.height, fallback.height)),
    rotation: n(r, fallback.rotation ?? 0),
  } as T;
}

/** Ensure transform values are finite numbers (no NaN/Infinity) to avoid white screen / Konva errors. */
function sanitizeTransform(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  fallback: { x: number; y: number; width: number; height: number; rotation: number },
): { x: number; y: number; width: number; height: number; rotation: number } {
  const n = (v: number, def: number) => (Number.isFinite(v) ? v : def);
  const r = n(rotation, fallback.rotation);
  return {
    x: n(x, fallback.x),
    y: n(y, fallback.y),
    width: Math.max(MIN_OBJECT_SIZE, n(width, fallback.width)),
    height: Math.max(MIN_OBJECT_SIZE, n(height, fallback.height)),
    rotation: Math.max(-360, Math.min(360, r)),
  };
}

/**
 * Preserve waypoint bend when start/end move: express waypoints relative to the
 * start-end segment, then reconstruct with new start/end so the path shape stays constant.
 */
function preserveWaypointBend(
  waypoints: Waypoint[],
  oldStart: { x: number; y: number },
  oldEnd: { x: number; y: number },
  newStart: { x: number; y: number },
  newEnd: { x: number; y: number },
): Waypoint[] {
  const dx = oldEnd.x - oldStart.x;
  const dy = oldEnd.y - oldStart.y;
  const L = Math.hypot(dx, dy) || 1e-6;
  const perpX = -dy / L;
  const perpY = dx / L;

  const newDx = newEnd.x - newStart.x;
  const newDy = newEnd.y - newStart.y;
  const newL = Math.hypot(newDx, newDy) || 1e-6;
  const newPerpX = -newDy / newL;
  const newPerpY = newDx / newL;

  return waypoints.map((w) => {
    const wx = w.x - oldStart.x;
    const wy = w.y - oldStart.y;
    const u = (wx * dx + wy * dy) / (L * L);
    const v = wx * perpX + wy * perpY;
    return {
      x: newStart.x + u * newDx + v * newPerpX,
      y: newStart.y + u * newDy + v * newPerpY,
    };
  });
}

/** Compute line geometry updates for all lines connected to any shape in shapeUpdates. */
function computeConnectedLineUpdates(
  shapeUpdates: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }>,
  objects: BoardObject[],
): Array<{ id: string; updates: Partial<BoardObject> }> {
  const updatedIds = new Set(shapeUpdates.map((s) => s.id));
  const shapeUpdatesMap = new Map(shapeUpdates.map((s) => [s.id, s]));
  const getVirtual = (id: string): BoardObject | undefined => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return undefined;
    const up = shapeUpdatesMap.get(id);
    return up ? { ...obj, ...up } : obj;
  };
  const result: Array<{ id: string; updates: Partial<BoardObject> }> = [];
  for (const line of objects) {
    if (line.type !== 'line') continue;
    const fromUpdated = line.fromId != null && updatedIds.has(line.fromId);
    const toUpdated = line.toId != null && updatedIds.has(line.toId);
    if (!fromUpdated && !toUpdated) continue;
    const fromShape = line.fromId ? getVirtual(line.fromId) : null;
    const toShape = line.toId ? getVirtual(line.toId) : null;
    let startPt = { x: line.x, y: line.y };
    let endPt = { x: line.x + line.width, y: line.y + line.height };
    if (line.fromId && line.fromPoint && fromShape) {
      const cp = getConnectionPointById(fromShape, line.fromPoint);
      if (cp) { startPt = cp; }
    }
    if (line.toId && line.toPoint && toShape) {
      const cp = getConnectionPointById(toShape, line.toPoint);
      if (cp) { endPt = cp; }
    }
    const oldStart = { x: line.x, y: line.y };
    const oldEnd = { x: line.x + line.width, y: line.y + line.height };
    const hasWaypoints = (line.waypoints?.length ?? 0) > 0;
    const waypoints = hasWaypoints
      ? preserveWaypointBend(line.waypoints!, oldStart, oldEnd, startPt, endPt)
      : [];
    result.push({
      id: line.id,
      updates: { x: startPt.x, y: startPt.y, width: endPt.x - startPt.x, height: endPt.y - startPt.y, waypoints },
    });
  }
  return result;
}

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
  canvasMode = 'cursor',
  penColor = '#000000',
  penStrokeWidth: penStrokeWidthProp = 5,
  onAddPenStroke,
  isDraggingShapeFromSidebar = false,
  onDragStart,
  onDragEnd,
  onConnectShapes,
}: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 48 });
  const [isAltDown, setIsAltDown] = useState(false);
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
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const middleMousePanStartRef = useRef<{ pointerX: number; pointerY: number; viewportX: number; viewportY: number } | null>(null);
  const [isGrabPanning, setIsGrabPanning] = useState(false);
  const grabPanStartRef = useRef<{ pointerX: number; pointerY: number; viewportX: number; viewportY: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeEndRef = useRef<{ x: number; y: number } | null>(null);

  // ── Connection & line handle state ──────────────────────────────────────
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [lineOverrides, setLineOverrides] = useState<Record<string, LineOverride>>({});
  const [snapHighlight, setSnapHighlight] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingEndpoint, setIsDraggingEndpoint] = useState(false);
  const snapCandidateRef = useRef<SnapCandidate | null>(null);
  const draggingEndpointRef = useRef<'start' | 'end' | null>(null);

  // ── Drag-to-connect state ──────────────────────────────────────────────
  const [drawingConnection, setDrawingConnection] = useState<{
    fromShapeId: string; fromPointId: string;
    fromX: number; fromY: number;
    toX: number; toY: number;
  } | null>(null);
  const drawingConnectionRef = useRef<typeof drawingConnection>(null);
  const drawingSnapRef = useRef<SnapCandidate | null>(null);

  const [isDraggingNode, setIsDraggingNode] = useState(false);

  // ── Pen drawing state ──────────────────────────────────────────────────
  const isDrawingPenRef = useRef(false);
  const drawingOriginRef = useRef<{ x: number; y: number } | null>(null);
  const currentPointsRef = useRef<number[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<number[] | null>(null);
  const [drawingOriginState, setDrawingOriginState] = useState<{ x: number; y: number } | null>(null);

  // ── Eraser state ──────────────────────────────────────────────────────
  const isErasingRef = useRef(false);
  const erasedIdsRef = useRef<Set<string>>(new Set());
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);

  /** When multi-select: current visual position/size/rotation of each selected node (for ConnectionPoints and line overrides). */
  const multiSelectDisplayRef = useRef<Map<string, { x: number; y: number; width: number; height: number; rotation: number }>>(new Map());
  /** Latest objects for use inside Transformer callbacks (avoids stale closure). */
  const objectsRef = useRef<BoardObject[]>(objects);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);
  /** When dragging multi-select via marquee rect: rect start position. */
  const multiSelectDragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Selected line (only when single selection of a line)
  const selectedLine = selectedObjectIds.length === 1
    ? objects.find(o => o.id === selectedObjectIds[0] && o.type === 'line') ?? null
    : null;
  const effectiveSelectedLine: BoardObject | null = selectedLine
    ? (lineOverrides[selectedLine.id] ? { ...selectedLine, ...lineOverrides[selectedLine.id] } : selectedLine)
    : null;

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

  // Grab-mode left-click pan (same pattern as middle-mouse pan above)
  useEffect(() => {
    if (!isGrabPanning) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    const onWindowMouseMove = (e: MouseEvent) => {
      const start = grabPanStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.pointerX;
      const dy = e.clientY - start.pointerY;
      setPosition(start.viewportX + dx, start.viewportY + dy);
    };
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        grabPanStartRef.current = null;
        setIsGrabPanning(false);
      }
    };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      document.body.style.cursor = prevCursor;
    };
  }, [isGrabPanning, setPosition]);

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
      // Grab mode: left-click starts pan (same logic as middle mouse)
      if (canvasMode === 'grab' && e.evt.button === 0) {
        e.evt.preventDefault();
        setIsGrabPanning(true);
        grabPanStartRef.current = {
          pointerX: e.evt.clientX,
          pointerY: e.evt.clientY,
          viewportX: viewport.x,
          viewportY: viewport.y,
        };
        return;
      }
      // Pen mode: start drawing a freehand stroke
      if (canvasMode === 'pen' && e.evt.button === 0) {
        e.evt.preventDefault();
        const worldPos = getWorldPointer();
        if (!worldPos) return;
        isDrawingPenRef.current = true;
        drawingOriginRef.current = worldPos;
        currentPointsRef.current = [0, 0];
        setDrawingOriginState(worldPos);
        setDrawingPoints([0, 0]);
        return;
      }
      // Eraser mode: start erasing pen strokes
      if (canvasMode === 'eraser' && e.evt.button === 0) {
        e.evt.preventDefault();
        isErasingRef.current = true;
        erasedIdsRef.current = new Set();
        // Try to erase object at pointer position
        const stage = e.target.getStage();
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const target = stage.getIntersection(pointer);
            if (target) {
              let node: Konva.Node | null = target;
              while (node && node !== stage) {
                const nid = node.id?.() ?? '';
                if (nid) {
                  const found = objectsRef.current.find(o => o.id === nid && o.type === 'pen');
                  if (found && !erasedIdsRef.current.has(found.id)) {
                    erasedIdsRef.current.add(found.id);
                    _onObjectDelete?.(found.id);
                  }
                  break;
                }
                node = node.parent;
              }
            }
          }
        }
        return;
      }
      const stage = e.target.getStage();
      const target = e.target;
      const isStage = target === stage;
      const isLayer = (target as Konva.Node).getClassName?.() === 'Layer';
      if (!isStage && !isLayer) return;
      if (e.evt.button !== 0) return;
      const worldPos = getWorldPointer();
      if (!worldPos) return;

      marqueeStartRef.current = worldPos;
      marqueeEndRef.current = worldPos;
      setIsMarqueeSelecting(true);
      setMarqueeStart(worldPos);
      setMarqueeEnd(worldPos);
    },
    [getWorldPointer, viewport, canvasMode, _onObjectDelete]
  );

  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (onMouseMove) {
        const worldPos = getWorldPointer();
        if (worldPos) onMouseMove(worldPos.x, worldPos.y);
      }
      // Update eraser cursor position
      if (canvasMode === 'eraser') {
        const worldPos = getWorldPointer();
        if (worldPos) setEraserPos(worldPos);
      }
      // Pen drawing: accumulate points
      if (isDrawingPenRef.current && canvasMode === 'pen') {
        const worldPos = getWorldPointer();
        const origin = drawingOriginRef.current;
        if (worldPos && origin) {
          const relX = worldPos.x - origin.x;
          const relY = worldPos.y - origin.y;
          currentPointsRef.current.push(relX, relY);
          setDrawingPoints([...currentPointsRef.current]);
        }
        return;
      }
      // Eraser drag: erase pen strokes under cursor
      if (isErasingRef.current && canvasMode === 'eraser') {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const target = stage.getIntersection(pointer);
            if (target) {
              let node: Konva.Node | null = target;
              while (node && node !== stage) {
                const nid = node.id?.() ?? '';
                if (nid) {
                  const found = objectsRef.current.find(o => o.id === nid && o.type === 'pen');
                  if (found && !erasedIdsRef.current.has(found.id)) {
                    erasedIdsRef.current.add(found.id);
                    _onObjectDelete?.(found.id);
                  }
                  break;
                }
                node = node.parent;
              }
            }
          }
        }
        return;
      }
      if (isMarqueeSelecting) {
        const worldPos = getWorldPointer();
        if (worldPos) {
          marqueeEndRef.current = worldPos;
          setMarqueeEnd(worldPos);
        }
      }
      // Update drawing connection line to follow cursor
      if (drawingConnectionRef.current) {
        const worldPos = getWorldPointer();
        if (worldPos) {
          const snap = findNearestSnapForConnect(worldPos.x, worldPos.y, drawingConnectionRef.current.fromShapeId);
          if (snap) {
            drawingSnapRef.current = snap;
            setSnapHighlight({ x: snap.x, y: snap.y });
            setDrawingConnection(prev => prev ? { ...prev, toX: snap.x, toY: snap.y } : null);
            drawingConnectionRef.current = drawingConnectionRef.current ? { ...drawingConnectionRef.current, toX: snap.x, toY: snap.y } : null;
          } else {
            drawingSnapRef.current = null;
            setSnapHighlight(null);
            setDrawingConnection(prev => prev ? { ...prev, toX: worldPos.x, toY: worldPos.y } : null);
            drawingConnectionRef.current = drawingConnectionRef.current ? { ...drawingConnectionRef.current, toX: worldPos.x, toY: worldPos.y } : null;
          }
        }
        return;
      }
      // Hover detection for connection point overlays
      const stage = stageRef.current;
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const target = stage.getIntersection(pointer);
          if (target) {
            let node: Konva.Node | null = target;
            while (node && node !== stage) {
              const nid = node.id?.() ?? '';
              if (nid) {
                const found = objects.find(o => o.id === nid);
                if (found) { setHoveredShapeId(found.id); return; }
              }
              node = node.parent;
            }
          }
          setHoveredShapeId(null);
        }
      }
    },
    [onMouseMove, getWorldPointer, isMarqueeSelecting, objects, drawingConnection, canvasMode, _onObjectDelete]
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1) {
        setIsMiddleMouseDown(false);
        return;
      }
      // Eraser release
      if (canvasMode === 'eraser' && e.evt.button === 0) {
        isErasingRef.current = false;
        erasedIdsRef.current = new Set();
        return;
      }
      // Marquee finalization is handled by window mouseup so we get it even when releasing over a shape
      if (e.evt.button === 0 && isMarqueeSelecting) return;
    },
    [isMarqueeSelecting, canvasMode]
  );

  // Window mouseup ensures marquee selection finalizes even when releasing over a shape (Stage may not get the event)
  useEffect(() => {
    if (!isMarqueeSelecting) return;
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const start = marqueeStartRef.current;
      const end = marqueeEndRef.current;
      if (!start || !end) {
        setIsMarqueeSelecting(false);
        setMarqueeStart(null);
        setMarqueeEnd(null);
        marqueeStartRef.current = null;
        marqueeEndRef.current = null;
        return;
      }
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
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
      marqueeStartRef.current = null;
      marqueeEndRef.current = null;
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [isMarqueeSelecting, objects, onSetSelectedIds, onClearSelection, onCanvasClick]);

  // Window mouseup handler for pen stroke finalization
  useEffect(() => {
    if (canvasMode !== 'pen') return;
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 0 || !isDrawingPenRef.current) return;
      isDrawingPenRef.current = false;
      const pts = currentPointsRef.current;
      const origin = drawingOriginRef.current;
      // Clean up drawing state
      setDrawingPoints(null);
      setDrawingOriginState(null);
      currentPointsRef.current = [];
      drawingOriginRef.current = null;
      // Need at least 2 points (4 values) to form a stroke
      if (pts.length < 4 || !origin) return;
      // Compute bounding box for width/height
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
      }
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxY - minY, 1);
      const stroke: BoardObject = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'pen',
        x: origin.x,
        y: origin.y,
        width: w,
        height: h,
        rotation: 0,
        color: penColor,
        strokeWidth: penStrokeWidthProp,
        points: pts,
        createdBy: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: '',
      };
      onAddPenStroke?.(stroke);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [canvasMode, penColor, penStrokeWidthProp, onAddPenStroke]);

  // Window mouseup handler for eraser release
  useEffect(() => {
    if (canvasMode !== 'eraser') return;
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isErasingRef.current = false;
      erasedIdsRef.current = new Set();
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [canvasMode]);

  const handleObjectDragStart = useCallback(
    (draggedId: string) => {
      setIsDraggingNode(true);
      setHoveredShapeId(null);
      const idsBeingDragged =
        selectedObjectIds.includes(draggedId) && selectedObjectIds.length > 1
          ? selectedObjectIds
          : [draggedId];
      onDragStart?.(idsBeingDragged);

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
    [selectedObjectIds, onDragStart]
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
      // Unmark before writing so Firestore snapshot after update uses fresh data
      const idsBeingDragged =
        positions && selectedObjectIds.length > 1 ? selectedObjectIds : [draggedId];
      onDragEnd?.(idsBeingDragged);
      if (!positions || selectedObjectIds.length <= 1) {
        onObjectUpdate(draggedId, { x: finalX, y: finalY });
        return;
      }
      const startPos = positions.get(draggedId);
      if (!startPos) return;
      const dx = finalX - startPos.x;
      const dy = finalY - startPos.y;

      const selectedIdsSet = new Set(selectedObjectIds);
      const buildVirtualShape = (obj: BoardObject): BoardObject => {
        const pos = positions.get(obj.id);
        if (pos && selectedIdsSet.has(obj.id)) {
          return { ...obj, x: pos.x + dx, y: pos.y + dy };
        }
        return obj;
      };

      const changes: { id: string; updates: Partial<BoardObject> }[] = [];
      for (const id of selectedObjectIds) {
        const pos = positions.get(id);
        if (!pos) continue;
        const obj = objects.find(o => o.id === id);
        if (!obj) continue;

        const newX = pos.x + dx;
        const newY = pos.y + dy;

        if (obj.type === 'line') {
          if (obj.fromId || obj.toId) {
            const fromShapeRaw = obj.fromId ? objects.find(o => o.id === obj.fromId) : null;
            const toShapeRaw = obj.toId ? objects.find(o => o.id === obj.toId) : null;
            const fromShape = fromShapeRaw ? buildVirtualShape(fromShapeRaw) : null;
            const toShape = toShapeRaw ? buildVirtualShape(toShapeRaw) : null;
            const oldStart = { x: obj.x, y: obj.y };
            const oldEnd = { x: obj.x + obj.width, y: obj.y + obj.height };
            let startPt = { ...oldStart };
            let endPt = { ...oldEnd };
            if (obj.fromId && obj.fromPoint && fromShape) {
              const cp = getConnectionPointById(fromShape, obj.fromPoint);
              if (cp) { startPt = cp; }
            }
            if (obj.toId && obj.toPoint && toShape) {
              const cp = getConnectionPointById(toShape, obj.toPoint);
              if (cp) { endPt = cp; }
            }
            const hasWaypoints = (obj.waypoints?.length ?? 0) > 0;
            const waypoints = hasWaypoints
              ? preserveWaypointBend(obj.waypoints!, oldStart, oldEnd, startPt, endPt)
              : [];
            changes.push({ id, updates: { x: startPt.x, y: startPt.y, width: endPt.x - startPt.x, height: endPt.y - startPt.y, waypoints } });
          } else {
            changes.push({
              id,
              updates: {
                x: newX,
                y: newY,
                waypoints: (obj.waypoints ?? []).map(w => ({ x: w.x + dx, y: w.y + dy })),
              },
            });
          }
        } else {
          changes.push({ id, updates: { x: newX, y: newY } });
        }
      }

      const shapeUpdates = selectedObjectIds
        .filter((id) => {
          const obj = objects.find((o) => o.id === id);
          return obj && obj.type !== 'line';
        })
        .map((id) => {
          const pos = positions.get(id);
          const obj = objects.find((o) => o.id === id)!;
          if (!pos) return null;
          return {
            id,
            x: pos.x + dx,
            y: pos.y + dy,
            width: obj.width,
            height: obj.height,
            rotation: obj.rotation ?? 0,
          };
        })
        .filter((u): u is NonNullable<typeof u> => u != null);
      const lineUpdates = computeConnectedLineUpdates(shapeUpdates, objects).filter(
        (lu) => !selectedIdsSet.has(lu.id),
      );
      changes.push(...lineUpdates);

      if (onBatchObjectUpdate && changes.length > 0) {
        onBatchObjectUpdate(changes);
      } else {
        changes.forEach(({ id, updates }) => onObjectUpdate(id, updates));
      }
      dragStartPositionsRef.current = null;
    },
    [selectedObjectIds, objects, onObjectUpdate, onBatchObjectUpdate, onDragEnd]
  );

  const handleMultiSelectMarqueeDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rect = e.target;
      multiSelectDragStartRef.current = { x: rect.x(), y: rect.y() };
      onDragStart?.(selectedObjectIds);
      const stage = stageRef.current;
      if (!stage || selectedObjectIds.length <= 1) return;
      const positions = new Map<string, { x: number; y: number }>();
      selectedObjectIds.forEach((id) => {
        const node = stage.findOne('#' + id);
        if (node) positions.set(id, { x: node.x(), y: node.y() });
      });
      dragStartPositionsRef.current = positions;
      setIsDraggingNode(true);
      setHoveredShapeId(null);
    },
    [selectedObjectIds, onDragStart]
  );

  const handleMultiSelectMarqueeDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rect = e.target;
      const start = multiSelectDragStartRef.current;
      const positions = dragStartPositionsRef.current;
      if (!start || !positions || selectedObjectIds.length <= 1) return;
      const dx = rect.x() - start.x;
      const dy = rect.y() - start.y;
      const stage = stageRef.current;
      if (!stage) return;
      selectedObjectIds.forEach((id) => {
        const pos = positions.get(id);
        if (!pos) return;
        const node = stage.findOne('#' + id);
        if (node) {
          node.x(pos.x + dx);
          node.y(pos.y + dy);
        }
      });
      rect.position({ x: start.x + dx, y: start.y + dy });
      stage.findOne('.konva-transformer')?.getLayer()?.batchDraw();
    },
    [selectedObjectIds]
  );

  const handleMultiSelectMarqueeDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rect = e.target;
      const start = multiSelectDragStartRef.current;
      const positions = dragStartPositionsRef.current;
      multiSelectDragStartRef.current = null;
      setIsDraggingNode(false);
      if (!start || !positions || selectedObjectIds.length <= 1) {
        onDragEnd?.(selectedObjectIds);
        return;
      }
      const dx = rect.x() - start.x;
      const dy = rect.y() - start.y;
      const firstId = selectedObjectIds[0];
      const pos = positions.get(firstId);
      if (!pos) { onDragEnd?.(selectedObjectIds); return; }
      // handleObjectDragEnd already calls onDragEnd, so no need to call it here
      handleObjectDragEnd(firstId, pos.x + dx, pos.y + dy);
    },
    [selectedObjectIds, handleObjectDragEnd, onDragEnd]
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
      if (canvasMode === 'grab' || canvasMode === 'pen' || canvasMode === 'eraser') return; // No selection interaction in grab/pen/eraser mode
      const stage = e.target.getStage();
      const target = e.target;
      const isStage = target === stage;
      const isLayer = (target as Konva.Node).getClassName?.() === 'Layer';
      if (isStage || isLayer) {
        onClearSelection();
        onCanvasClick();
      }
      const pos = stage?.getPointerPosition();
      if (pos && onLastClickPosition) {
        const worldX = (pos.x - viewport.x) / viewport.scaleX;
        const worldY = (pos.y - viewport.y) / viewport.scaleY;
        onLastClickPosition({ x: worldX, y: worldY });
      }
    },
    [viewport, onLastClickPosition, onClearSelection, onCanvasClick, canvasMode]
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

      if (e.key === 'Escape') {
        setDrawingConnection(null);
        drawingConnectionRef.current = null;
        drawingSnapRef.current = null;
        setSnapHighlight(null);
        setIsDraggingEndpoint(false);
        setLineOverrides({});
        return;
      }
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

  // Attach transformer to selected node(s) — exclude lines (they have custom handles)
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;
    if (selectedObjectIds.length === 0) {
      transformer.nodes([]);
      multiSelectDisplayRef.current.clear();
    } else {
      const nodes = selectedObjectIds
        .map((id) => stage.findOne('#' + id))
        .filter((n): n is Konva.Node => n != null);
      transformer.nodes(nodes);
      if (nodes.length > 1) {
        const map = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();
        const n = (v: number, def: number) => (Number.isFinite(v) ? v : def);
        nodes.forEach((node: Konva.Node) => {
          const id = node.id?.();
          if (!id) return;
          const obj = objects.find(o => o.id === id);
          const defW = obj && Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 100;
          const defH = obj && Number.isFinite(obj.height) && obj.height > 0 ? obj.height : 100;
          let w = node.width();
          let h = node.height();
          if (!Number.isFinite(w) || w <= 0) w = defW;
          if (!Number.isFinite(h) || h <= 0) h = defH;
          const sx = node.scaleX?.() ?? 1;
          const sy = node.scaleY?.() ?? 1;
          const minSize = obj?.type === 'line' ? 0 : MIN_OBJECT_SIZE;
          const rw = Math.max(minSize, w * sx);
          const rh = Math.max(minSize, h * sy);
          map.set(id, {
            x: n(node.x(), obj?.x ?? 0),
            y: n(node.y(), obj?.y ?? 0),
            width: rw,
            height: rh,
            rotation: n(node.rotation?.() ?? 0, obj?.rotation ?? 0),
          });
        });
        multiSelectDisplayRef.current = map;
      } else {
        multiSelectDisplayRef.current.clear();
      }
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedObjectIds, objects]);

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

  // ── Connected-line helpers ──────────────────────────────────────────────
  const updateConnectedLines = useCallback((shapeId: string, newX: number, newY: number, newW: number, newH: number, newRot: number) => {
    const shape = objects.find(o => o.id === shapeId);
    if (!shape) return;
    const updatedShape: BoardObject = { ...shape, x: newX, y: newY, width: newW, height: newH, rotation: newRot };
    const connectedLines = objects.filter(o => o.type === 'line' && (o.fromId === shapeId || o.toId === shapeId));
    if (connectedLines.length === 0) return;
    for (const line of connectedLines) {
      const oldStart = { x: line.x, y: line.y };
      const oldEnd = { x: line.x + line.width, y: line.y + line.height };
      let startPt = { ...oldStart };
      let startDir: Direction = 'right';
      let endPt = { ...oldEnd };
      let endDir: Direction = 'left';
      if (line.fromId === shapeId && line.fromPoint) {
        const cp = getConnectionPointById(updatedShape, line.fromPoint);
        if (cp) { startPt = cp; startDir = cp.direction; }
      } else if (line.fromId) {
        const other = objects.find(o => o.id === line.fromId);
        if (other && line.fromPoint) { const cp = getConnectionPointById(other, line.fromPoint); if (cp) { startPt = cp; startDir = cp.direction; } }
      }
      if (line.toId === shapeId && line.toPoint) {
        const cp = getConnectionPointById(updatedShape, line.toPoint);
        if (cp) { endPt = cp; endDir = cp.direction; }
      } else if (line.toId) {
        const other = objects.find(o => o.id === line.toId);
        if (other && line.toPoint) { const cp = getConnectionPointById(other, line.toPoint); if (cp) { endPt = cp; endDir = cp.direction; } }
      }
      const hasWaypoints = (line.waypoints?.length ?? 0) > 0;
      const waypoints = hasWaypoints
        ? preserveWaypointBend(line.waypoints!, oldStart, oldEnd, startPt, endPt)
        : routeOrthogonal(startPt, startDir, endPt, endDir, objects, [shapeId, line.id]);
      onObjectUpdate(line.id, { x: startPt.x, y: startPt.y, width: endPt.x - startPt.x, height: endPt.y - startPt.y, waypoints });
    }
  }, [objects, onObjectUpdate]);

  // Rubber-band connected lines during shape drag (layer-level)
  const handleLayerDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Node;
    const nodeId = node.id?.() ?? '';
    if (!nodeId) return;
    const obj = objects.find(o => o.id === nodeId && o.type !== 'line');
    if (!obj) return;
    const stage = stageRef.current;
    if (!stage) return;
    const nx = node.x(), ny = node.y();
    const connectedLines = objects.filter(o => o.type === 'line' && (o.fromId === nodeId || o.toId === nodeId));
    if (connectedLines.length === 0) return;
    const getShapePos = (id: string): BoardObject | null => {
      const o = objects.find(x => x.id === id);
      if (!o) return null;
      if (selectedObjectIds.includes(id)) {
        const n = stage.findOne('#' + id);
        if (n) return { ...o, x: n.x(), y: n.y() };
      }
      return o;
    };
    const updatedShape: BoardObject = { ...obj, x: nx, y: ny };
    const overrides: Record<string, LineOverride> = {};
    for (const line of connectedLines) {
      const oldSx = line.x, oldSy = line.y, oldEx = line.x + line.width, oldEy = line.y + line.height;
      let sx = oldSx, sy = oldSy, ex = oldEx, ey = oldEy;
      const fromShape = line.fromId ? getShapePos(line.fromId) : null;
      const toShape = line.toId ? getShapePos(line.toId) : null;
      if (line.fromId === nodeId && line.fromPoint) { const cp = getConnectionPointById(updatedShape, line.fromPoint); if (cp) { sx = cp.x; sy = cp.y; } }
      else if (fromShape && line.fromPoint) { const cp = getConnectionPointById(fromShape, line.fromPoint); if (cp) { sx = cp.x; sy = cp.y; } }
      if (line.toId === nodeId && line.toPoint) { const cp = getConnectionPointById(updatedShape, line.toPoint); if (cp) { ex = cp.x; ey = cp.y; } }
      else if (toShape && line.toPoint) { const cp = getConnectionPointById(toShape, line.toPoint); if (cp) { ex = cp.x; ey = cp.y; } }
      const oldStart = { x: oldSx, y: oldSy };
      const oldEnd = { x: oldEx, y: oldEy };
      const newStart = { x: sx, y: sy };
      const newEnd = { x: ex, y: ey };
      const waypoints = (line.waypoints?.length ?? 0) > 0
        ? preserveWaypointBend(line.waypoints!, oldStart, oldEnd, newStart, newEnd)
        : [];
      overrides[line.id] = { x: sx, y: sy, width: ex - sx, height: ey - sy, waypoints };
    }
    setLineOverrides(prev => ({ ...prev, ...overrides }));
  }, [objects, selectedObjectIds]);

  const handleLayerDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Node;
    const nodeId = node.id?.() ?? '';
    setIsDraggingNode(false);
    if (!nodeId) return;
    const obj = objects.find(o => o.id === nodeId && o.type !== 'line');
    if (!obj) return;
    if (selectedObjectIds.length > 1 && selectedObjectIds.includes(nodeId)) {
      setLineOverrides({});
      return;
    }
    updateConnectedLines(nodeId, node.x(), node.y(), obj.width, obj.height, obj.rotation ?? 0);
    setLineOverrides({});
  }, [objects, updateConnectedLines, selectedObjectIds]);

  // ── Connection flow (drag-to-connect) ───────────────────────────────────

  /** Find nearest snap candidate among all shapes except the source shape */
  const findNearestSnapForConnect = useCallback((wx: number, wy: number, excludeShapeId: string): SnapCandidate | null => {
    let best: SnapCandidate | null = null;
    let bestDist = SNAP_RADIUS;
    for (const shape of objects) {
      if (shape.id === excludeShapeId) continue;
      for (const cp of getConnectionPoints(shape)) {
        const d = Math.hypot(cp.x - wx, cp.y - wy);
        if (d < bestDist) { bestDist = d; best = { shapeId: shape.id, pointId: cp.id, x: cp.x, y: cp.y }; }
      }
    }
    return best;
  }, [objects]);

  const handleConnectionDragStart = useCallback((shapeId: string, pointId: string, x: number, y: number) => {
    const conn = { fromShapeId: shapeId, fromPointId: pointId, fromX: x, fromY: y, toX: x, toY: y };
    setDrawingConnection(conn);
    drawingConnectionRef.current = conn;
    drawingSnapRef.current = null;
  }, []);

  const handleDetachConnection = useCallback((shapeId: string, pointId: string) => {
    setDrawingConnection(null);
    drawingConnectionRef.current = null;
    drawingSnapRef.current = null;
    setSnapHighlight(null);
    const linesToDetach = objects.filter(
      o => o.type === 'line' && (
        (o.fromId === shapeId && o.fromPoint === pointId) ||
        (o.toId === shapeId && o.toPoint === pointId)
      )
    );
    for (const line of linesToDetach) {
      const isFrom = line.fromId === shapeId && line.fromPoint === pointId;
      if (isFrom) {
        onObjectUpdate(line.id, { fromId: undefined, fromPoint: undefined, waypoints: [] });
      } else {
        onObjectUpdate(line.id, { toId: undefined, toPoint: undefined, waypoints: [] });
      }
    }
  }, [objects, onObjectUpdate]);

  const handleConnectionDragEnd = useCallback((toShapeId: string, toPointId: string) => {
    const dc = drawingConnectionRef.current;
    if (!dc) return;
    const fromShape = objects.find(o => o.id === dc.fromShapeId);
    const toShape = objects.find(o => o.id === toShapeId);
    if (!fromShape || !toShape) { setDrawingConnection(null); drawingConnectionRef.current = null; setSnapHighlight(null); return; }
    const fromPt = getConnectionPointById(fromShape, dc.fromPointId);
    const toPt = getConnectionPointById(toShape, toPointId);
    if (!fromPt || !toPt) { setDrawingConnection(null); drawingConnectionRef.current = null; setSnapHighlight(null); return; }
    const waypoints = routeOrthogonal(fromPt, fromPt.direction, toPt, toPt.direction, objects, [dc.fromShapeId, toShapeId]);
    onConnectShapes?.(dc.fromShapeId, dc.fromPointId, toShapeId, toPointId, fromPt.x, fromPt.y, toPt.x, toPt.y, waypoints);
    setDrawingConnection(null);
    drawingConnectionRef.current = null;
    setSnapHighlight(null);
  }, [objects, onConnectShapes]);

  // Finalize drawing connection on mouseup anywhere (snap target or free endpoint)
  useEffect(() => {
    if (!drawingConnection) return;
    const onWindowMouseUp = () => {
      const dc = drawingConnectionRef.current;
      if (!dc) return;
      const snap = drawingSnapRef.current;
      if (snap) {
        const fromShape = objects.find(o => o.id === dc.fromShapeId);
        const toShape = objects.find(o => o.id === snap.shapeId);
        if (fromShape && toShape) {
          const fromPt = getConnectionPointById(fromShape, dc.fromPointId);
          const toPt = getConnectionPointById(toShape, snap.pointId);
          if (fromPt && toPt) {
            const waypoints = routeOrthogonal(fromPt, fromPt.direction, toPt, toPt.direction, objects, [dc.fromShapeId, snap.shapeId]);
            onConnectShapes?.(dc.fromShapeId, dc.fromPointId, snap.shapeId, snap.pointId, fromPt.x, fromPt.y, toPt.x, toPt.y, waypoints);
          }
        }
      } else {
        const dist = Math.hypot(dc.toX - dc.fromX, dc.toY - dc.fromY);
        if (dist >= 8) {
          onConnectShapes?.(dc.fromShapeId, dc.fromPointId, '', '', dc.fromX, dc.fromY, dc.toX, dc.toY, []);
        }
      }
      setDrawingConnection(null);
      drawingConnectionRef.current = null;
      drawingSnapRef.current = null;
      setSnapHighlight(null);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [drawingConnection, objects, onConnectShapes]);

  // ── Viewport culling: only render objects near the visible area ─────────
  const CULL_MARGIN = 500;
  const visibleObjects = useMemo(() => {
    if (!viewport || !stageSize) return objects;
    const worldLeft = -viewport.x / viewport.scaleX - CULL_MARGIN;
    const worldTop = -viewport.y / viewport.scaleY - CULL_MARGIN;
    const worldRight = worldLeft + stageSize.width / viewport.scaleX + CULL_MARGIN * 2;
    const worldBottom = worldTop + stageSize.height / viewport.scaleY + CULL_MARGIN * 2;
    return objects.filter(obj => {
      if (selectedObjectIds.includes(obj.id)) return true;
      const ox = obj.x ?? 0;
      const oy = obj.y ?? 0;
      const ow = obj.width ?? 200;
      const oh = obj.height ?? 200;
      return ox + ow >= worldLeft && ox <= worldRight && oy + oh >= worldTop && oy <= worldBottom;
    });
  }, [objects, viewport, stageSize, selectedObjectIds]);

  // ── Line endpoint drag with snap ────────────────────────────────────────
  const nonLineObjects = objects.filter(o => o.type !== 'line' && o.type !== 'frame');

  const findNearestSnap = useCallback((wx: number, wy: number, excludeShapeId?: string): SnapCandidate | null => {
    let best: SnapCandidate | null = null;
    let bestDist = SNAP_RADIUS;
    for (const shape of nonLineObjects) {
      if (excludeShapeId && shape.id === excludeShapeId) continue;
      for (const cp of getConnectionPoints(shape)) {
        const d = Math.hypot(cp.x - wx, cp.y - wy);
        if (d < bestDist) { bestDist = d; best = { shapeId: shape.id, pointId: cp.id, x: cp.x, y: cp.y }; }
      }
    }
    return best;
  }, [nonLineObjects]);

  const makeEndpointDragMove = useCallback((endpoint: 'start' | 'end') => {
    return (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Node;
      const wx = node.x(), wy = node.y();
      const excludeFromSnap = endpoint === 'start' ? effectiveSelectedLine?.fromId : effectiveSelectedLine?.toId;
      const snap = findNearestSnap(wx, wy, excludeFromSnap);
      if (snap) { node.x(snap.x); node.y(snap.y); snapCandidateRef.current = snap; setSnapHighlight({ x: snap.x, y: snap.y }); }
      else { snapCandidateRef.current = null; setSnapHighlight(null); }
      if (effectiveSelectedLine) {
        const fx = snap ? snap.x : wx, fy = snap ? snap.y : wy;
        const line = effectiveSelectedLine;
        const override: LineOverride = endpoint === 'start'
          ? { x: fx, y: fy, width: (line.x + line.width) - fx, height: (line.y + line.height) - fy, waypoints: [] }
          : { x: line.x, y: line.y, width: fx - line.x, height: fy - line.y, waypoints: [] };
        setLineOverrides(prev => ({ ...prev, [line.id]: override }));
      }
    };
  }, [findNearestSnap, effectiveSelectedLine]);

  const makeEndpointDragEnd = useCallback((endpoint: 'start' | 'end') => {
    return (e: Konva.KonvaEventObject<DragEvent>) => {
      if (selectedLine) onDragEnd?.([selectedLine.id]);
      setIsDraggingEndpoint(false);
      setIsDraggingNode(false);
      setSnapHighlight(null);
      const node = e.target as Konva.Node;
      const wx = node.x(), wy = node.y();
      const snap = snapCandidateRef.current;
      snapCandidateRef.current = null;
      if (!selectedLine) { setLineOverrides({}); return; }
      const fx = snap ? snap.x : wx, fy = snap ? snap.y : wy;
      const oldEndX = selectedLine.x + selectedLine.width, oldEndY = selectedLine.y + selectedLine.height;
      let newX = selectedLine.x, newY = selectedLine.y, newW = selectedLine.width, newH = selectedLine.height;
      let newFromId = selectedLine.fromId, newFromPoint = selectedLine.fromPoint;
      let newToId = selectedLine.toId, newToPoint = selectedLine.toPoint;
      if (endpoint === 'start') {
        newX = fx; newY = fy; newW = oldEndX - fx; newH = oldEndY - fy;
        if (snap) { newFromId = snap.shapeId; newFromPoint = snap.pointId; } else { newFromId = undefined; newFromPoint = undefined; }
      } else {
        newW = fx - selectedLine.x; newH = fy - selectedLine.y;
        if (snap) { newToId = snap.shapeId; newToPoint = snap.pointId; } else { newToId = undefined; newToPoint = undefined; }
      }
      let waypoints: Waypoint[] = selectedLine.waypoints ?? [];
      if (newFromId && newFromPoint && newToId && newToPoint) {
        const fromShape = objects.find(o => o.id === newFromId);
        const toShape = objects.find(o => o.id === newToId);
        if (fromShape && toShape) {
          const fromPt = getConnectionPointById(fromShape, newFromPoint);
          const toPt = getConnectionPointById(toShape, newToPoint);
          if (fromPt && toPt) { waypoints = routeOrthogonal(fromPt, fromPt.direction, toPt, toPt.direction, objects, [newFromId, newToId, selectedLine.id]); }
        }
      } else { waypoints = []; }
      onObjectUpdate(selectedLine.id, { x: newX, y: newY, width: newW, height: newH, fromId: newFromId, fromPoint: newFromPoint, toId: newToId, toPoint: newToPoint, waypoints });
      setLineOverrides({});
    };
  }, [selectedLine, objects, onObjectUpdate, onDragEnd]);

  const handleMidpointClick = useCallback((segmentIndex: number, mx: number, my: number) => {
    if (!selectedLine) return;
    const newWps = [...(selectedLine.waypoints ?? [])];
    newWps.splice(segmentIndex, 0, { x: mx, y: my });
    onObjectUpdate(selectedLine.id, { waypoints: newWps });
  }, [selectedLine, onObjectUpdate]);

  const handleWaypointDragEnd = useCallback((wpIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
    if (!selectedLine) return;
    const node = e.target as Konva.Node;
    const newWps = [...(selectedLine.waypoints ?? [])];
    newWps[wpIndex] = { x: node.x(), y: node.y() };
    onObjectUpdate(selectedLine.id, { waypoints: newWps });
    setLineOverrides({});
  }, [selectedLine, onObjectUpdate]);

  const renderLineHandles = () => {
    if (!effectiveSelectedLine) return null;
    const line = effectiveSelectedLine;
    const allPts = buildLinePointObjects(line);
    const startX = line.x, startY = line.y;
    const endX = line.x + line.width, endY = line.y + line.height;
    const isStartConnected = !!line.fromId, isEndConnected = !!line.toId;
    return (
      <>
        {allPts.slice(0, -1).map((pt, i) => {
          const next = allPts[i + 1];
          const mx = (pt.x + next.x) / 2, my = (pt.y + next.y) / 2;
          return (
            <KonvaRect key={`mid-${i}`} x={mx - 7} y={my - 7} width={14} height={14} cornerRadius={3}
              fill="rgba(66, 133, 244, 0.35)" stroke="#4285f4" strokeWidth={1.5}
              onClick={() => handleMidpointClick(i, mx, my)} onTap={() => handleMidpointClick(i, mx, my)} />
          );
        })}
        {(line.waypoints ?? []).map((wp, i) => (
          <KonvaCircle key={`wp-${i}`} x={wp.x} y={wp.y} radius={6} fill="#4285f4" stroke="white" strokeWidth={2}
            draggable onDragEnd={(e) => handleWaypointDragEnd(i, e)} />
        ))}
        <KonvaCircle key="ep-start" x={startX} y={startY} radius={8}
          fill={isStartConnected ? '#ff6b00' : 'white'} stroke="#4285f4" strokeWidth={2.5} draggable
          onMouseDown={() => { draggingEndpointRef.current = 'start'; setIsDraggingEndpoint(true); setIsDraggingNode(true); setHoveredShapeId(null); if (effectiveSelectedLine) onDragStart?.([effectiveSelectedLine.id]); }}
          onDragMove={makeEndpointDragMove('start')} onDragEnd={makeEndpointDragEnd('start')} />
        <KonvaCircle key="ep-end" x={endX} y={endY} radius={8}
          fill={isEndConnected ? '#ff6b00' : 'white'} stroke="#4285f4" strokeWidth={2.5} draggable
          onMouseDown={() => { draggingEndpointRef.current = 'end'; setIsDraggingEndpoint(true); setIsDraggingNode(true); setHoveredShapeId(null); if (effectiveSelectedLine) onDragStart?.([effectiveSelectedLine.id]); }}
          onDragMove={makeEndpointDragMove('end')} onDragEnd={makeEndpointDragEnd('end')} />
      </>
    );
  };

  // Compute marquee rect in world coordinates for rendering
  const marqueeRect = marqueeStart && marqueeEnd ? {
    x: Math.min(marqueeStart.x, marqueeEnd.x),
    y: Math.min(marqueeStart.y, marqueeEnd.y),
    width: Math.abs(marqueeEnd.x - marqueeStart.x),
    height: Math.abs(marqueeEnd.y - marqueeStart.y),
  } : null;

  // Bounding box for multi-select: dashed box around all selected shapes
  const multiSelectBounds = useMemo(() => {
    if (selectedObjectIds.length <= 1) return null;
    const selected = objects.filter((o) => selectedObjectIds.includes(o.id));
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach((obj) => {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [objects, selectedObjectIds]);

  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: isDraggingShapeFromSidebar ? 'none' : 'auto', cursor: canvasMode === 'grab' ? (isGrabPanning ? 'grabbing' : 'grab') : canvasMode === 'pen' ? 'crosshair' : canvasMode === 'eraser' ? 'none' : undefined }}>
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
      <Layer onDragMove={handleLayerDragMove} onDragEnd={handleLayerDragEnd}>
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
        {visibleObjects
          .filter((obj) => !selectedObjectIds.includes(obj.id))
          .sort((a, b) => {
            if (a.type === 'frame' && b.type !== 'frame') return -1;
            if (a.type !== 'frame' && b.type === 'frame') return 1;
            return (a.zIndex ?? 0) - (b.zIndex ?? 0);
          })
          .map((obj) => {
            const remoteXform = remoteTransformByObjectId[obj.id];
            const remoteEdit = remoteEditingByObjectId[obj.id];
            const displayObj = remoteXform
              ? { ...obj, x: remoteXform.x, y: remoteXform.y, width: remoteXform.width, height: remoteXform.height, rotation: remoteXform.rotation }
              : (lineOverrides[obj.id] && obj.type === 'line' ? { ...obj, ...lineOverrides[obj.id] } : obj);
            const commonProps = {
              key: obj.id,
              object: displayObj,
              isSelected: false as const,
              onSelect: (additive: boolean) => onSelectObject(obj.id, additive),
              onDragStart: () => handleObjectDragStart(obj.id),
              onUpdate: (updates: Partial<BoardObject>) => onObjectUpdate(obj.id, updates),
              onDoubleClick: () => onObjectDoubleClick?.(obj),
              onRightClick: (screenX: number, screenY: number) => onObjectRightClick?.(obj, { x: screenX, y: screenY }),
              onDragMove: makeDragMoveHandler(obj),
              onDragEndExtra: handleDragEndExtra,
              remoteTransform: remoteXform,
            };
            switch (obj.type) {
              case 'sticky':
                return <StickyNote {...commonProps} remoteEditing={remoteEdit} />;
              case 'text':
                return <TextElement {...commonProps} remoteEditing={remoteEdit} />;
              case 'circle':
                return <Circle {...commonProps} />;
              case 'triangle':
                return <Triangle {...commonProps} />;
              case 'star':
                return <StarShape {...commonProps} />;
              case 'line':
                return <LineShape {...commonProps} object={displayObj} />;
              case 'frame':
                return <Frame {...commonProps} />;
              case 'pen':
                return <PenStroke {...commonProps} />;
              default:
                return <Rectangle {...commonProps} />;
            }
          })}
        {/* Render selected objects; Transformer only when exactly one selected */}
        {selectedObjectIds.length > 0 &&
          visibleObjects
            .filter((obj) => selectedObjectIds.includes(obj.id))
            .sort((a, b) => {
              if (a.type === 'frame' && b.type !== 'frame') return -1;
              if (a.type !== 'frame' && b.type === 'frame') return 1;
              return (a.zIndex ?? 0) - (b.zIndex ?? 0);
            })
            .map((obj) => {
              const remoteXform = remoteTransformByObjectId[obj.id];
              const remoteEdit = remoteEditingByObjectId[obj.id];
              const rawDisplay =
                liveTransform != null
                  ? { ...obj, x: liveTransform.x, y: liveTransform.y, rotation: liveTransform.rotation, width: liveTransform.width, height: liveTransform.height }
                  : remoteXform != null
                    ? { ...obj, x: remoteXform.x, y: remoteXform.y, width: remoteXform.width, height: remoteXform.height, rotation: remoteXform.rotation }
                    : (lineOverrides[obj.id] && obj.type === 'line' ? { ...obj, ...lineOverrides[obj.id] } : obj);
              const displayObject = coerceDisplayObject(rawDisplay, obj);
              const updateHandler = (updates: Partial<BoardObject>) => {
                if (updates.x !== undefined && updates.y !== undefined && selectedObjectIds.length > 1) {
                  handleObjectDragEnd(obj.id, updates.x, updates.y);
                } else {
                  onObjectUpdate(obj.id, updates);
                }
              };
              const selectedCommon = {
                object: displayObject,
                isSelected: true as const,
                onSelect: (additive: boolean) => onSelectObject(obj.id, additive),
                onDragStart: () => handleObjectDragStart(obj.id),
                onUpdate: updateHandler,
                onDoubleClick: () => onObjectDoubleClick?.(obj),
                onRightClick: (screenX: number, screenY: number) => onObjectRightClick?.(obj, { x: screenX, y: screenY }),
                onDragMove: makeDragMoveHandler(obj),
                onDragEndExtra: handleDragEndExtra,
                remoteTransform: remoteXform,
              };
              return (
              <React.Fragment key={obj.id}>
                {(() => {
                  switch (obj.type) {
                    case 'sticky':
                      return <StickyNote {...selectedCommon} remoteEditing={remoteEdit} />;
                    case 'text':
                      return <TextElement {...selectedCommon} remoteEditing={remoteEdit} />;
                    case 'circle':
                      return <Circle {...selectedCommon} />;
                    case 'triangle':
                      return <Triangle {...selectedCommon} />;
                    case 'star':
                      return <StarShape {...selectedCommon} />;
                    case 'line':
                      return <LineShape {...selectedCommon} object={displayObject} />;
                    case 'frame':
                      return <Frame {...selectedCommon} />;
                    case 'pen':
                      return <PenStroke {...selectedCommon} />;
                    default:
                      return <Rectangle {...selectedCommon} />;
                  }
                })()}
              </React.Fragment>
              );
            })}
        {/* In-progress pen stroke */}
        {drawingPoints && drawingOriginState && (
          <KonvaLine
            x={drawingOriginState.x}
            y={drawingOriginState.y}
            points={drawingPoints}
            stroke={penColor}
            strokeWidth={penStrokeWidthProp}
            lineCap="round"
            lineJoin="round"
            tension={0}
            listening={false}
          />
        )}
        {/* Eraser cursor visual */}
        {canvasMode === 'eraser' && eraserPos && (
          <KonvaCircle
            x={eraserPos.x}
            y={eraserPos.y}
            radius={12}
            fill="rgba(255,255,255,0.6)"
            stroke="#888"
            strokeWidth={1.5}
            listening={false}
          />
        )}
        {/* Transformer is always rendered (never conditionally unmounted) to avoid Konva state issues when selection changes during blur/click transitions */}
        {(() => {
          const singleObj = selectedObjectIds.length === 1 ? objects.find((o) => o.id === selectedObjectIds[0]) : null;
          return (
            <>
              <Transformer
                ref={transformerRef}
                keepRatio={selectedObjectIds.length > 1 ? true : !isAltDown}
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
                rotateAnchorAngle={45}
                rotateAnchorOffset={24}
                boundBoxFunc={(oldBox, newBox) => {
                  const minSize = singleObj?.type === 'frame' ? 100 : singleObj?.type === 'line' ? 0 : MIN_OBJECT_SIZE;
                  if (newBox.width < minSize || newBox.height < minSize) return oldBox;
                  return newBox;
                }}
                onTransformStart={() => {
                  isTransformingRef.current = true;
                  if (selectedObjectIds.length === 1) transformingObjectIdRef.current = selectedObjectIds[0];
                  const activeAnchor = transformerRef.current?.getActiveAnchor?.() ?? null;
                  if (activeAnchor === 'rotater') {
                    isRotatingGestureRef.current = true;
                  } else {
                    isRotatingGestureRef.current = false;
                  }
                }}
                onTransform={(e) => {
                  try {
                    const transformer = transformerRef.current;
                    const nodes = transformer?.nodes() ?? [];
                    const currentObjects = objectsRef.current;
                    if (selectedObjectIds.length > 1 && nodes.length > 1) {
                      const selectedSet = new Set(selectedObjectIds);
                      const map = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();
                      const virtualById = new Map<string, BoardObject>();
                      const n = (v: number, def: number) => (Number.isFinite(v) ? v : def);
                      nodes.forEach((node: Konva.Node) => {
                        const id = node.id?.();
                        if (!id) return;
                        const obj = currentObjects.find((o) => o.id === id);
                        if (!obj) return;
                        let w = node.width();
                        let h = node.height();
                        if (!Number.isFinite(w) || w <= 0) w = obj.width;
                        if (!Number.isFinite(h) || h <= 0) h = obj.height;
                        const sx = node.scaleX?.() ?? 1;
                        const sy = node.scaleY?.() ?? 1;
                        const minSize = obj.type === 'line' ? 0 : MIN_OBJECT_SIZE;
                        const data = {
                          x: n(node.x(), obj.x),
                          y: n(node.y(), obj.y),
                          width: Math.max(minSize, w * sx),
                          height: Math.max(minSize, h * sy),
                          rotation: n(node.rotation?.() ?? 0, obj.rotation ?? 0),
                        };
                        map.set(id, data);
                        virtualById.set(id, { ...obj, ...data });
                      });
                    multiSelectDisplayRef.current = map;
                    const getVirtual = (id: string): BoardObject | undefined =>
                      virtualById.get(id) ?? currentObjects.find((o) => o.id === id);
                    const connectedLines = currentObjects.filter(
                      (o) =>
                        o.type === 'line' &&
                        ((o.fromId != null && selectedSet.has(o.fromId)) || (o.toId != null && selectedSet.has(o.toId))),
                    );
                    const overrides: Record<string, LineOverride> = {};
                    for (const line of connectedLines) {
                      const fromShape = line.fromId ? getVirtual(line.fromId) : null;
                      const toShape = line.toId ? getVirtual(line.toId) : null;
                      let startPt = { x: line.x, y: line.y };
                      let endPt = { x: line.x + line.width, y: line.y + line.height };
                      if (line.fromId && line.fromPoint && fromShape) {
                        const cp = getConnectionPointById(fromShape, line.fromPoint);
                        if (cp) {
                          startPt = cp;
                        }
                      }
                      if (line.toId && line.toPoint && toShape) {
                        const cp = getConnectionPointById(toShape, line.toPoint);
                        if (cp) {
                          endPt = cp;
                        }
                      }
                      const oldStart = { x: line.x, y: line.y };
                      const oldEnd = { x: line.x + line.width, y: line.y + line.height };
                      const hasWaypoints = (line.waypoints?.length ?? 0) > 0;
                      const waypoints = hasWaypoints
                        ? preserveWaypointBend(line.waypoints!, oldStart, oldEnd, startPt, endPt)
                        : [];
                      overrides[line.id] = {
                        x: startPt.x,
                        y: startPt.y,
                        width: endPt.x - startPt.x,
                        height: endPt.y - startPt.y,
                        waypoints,
                      };
                    }
                    setLineOverrides((prev) => ({ ...prev, ...overrides }));
                    return;
                  }
                  if (selectedObjectIds.length !== 1) return;
                  const node = e.target;
                  const id = node.id?.();
                  const obj = id ? currentObjects.find((o) => o.id === id) : null;
                  if (!obj) {
                    liveTransformRef.current = null;
                    onLiveTransformChange?.(null);
                    return;
                  }
                  const currentRotation = node.rotation();
                  if (Math.abs(currentRotation - lastRotationRef.current) > 0.1) {
                    isRotatingGestureRef.current = true;
                  }
                  lastRotationRef.current = currentRotation;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  const baseW = Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 100;
                  const baseH = Number.isFinite(obj.height) && obj.height > 0 ? obj.height : 100;
                  const fallback = {
                    x: obj.x,
                    y: obj.y,
                    width: baseW,
                    height: baseH,
                    rotation: obj.rotation ?? 0,
                  };
                  const liveValues = sanitizeTransform(
                    node.x(),
                    node.y(),
                    Math.max(MIN_OBJECT_SIZE, baseW * scaleX),
                    Math.max(MIN_OBJECT_SIZE, baseH * scaleY),
                    currentRotation,
                    fallback,
                  );
                  liveTransformRef.current = liveValues;
                  if (!transformFlushScheduledRef.current) {
                    transformFlushScheduledRef.current = true;
                    requestAnimationFrame(() => {
                      transformFlushScheduledRef.current = false;
                      const current = liveTransformRef.current;
                      const shapeId = transformingObjectIdRef.current;
                      if (current && shapeId) {
                        setLiveTransform({ ...current });
                        onLiveTransformChange?.(current);
                        onBroadcastTransform?.(shapeId, current.x, current.y, current.width, current.height, current.rotation);
                        // Keep connected lines in sync during transform (no lag)
                        const currentObjects = objectsRef.current;
                        const shape = currentObjects.find((o) => o.id === shapeId);
                        if (shape && shape.type !== 'line') {
                          const virtualShape: BoardObject = { ...shape, ...current };
                          const connectedLines = currentObjects.filter(
                            (o) => o.type === 'line' && (o.fromId === shapeId || o.toId === shapeId),
                          );
                          if (connectedLines.length > 0) {
                            const overrides: Record<string, LineOverride> = {};
                            for (const line of connectedLines) {
                              const fromShape = line.fromId === shapeId ? virtualShape : currentObjects.find((o) => o.id === line.fromId);
                              const toShape = line.toId === shapeId ? virtualShape : currentObjects.find((o) => o.id === line.toId);
                              let startPt = { x: line.x, y: line.y };
                              let endPt = { x: line.x + line.width, y: line.y + line.height };
                              if (line.fromId && line.fromPoint && fromShape) {
                                const cp = getConnectionPointById(fromShape, line.fromPoint);
                                if (cp) startPt = cp;
                              }
                              if (line.toId && line.toPoint && toShape) {
                                const cp = getConnectionPointById(toShape, line.toPoint);
                                if (cp) endPt = cp;
                              }
                              const oldStart = { x: line.x, y: line.y };
                              const oldEnd = { x: line.x + line.width, y: line.y + line.height };
                              const waypoints = (line.waypoints?.length ?? 0) > 0
                                ? preserveWaypointBend(line.waypoints!, oldStart, oldEnd, startPt, endPt)
                                : [];
                              overrides[line.id] = { x: startPt.x, y: startPt.y, width: endPt.x - startPt.x, height: endPt.y - startPt.y, waypoints };
                            }
                            setLineOverrides((prev) => ({ ...prev, ...overrides }));
                          }
                        }
                      }
                    });
                  }
                  } catch (err) {
                    console.error('Canvas onTransform error:', err);
                    liveTransformRef.current = null;
                    onLiveTransformChange?.(null);
                  }
                }}
                onTransformEnd={() => {
                  try {
                    const transformer = transformerRef.current;
                    const nodes = transformer?.nodes() ?? [];
                    const currentObjects = objectsRef.current;
                    if (nodes.length === 0) return;

                    if (nodes.length === 1) {
                      const node = nodes[0];
                      const obj = currentObjects.find((o) => o.id === node.id());
                      if (!obj) {
                        isTransformingRef.current = false;
                        transformingObjectIdRef.current = null;
                        liveTransformRef.current = null;
                        setLiveTransform(null);
                        onLiveTransformChange?.(null);
                        onClearTransform?.();
                        return;
                      }
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    const rawX = node.x();
                    const rawY = node.y();
                    const rawRot = node.rotation();
                    let newX: number;
                    let newY: number;
                    let newWidth: number;
                    let newHeight: number;
                    let newRot: number;
                    if (obj.type === 'line') {
                      const n = (v: number, d: number) => (Number.isFinite(v) ? v : d);
                      newX = n(rawX, obj.x);
                      newY = n(rawY, obj.y);
                      newWidth = Math.max(0, n(obj.width * scaleX, obj.width));
                      newHeight = Math.max(0, n(obj.height * scaleY, obj.height));
                      newRot = n(rawRot, obj.rotation ?? 0);
                    } else {
                      const rawW = Math.max(MIN_OBJECT_SIZE, obj.width * scaleX);
                      const rawH = Math.max(MIN_OBJECT_SIZE, obj.height * scaleY);
                      const fallback = { x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation ?? 0 };
                      const out = sanitizeTransform(rawX, rawY, rawW, rawH, rawRot, fallback);
                      newX = out.x;
                      newY = out.y;
                      newWidth = out.width;
                      newHeight = out.height;
                      newRot = out.rotation;
                    }
                    onObjectUpdate(obj.id, { x: newX, y: newY, width: newWidth, height: newHeight, rotation: newRot });
                    if (obj.type !== 'line') {
                      updateConnectedLines(obj.id, newX, newY, newWidth, newHeight, newRot);
                    }
                    setLineOverrides({});
                  } else {
                    const changes: { id: string; updates: Partial<BoardObject> }[] = [];
                    const n = (v: number, d: number) => (Number.isFinite(v) ? v : d);
                    nodes.forEach((node: Konva.Node) => {
                      const id = node.id();
                      const obj = currentObjects.find((o) => o.id === id);
                      if (!obj) return;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      const rx = node.x();
                      const ry = node.y();
                      const rrot = node.rotation();
                      if (obj.type === 'line') {
                        const rawW = Math.max(0, n(obj.width * scaleX, obj.width));
                        const rawH = Math.max(0, n(obj.height * scaleY, obj.height));
                        changes.push({
                          id,
                          updates: {
                            x: n(rx, obj.x),
                            y: n(ry, obj.y),
                            width: rawW,
                            height: rawH,
                            rotation: n(rrot, obj.rotation ?? 0),
                          },
                        });
                      } else {
                        const rawW = Math.max(MIN_OBJECT_SIZE, obj.width * scaleX);
                        const rawH = Math.max(MIN_OBJECT_SIZE, obj.height * scaleY);
                        const fallback = { x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation ?? 0 };
                        const { x, y, width, height, rotation } = sanitizeTransform(rx, ry, rawW, rawH, rrot, fallback);
                        changes.push({ id, updates: { x, y, width, height, rotation } });
                      }
                    });
                    const shapeUpdates = changes.map((c) => ({
                      id: c.id,
                      x: c.updates.x!,
                      y: c.updates.y!,
                      width: c.updates.width!,
                      height: c.updates.height!,
                      rotation: c.updates.rotation!,
                    }));
                    const lineUpdates = computeConnectedLineUpdates(shapeUpdates, currentObjects);
                    changes.push(...lineUpdates);
                    if (changes.length > 0 && onBatchObjectUpdate) onBatchObjectUpdate(changes);
                    setLineOverrides({});
                    multiSelectDisplayRef.current.clear();
                  }

                    isTransformingRef.current = false;
                    transformingObjectIdRef.current = null;
                    liveTransformRef.current = null;
                    setLiveTransform(null);
                    onLiveTransformChange?.(null);
                    isRotatingGestureRef.current = false;
                    if (nodes.length === 1) lastRotationRef.current = nodes[0].rotation();
                    onClearTransform?.();
                  } catch (err) {
                    console.error('Canvas onTransformEnd error:', err);
                    isTransformingRef.current = false;
                    transformingObjectIdRef.current = null;
                    liveTransformRef.current = null;
                    setLiveTransform(null);
                    onLiveTransformChange?.(null);
                    isRotatingGestureRef.current = false;
                    onClearTransform?.();
                  }
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
            </>
          );
        })()}
        {/* Draggable overlay for multi-select marquee — hit area inset to avoid blocking Transformer anchors */}
        {selectedObjectIds.length > 1 && multiSelectBounds && (
          <KonvaRect
            id="multi-select-drag-rect"
            x={multiSelectBounds.x}
            y={multiSelectBounds.y}
            width={multiSelectBounds.width}
            height={multiSelectBounds.height}
            fill="transparent"
            listening
            draggable
            hitFunc={(context, shape) => {
              const inset = 12;
              const w = shape.width();
              const h = shape.height();
              if (w <= 2 * inset || h <= 2 * inset) return;
              context.beginPath();
              context.rect(inset, inset, w - 2 * inset, h - 2 * inset);
              context.closePath();
              context.fillStrokeShape(shape);
            }}
            onDragStart={handleMultiSelectMarqueeDragStart}
            onDragMove={handleMultiSelectMarqueeDragMove}
            onDragEnd={handleMultiSelectMarqueeDragEnd}
          />
        )}
        {/* Custom handles for selected line */}
        {renderLineHandles()}
        {/* Drawing connection line (visual feedback while dragging from X) */}
        {drawingConnection && (
          <KonvaLine
            points={[drawingConnection.fromX, drawingConnection.fromY, drawingConnection.toX, drawingConnection.toY]}
            stroke="#4285f4"
            strokeWidth={2}
            dash={[8, 4]}
            lineCap="round"
            listening={false}
          />
        )}
        {/* Connection-point X overlays — use display object so X's stick during drag/transform */}
        {visibleObjects.filter(o => o.type !== 'frame').map(o => {
          const showXs = (hoveredShapeId === o.id || drawingConnection !== null) && !isDraggingNode;
          if (!showXs) return null;
          const isSelected = selectedObjectIds.includes(o.id);
          const remoteXform = remoteTransformByObjectId[o.id];
          const rawDisplay =
            isSelected && selectedObjectIds.length === 1 && liveTransform != null
              ? { ...o, ...liveTransform }
              : isSelected && selectedObjectIds.length > 1
                ? (() => {
                    const fromRef = multiSelectDisplayRef.current.get(o.id);
                    return fromRef ? { ...o, ...fromRef } : o;
                  })()
                : remoteXform != null
                  ? { ...o, x: remoteXform.x, y: remoteXform.y, width: remoteXform.width, height: remoteXform.height, rotation: remoteXform.rotation }
                  : o;
          const displayObject = coerceDisplayObject(rawDisplay, o);
          return (
            <ConnectionPoints
              key={`cp-${o.id}`}
              object={displayObject}
              activeSourcePointId={drawingConnection?.fromShapeId === o.id ? drawingConnection.fromPointId : null}
              hasActiveConnection={drawingConnection !== null}
              ignorePointer={isDraggingEndpoint}
              onConnectionDragStart={handleConnectionDragStart}
              onConnectionDragEnd={handleConnectionDragEnd}
              onDetachConnection={handleDetachConnection}
            />
          );
        })}
        {/* Snap highlight ring */}
        {snapHighlight && (
          <KonvaCircle x={snapHighlight.x} y={snapHighlight.y} radius={12}
            fill="rgba(255, 107, 0, 0.18)" stroke="#ff6b00" strokeWidth={2} listening={false} />
        )}
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
