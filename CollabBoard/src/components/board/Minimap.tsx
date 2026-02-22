import { useState, useMemo, useCallback, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { BoardObject, CursorData } from '../../types';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 50; // world-unit padding around objects
const DEFAULT_WORLD_SIZE = 2000; // fallback for empty boards

interface MinimapProps {
  objects: BoardObject[];
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
  setPosition: (x: number, y: number) => void;
  containerWidth: number;
  containerHeight: number;
  remoteCursors: Record<string, CursorData>;
}

function computeWorldBounds(objects: BoardObject[]) {
  if (objects.length === 0) {
    return {
      minX: -DEFAULT_WORLD_SIZE / 2,
      minY: -DEFAULT_WORLD_SIZE / 2,
      maxX: DEFAULT_WORLD_SIZE / 2,
      maxY: DEFAULT_WORLD_SIZE / 2,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const x = obj.x ?? 0;
    const y = obj.y ?? 0;
    const w = obj.width ?? 0;
    const h = obj.height ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  // Add padding
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  // Ensure minimum size
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 200) {
    const cx = (minX + maxX) / 2;
    minX = cx - 100;
    maxX = cx + 100;
  }
  if (height < 150) {
    const cy = (minY + maxY) / 2;
    minY = cy - 75;
    maxY = cy + 75;
  }

  return { minX, minY, maxX, maxY };
}

export function Minimap({
  objects,
  viewport,
  setPosition,
  containerWidth,
  containerHeight,
  remoteCursors,
}: MinimapProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isDraggingRef = useRef(false);

  const worldBounds = useMemo(() => computeWorldBounds(objects), [objects]);

  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const worldHeight = worldBounds.maxY - worldBounds.minY;

  // Fit world into minimap, maintaining aspect ratio
  const scaleX = MINIMAP_WIDTH / worldWidth;
  const scaleY = MINIMAP_HEIGHT / worldHeight;
  const minimapScale = Math.min(scaleX, scaleY);

  // Offset to center content in minimap
  const offsetX = (MINIMAP_WIDTH - worldWidth * minimapScale) / 2;
  const offsetY = (MINIMAP_HEIGHT - worldHeight * minimapScale) / 2;

  // Convert world coord to minimap coord
  const toMinimapX = useCallback(
    (wx: number) => (wx - worldBounds.minX) * minimapScale + offsetX,
    [worldBounds.minX, minimapScale, offsetX]
  );
  const toMinimapY = useCallback(
    (wy: number) => (wy - worldBounds.minY) * minimapScale + offsetY,
    [worldBounds.minY, minimapScale, offsetY]
  );

  // Viewport rect in minimap coords
  const vpWorldX = -viewport.x / viewport.scaleX;
  const vpWorldY = -viewport.y / viewport.scaleY;
  const vpWorldW = containerWidth / viewport.scaleX;
  const vpWorldH = containerHeight / viewport.scaleY;

  const vpRectX = toMinimapX(vpWorldX);
  const vpRectY = toMinimapY(vpWorldY);
  const vpRectW = vpWorldW * minimapScale;
  const vpRectH = vpWorldH * minimapScale;

  // Click-to-navigate: center viewport on clicked world position
  const handleMinimapClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (isDraggingRef.current) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const worldX = (pos.x - offsetX) / minimapScale + worldBounds.minX;
      const worldY = (pos.y - offsetY) / minimapScale + worldBounds.minY;

      setPosition(
        -worldX * viewport.scaleX + containerWidth / 2,
        -worldY * viewport.scaleY + containerHeight / 2
      );
    },
    [offsetX, offsetY, minimapScale, worldBounds, setPosition, viewport.scaleX, viewport.scaleY, containerWidth, containerHeight]
  );

  // Drag-to-navigate on viewport rect
  const handleViewportDrag = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      isDraggingRef.current = true;
      const node = e.target;
      const newX = node.x();
      const newY = node.y();

      const worldX = (newX - offsetX) / minimapScale + worldBounds.minX;
      const worldY = (newY - offsetY) / minimapScale + worldBounds.minY;

      setPosition(
        -worldX * viewport.scaleX,
        -worldY * viewport.scaleY
      );
    },
    [offsetX, offsetY, minimapScale, worldBounds, setPosition, viewport.scaleX, viewport.scaleY]
  );

  const handleViewportDragEnd = useCallback(() => {
    // Small delay so the click handler doesn't fire right after drag
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  if (collapsed) {
    return (
      <div className="minimap-container minimap-collapsed">
        <button
          className="minimap-toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Expand minimap"
          title="Expand minimap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="minimap-container">
      <button
        className="minimap-toggle"
        onClick={() => setCollapsed(true)}
        aria-label="Collapse minimap"
        title="Collapse minimap"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <Stage
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleMinimapClick}
        style={{ display: 'block' }}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            fill="#f8f8f8"
            listening={false}
          />

          {/* Object previews */}
          {objects.map((obj) => {
            const mx = toMinimapX(obj.x);
            const my = toMinimapY(obj.y);
            const mw = obj.width * minimapScale;
            const mh = obj.height * minimapScale;

            if (obj.type === 'circle') {
              const radius = Math.max(mw, mh) / 2;
              return (
                <Circle
                  key={obj.id}
                  x={mx + mw / 2}
                  y={my + mh / 2}
                  radius={Math.max(radius, 1)}
                  fill={obj.color || '#ccc'}
                  listening={false}
                />
              );
            }

            if (obj.type === 'line') {
              // Render lines as simple lines from top-left to bottom-right
              return (
                <Line
                  key={obj.id}
                  points={[mx, my, mx + mw, my + mh]}
                  stroke={obj.strokeColor || obj.color || '#666'}
                  strokeWidth={1}
                  listening={false}
                />
              );
            }

            if (obj.type === 'triangle') {
              return (
                <Line
                  key={obj.id}
                  points={[
                    mx + mw / 2, my,
                    mx + mw, my + mh,
                    mx, my + mh,
                  ]}
                  closed
                  fill={obj.color || '#ccc'}
                  listening={false}
                />
              );
            }

            if (obj.type === 'star') {
              return (
                <Circle
                  key={obj.id}
                  x={mx + mw / 2}
                  y={my + mh / 2}
                  radius={Math.max(Math.min(mw, mh) / 2, 1)}
                  fill={obj.color || '#ccc'}
                  listening={false}
                />
              );
            }

            // sticky, rectangle, text, frame — render as rects
            const isFrame = obj.type === 'frame';
            return (
              <Rect
                key={obj.id}
                x={mx}
                y={my}
                width={Math.max(mw, 1)}
                height={Math.max(mh, 1)}
                fill={isFrame ? undefined : (obj.color || '#ccc')}
                stroke={isFrame ? (obj.color || '#999') : undefined}
                strokeWidth={isFrame ? 1 : 0}
                listening={false}
              />
            );
          })}

          {/* Remote cursor dots */}
          {Object.entries(remoteCursors).map(([userId, cursor]) => (
            <Circle
              key={`cursor-${userId}`}
              x={toMinimapX(cursor.x)}
              y={toMinimapY(cursor.y)}
              radius={3}
              fill={cursor.color || '#666'}
              listening={false}
            />
          ))}

          {/* Viewport indicator */}
          <Rect
            x={vpRectX}
            y={vpRectY}
            width={vpRectW}
            height={vpRectH}
            fill="rgba(59, 130, 246, 0.12)"
            stroke="rgba(59, 130, 246, 0.7)"
            strokeWidth={1.5}
            draggable
            onDragMove={handleViewportDrag}
            onDragEnd={handleViewportDragEnd}
          />
        </Layer>
      </Stage>
    </div>
  );
}
