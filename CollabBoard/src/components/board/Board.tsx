import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { TextEditor } from './TextEditor';
import { PresenceBar } from './PresenceBar';
import { ShapeSidebar } from './ShapeSidebar';
import { UndoRedoClearPanel } from './UndoRedoClearPanel';
import { StyleBar } from './StyleBar';
import { ContextMenu } from './ContextMenu';
import { AICommandPanel } from './AICommandPanel';
import { useAuth } from '../../hooks/useAuth';
import { useBoardObjects } from '../../hooks/useBoardObjects';
import { useCursors } from '../../hooks/useCursors';
import { usePresence } from '../../hooks/usePresence';
import { useViewport } from '../../hooks/useViewport';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useLiveTransforms } from '../../hooks/useLiveTransforms';
import { useLiveEditing } from '../../hooks/useLiveEditing';
import { useSelection } from '../../hooks/useSelection';
import { onBoardMetaChange, updateBoardName } from '../../firebase/boardMeta';
import { screenToWorld, worldToScreen } from '../../utils/coordinates';
import type { BoardObject, BoardMeta, Waypoint } from '../../types';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function Board() {
  const { boardId = 'default' } = useParams();
  const { user, logout } = useAuth();
  const { objects, addObject, updateObject, batchUpdateObjects, deleteObject, clearObjects, markDragging, unmarkDragging } = useBoardObjects(boardId);
  const { cursors, updateCursor, cleanupCursor } = useCursors(boardId, user);
  const { onlineUsers, cleanupPresence } = usePresence(boardId, user, cursors);
  const { viewport, setPosition, zoomAtPoint } = useViewport(boardId);
  const { remoteTransforms, broadcastTransform, clearTransform, cleanupTransform } = useLiveTransforms(boardId, user);
  const { remoteEditings, broadcastEditing, clearEditing, cleanupEditing } = useLiveEditing(boardId, user);
  const { remoteSelectionByObject, setLocalSelection, cleanupSelection } = useSelection(boardId, user);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    objectId: string | null;
    pasteWorldX: number;
    pasteWorldY: number;
  } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastDropHandledAtRef = useRef<number>(0);
  const clipboardRef = useRef<BoardObject[]>([]);
  const [clipboardCount, setClipboardCount] = useState(0);
  const lastClickedWorldRef = useRef<{ x: number; y: number } | null>(null);
  const [liveTransform, setLiveTransform] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null>(null);
  const [editingObject, setEditingObject] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    objectType: 'sticky' | 'text' | 'frame';
  } | null>(null);
  const [shapesPanelOpen, setShapesPanelOpen] = useState(false);
  const [isDraggingShapeFromSidebar, setIsDraggingShapeFromSidebar] = useState(false);
  const [boardMeta, setBoardMeta] = useState<BoardMeta | null>(null);
  const [deleteFrameConfirm, setDeleteFrameConfirm] = useState<{
    selectedIds: string[];
    frameIds: Set<string>;
    childCount: number;
  } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  useEffect(() => {
    return onBoardMetaChange(boardId, setBoardMeta);
  }, [boardId]);

  const { pushAction, undo, redo, canUndo, canRedo } = useUndoRedo({
    addObject,
    updateObject: async (id: string, updates: Partial<BoardObject>) => {
      await updateObject(id, updates);
    },
    deleteObject,
    onApply: () => {
      setEditingObject(null);
      clearEditing();
    },
  });

  const boardDisplayName = boardMeta?.name?.trim() || 'Untitled';
  const handleBoardNameChange = useCallback(
    (name: string) => updateBoardName(boardId, name.trim() || ''),
    [boardId]
  );

  // Cursor sync: use canvas container pointermove so cursor updates even when pointer is over selected shape/Transformer
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const v = viewportRef.current;
      const worldX = (screenX - v.x) / v.scaleX;
      const worldY = (screenY - v.y) / v.scaleY;
      updateCursor(worldX, worldY);
    };

    container.addEventListener('pointermove', handlePointerMove);
    return () => container.removeEventListener('pointermove', handlePointerMove);
  }, [updateCursor]);

  const bumpZIndex = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const nonFrames = ids
        .map((id) => objects.find((o) => o.id === id))
        .filter((o): o is typeof objects[number] => !!o && o.type !== 'frame');
      if (nonFrames.length === 0) return;
      const maxZ = objects.reduce((max, o) => Math.max(max, o.zIndex ?? 0), 0);
      // Sort by current zIndex so relative stacking order is preserved after bump
      const sorted = [...nonFrames].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      const alreadyOnTop = sorted.every((o, i) => (o.zIndex ?? 0) >= maxZ + 1 + i);
      if (alreadyOnTop) return;
      sorted.forEach((obj, i) => {
        updateObject(obj.id, { zIndex: maxZ + 1 + i });
      });
    },
    [objects, updateObject]
  );

  const setSelectedWithZBump = useCallback(
    (ids: string[]) => {
      setSelectedObjectIds(ids);
      bumpZIndex(ids);
    },
    [bumpZIndex]
  );

  const selectObject = useCallback(
    (id: string, additive: boolean) => {
      if (remoteSelectionByObject[id]) return;
      let newSelectedIds: string[];
      if (additive) {
        const prev = selectedObjectIds;
        newSelectedIds = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      } else {
        const obj = objects.find((o) => o.id === id);
        if (!obj) {
          setSelectedWithZBump([id]);
          return;
        }
        if (obj.type === 'frame') {
          const childIds = objects.filter((o) => o.frameId === id).map((o) => o.id);
          newSelectedIds = [id, ...childIds];
        } else if (obj.frameId) {
          // Two-stage selection: if the parent frame is already selected (frame group is active),
          // a second click on a child selects only that child for individual manipulation.
          const frameAlreadySelected = selectedObjectIds.includes(obj.frameId);
          if (frameAlreadySelected) {
            newSelectedIds = [id];
          } else {
            const frameId = obj.frameId;
            const childIds = objects.filter((o) => o.frameId === frameId).map((o) => o.id);
            newSelectedIds = [frameId, ...childIds];
          }
        } else {
          newSelectedIds = [id];
        }
      }
      setSelectedWithZBump(newSelectedIds);
    },
    [remoteSelectionByObject, objects, selectedObjectIds, setSelectedWithZBump]
  );

  const clearSelection = useCallback(() => {
    setSelectedObjectIds([]);
    setContextMenu(null);
  }, []);

  useEffect(() => {
    setLocalSelection(selectedObjectIds.length === 1 ? selectedObjectIds[0] : null);
  }, [selectedObjectIds, setLocalSelection]);

  const selectAll = useCallback(() => {
    const lockedIds = new Set(Object.keys(remoteSelectionByObject));
    setSelectedObjectIds(objects.map((o) => o.id).filter((id) => !lockedIds.has(id)));
  }, [objects, remoteSelectionByObject]);

  console.log('📊 Board state:', {
    objectCount: objects.length,
    objects,
    viewport,
    editingObject: editingObject ? editingObject.id : null,
    remoteCursors: cursors,
    remoteCursorCount: Object.keys(cursors).length,
    selectedCount: selectedObjectIds.length,
  });

  const createObjectAtCenter = useCallback((type: 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double' | 'triangle' | 'star' | 'frame') => {
    if (!user) {
      console.error('❌ No user found - cannot create object');
      return;
    }

    console.log(`✅ User exists, creating ${type}...`);

    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = (window.innerHeight - 48) / 2;
    const { x: worldCenterX, y: worldCenterY } = screenToWorld(
      screenCenterX,
      screenCenterY,
      viewport
    );

    const id = generateId();
    let newObject: BoardObject;

    if (type === 'sticky') {
      const noteWidth = 200;
      const noteHeight = 200;
      newObject = {
        id,
        type: 'sticky',
        x: worldCenterX - (noteWidth / 2),
        y: worldCenterY - (noteHeight / 2),
        width: noteWidth,
        height: noteHeight,
        rotation: 0,
        text: '',
        color: '#FFD700',
        strokeWidth: 0,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('📝 Creating sticky note:', newObject);
    } else if (type === 'text') {
      const textWidth = 200;
      const textHeight = 40;
      newObject = {
        id,
        type: 'text',
        x: worldCenterX - (textWidth / 2),
        y: worldCenterY - (textHeight / 2),
        width: textWidth,
        height: textHeight,
        rotation: 0,
        text: '',
        color: 'transparent',
        strokeWidth: 0,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('📝 Creating text element:', newObject);
    } else if (type === 'circle') {
      const circleSize = 150;
      newObject = {
        id,
        type: 'circle',
        x: worldCenterX - (circleSize / 2),
        y: worldCenterY - (circleSize / 2),
        width: circleSize,
        height: circleSize,
        rotation: 0,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        aspectRatio: 1,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('⭕ Creating circle:', newObject);
    } else if (type === 'line' || type === 'arrow-single' || type === 'arrow-double') {
      const lineWidth = 200;
      newObject = {
        id,
        type: 'line',
        x: worldCenterX - (lineWidth / 2),
        y: worldCenterY,
        width: lineWidth,
        height: 0,
        rotation: 0,
        color: '#000000',
        strokeColor: '#000000',
        strokeWidth: 2,
        arrowType: type === 'arrow-single' ? 'single' : type === 'arrow-double' ? 'double' : 'none',
        waypoints: [],
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('📏 Creating line/arrow:', newObject);
    } else if (type === 'triangle') {
      const triWidth = 150;
      const triHeight = 130;
      newObject = {
        id,
        type: 'triangle',
        x: worldCenterX - (triWidth / 2),
        y: worldCenterY - (triHeight / 2),
        width: triWidth,
        height: triHeight,
        rotation: 0,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        aspectRatio: triWidth / triHeight,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('🔺 Creating triangle:', newObject);
    } else if (type === 'star') {
      const starSize = 150;
      newObject = {
        id,
        type: 'star',
        x: worldCenterX - (starSize / 2),
        y: worldCenterY - (starSize / 2),
        width: starSize,
        height: starSize,
        rotation: 0,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        aspectRatio: 1,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('⭐ Creating star:', newObject);
    } else if (type === 'frame') {
      const frameWidth = 300;
      const frameHeight = 200;
      const FRAME_GAP = 40;
      const existingFrameCount = objects.filter(o => o.type === 'frame').length;
      // Place new frames in a grid so they don't stack on top of each other
      const col = existingFrameCount % 4;
      const row = Math.floor(existingFrameCount / 4);
      const frameX = worldCenterX - frameWidth / 2 + col * (frameWidth + FRAME_GAP);
      const frameY = worldCenterY - frameHeight / 2 + row * (frameHeight + FRAME_GAP);
      newObject = {
        id,
        type: 'frame',
        x: frameX,
        y: frameY,
        width: frameWidth,
        height: frameHeight,
        rotation: 0,
        text: `Frame ${existingFrameCount + 1}`,
        color: '#3366ff',
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
    } else {
      const rectWidth = 200;
      const rectHeight = 150;
      newObject = {
        id,
        type: 'rectangle',
        x: worldCenterX - (rectWidth / 2),
        y: worldCenterY - (rectHeight / 2),
        width: rectWidth,
        height: rectHeight,
        rotation: 0,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        aspectRatio: rectWidth / rectHeight,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('🟦 Creating rectangle:', newObject);
    }

    addObject(newObject)
      .then(() => {
        console.log(`✅ ${type} added to Firestore successfully`);
        setSelectedObjectIds([id]);
        pushAction({ type: 'add', objects: [newObject] });
        if (type === 'frame') {
          const fx = newObject.x;
          const fy = newObject.y;
          const fRight = newObject.x + newObject.width;
          const fBottom = newObject.y + newObject.height;
          const contained = objects.filter(
            (o) =>
              o.id !== newObject.id &&
              o.type !== 'frame' &&
              o.x >= fx &&
              o.y >= fy &&
              (o.x + (o.width ?? 0)) <= fRight &&
              (o.y + (o.height ?? 0)) <= fBottom
          );
          contained.forEach((o) => {
            pushAction({ type: 'update', changes: [{ id: o.id, before: { frameId: o.frameId }, after: { frameId: newObject.id } }] });
            updateObject(o.id, { frameId: newObject.id });
          });
        }
      })
      .catch((err) => {
        console.error(`❌ Failed to add ${type} to Firestore:`, err);
      });
  }, [addObject, user, viewport, pushAction, objects, updateObject]);

  const handleCanvasClick = useCallback(() => {
    setContextMenu(null);
    setShapesPanelOpen(false);
  }, []);

  const performDeleteSelected = useCallback(
    (toDelete: BoardObject[], deletedFrameIds: Set<string>, deleteChildren: boolean) => {
      if (deleteChildren) {
        const childIds = new Set(objects.filter((o) => o.frameId && deletedFrameIds.has(o.frameId)).map((o) => o.id));
        const allToDelete = objects.filter((o) => toDelete.some((d) => d.id === o.id) || childIds.has(o.id));
        allToDelete.forEach((o) => deleteObject(o.id));
        pushAction({ type: 'delete', objects: allToDelete });
      } else {
        const childrenToUnlink = objects.filter((o) => o.frameId && deletedFrameIds.has(o.frameId));
        childrenToUnlink.forEach((o) => updateObject(o.id, { frameId: undefined }));
        if (childrenToUnlink.length > 0) {
          pushAction({
            type: 'update',
            changes: childrenToUnlink.map((o) => ({
              id: o.id,
              before: { frameId: o.frameId },
              after: { frameId: undefined },
            })),
          });
        }
        toDelete.forEach((o) => deleteObject(o.id));
        pushAction({ type: 'delete', objects: toDelete });
      }
      setSelectedObjectIds([]);
      setDeleteFrameConfirm(null);
    },
    [objects, deleteObject, updateObject, pushAction]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const toDelete = objects.filter((o) => selectedObjectIds.includes(o.id));
    const deletedFrameIds = new Set(toDelete.filter((o) => o.type === 'frame').map((o) => o.id));
    const childrenOfDeletedFrames = objects.filter((o) => o.frameId && deletedFrameIds.has(o.frameId));
    const childCount = childrenOfDeletedFrames.length;

    if (deletedFrameIds.size > 0 && childCount > 0) {
      setDeleteFrameConfirm({
        selectedIds: [...selectedObjectIds],
        frameIds: deletedFrameIds,
        childCount,
      });
      return;
    }

    performDeleteSelected(toDelete, deletedFrameIds, false);
  }, [selectedObjectIds, objects, performDeleteSelected]);

  const handleDeleteFrameConfirm = useCallback(
    (action: 'deleteAll' | 'keepShapes' | 'cancel') => {
      if (!deleteFrameConfirm) return;
      if (action === 'cancel') {
        setDeleteFrameConfirm(null);
        return;
      }
      const toDelete = objects.filter((o) => deleteFrameConfirm.selectedIds.includes(o.id));
      const deletedFrameIds = new Set(toDelete.filter((o) => o.type === 'frame').map((o) => o.id));
      performDeleteSelected(toDelete, deletedFrameIds, action === 'deleteAll');
    },
    [deleteFrameConfirm, objects, performDeleteSelected]
  );

  const handleCopySelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const toCopy = objects.filter((o) => selectedObjectIds.includes(o.id));
    clipboardRef.current = toCopy.map((o) => ({ ...o }));
    setClipboardCount(toCopy.length);
  }, [selectedObjectIds, objects]);

  const handleCutSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const toCut = objects.filter((o) => selectedObjectIds.includes(o.id));
    clipboardRef.current = toCut.map((o) => ({ ...o }));
    setClipboardCount(toCut.length);
    toCut.forEach((o) => deleteObject(o.id));
    pushAction({ type: 'delete', objects: toCut });
    setSelectedObjectIds([]);
  }, [selectedObjectIds, objects, deleteObject, pushAction]);

  const handlePaste = useCallback(
    (worldPos?: { x: number; y: number }) => {
      if (clipboardRef.current.length === 0 || !user) return;
      const clip = clipboardRef.current;
      const minX = Math.min(...clip.map((o) => o.x));
      const minY = Math.min(...clip.map((o) => o.y));
      const target = worldPos ?? lastClickedWorldRef.current ?? { x: minX + 20, y: minY + 20 };
      const newIds: string[] = [];
      const newObjects: BoardObject[] = [];
      clip.forEach((obj) => {
        const newId = generateId();
        newIds.push(newId);
        newObjects.push({
          ...obj,
          id: newId,
          x: target.x + (obj.x - minX),
          y: target.y + (obj.y - minY),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        });
      });
      Promise.all(newObjects.map((o) => addObject(o)))
        .then(() => {
          setSelectedObjectIds(newIds);
          pushAction({ type: 'add', objects: newObjects });
          clipboardRef.current = newObjects.map((o) => ({ ...o }));
          setClipboardCount(newObjects.length);
        })
        .catch((err) => console.error('❌ Failed to paste objects:', err));
    },
    [user, addObject, pushAction]
  );

  const handleLastClickPosition = useCallback((worldPos: { x: number; y: number }) => {
    lastClickedWorldRef.current = worldPos;
  }, []);

  const duplicateSelectedObjects = useCallback(() => {
    if (!user || selectedObjectIds.length === 0) return;
    const newIds: string[] = [];
    const newObjects: BoardObject[] = [];
    const promises = selectedObjectIds.map((id) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return Promise.resolve();
      const newId = generateId();
      newIds.push(newId);
      const newObject: BoardObject = {
        ...obj,
        id: newId,
        x: obj.x + 20,
        y: obj.y + 20,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      newObjects.push(newObject);
      return addObject(newObject);
    });
    Promise.all(promises)
      .then(() => {
        setSelectedObjectIds(newIds);
        pushAction({ type: 'add', objects: newObjects });
      })
      .catch((err) => console.error('❌ Failed to duplicate objects:', err));
  }, [objects, user, addObject, selectedObjectIds, pushAction]);

  /** Get all objects that belong to a frame (frameId === frameId). */
  const getShapesInFrame = useCallback((frameId: string) => {
    return objects.filter((o) => o.frameId === frameId);
  }, [objects]);

  /** Find a frame that contains the point (world coords). First matching frame wins. */
  const getFrameContainingPoint = useCallback((worldX: number, worldY: number) => {
    return objects.find(
      (o) =>
        o.type === 'frame' &&
        worldX >= o.x &&
        worldX <= o.x + o.width &&
        worldY >= o.y &&
        worldY <= o.y + o.height
    ) ?? null;
  }, [objects]);

  /** Return objects whose AABB is fully inside the frame bounds (excluding the frame itself and other frames). */
  const detectShapesInFrame = useCallback((frame: BoardObject, objectList: BoardObject[]) => {
    const fx = frame.x;
    const fy = frame.y;
    const fRight = frame.x + frame.width;
    const fBottom = frame.y + frame.height;
    return objectList.filter(
      (o) =>
        o.id !== frame.id &&
        o.type !== 'frame' &&
        o.x >= fx &&
        o.y >= fy &&
        (o.x + (o.width ?? 0)) <= fRight &&
        (o.y + (o.height ?? 0)) <= fBottom
    );
  }, []);

  /** Find a frame whose bounds fully contain the given AABB (x, y, width, height). */
  const getFrameContainingRect = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const right = x + width;
      const bottom = y + height;
      return (
        objects.find(
          (o) =>
            o.type === 'frame' &&
            o.x <= x &&
            o.y <= y &&
            o.x + o.width >= right &&
            o.y + o.height >= bottom
        ) ?? null
      );
    },
    [objects]
  );

  const handleObjectUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        const before = Object.fromEntries(
          (Object.keys(updates) as (keyof BoardObject)[]).map((k) => [k, obj[k]])
        ) as Partial<BoardObject>;
        pushAction({ type: 'update', changes: [{ id, before, after: updates }] });
      }

      // When a frame is moved/resized/rotated, sync all contained shapes
      if (obj?.type === 'frame') {
        const children = getShapesInFrame(id);
        if (children.length > 0) {
          const newX = updates.x ?? obj.x;
          const newY = updates.y ?? obj.y;
          const newW = updates.width ?? obj.width;
          const newH = updates.height ?? obj.height;
          const newRot = updates.rotation ?? obj.rotation ?? 0;
          const oldX = obj.x;
          const oldY = obj.y;
          const oldW = obj.width;
          const oldH = obj.height;
          const oldRot = obj.rotation ?? 0;

          const sizeChanged = newW !== oldW || newH !== oldH;
          const rotDelta = newRot - oldRot;

          const childChanges: Array<{ objectId: string; updates: Partial<BoardObject> }> = [];

          if (!sizeChanged) {
            // Frame MOVED (no resize) — translate children by the same delta
            const dx = newX - oldX;
            const dy = newY - oldY;
            if (dx !== 0 || dy !== 0 || rotDelta !== 0) {
              for (const child of children) {
                childChanges.push({
                  objectId: child.id,
                  updates: {
                    x: child.x + dx,
                    y: child.y + dy,
                    rotation: (child.rotation ?? 0) + rotDelta,
                  },
                });
              }
            }
          } else {
            // Frame RESIZED — only scale children proportionally when frame shrinks
            const rawScaleX = oldW > 0 ? newW / oldW : 1;
            const rawScaleY = oldH > 0 ? newH / oldH : 1;
            const isShrinking = rawScaleX < 1 || rawScaleY < 1;

            if (isShrinking) {
              // Apply scaling only on shrinking axes; growing axes use 1 (children stay put on that axis)
              const scaleX = Math.min(rawScaleX, 1);
              const scaleY = Math.min(rawScaleY, 1);
              for (const child of children) {
                const relX = child.x - oldX;
                const relY = child.y - oldY;
                childChanges.push({
                  objectId: child.id,
                  updates: {
                    x: newX + relX * scaleX,
                    y: newY + relY * scaleY,
                    width: Math.max(20, child.width * scaleX),
                    height: Math.max(20, child.height * scaleY),
                    rotation: (child.rotation ?? 0) + rotDelta,
                  },
                });
              }
            }
            // When frame grows, children stay at their positions/sizes — no childChanges needed
          }

          if (childChanges.length > 0) {
            pushAction({
              type: 'update',
              changes: childChanges.map(({ objectId: cid, updates: u }) => {
                const c = objects.find((o) => o.id === cid);
                const before = c ? Object.fromEntries((Object.keys(u) as (keyof BoardObject)[]).map((k) => [k, c[k]])) as Partial<BoardObject> : {};
                return { id: cid, before, after: u };
              }),
            });
            batchUpdateObjects([{ objectId: id, updates }, ...childChanges]);
          } else {
            updateObject(id, updates);
          }
          return;
        }
      }

      updateObject(id, updates);

      // When a non-frame object is moved/resized, assign to or remove from a frame
      if (obj && obj.type !== 'frame' && (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined)) {
        const newX = updates.x ?? obj.x;
        const newY = updates.y ?? obj.y;
        const newW = updates.width ?? obj.width;
        const newH = updates.height ?? obj.height;
        const containing = getFrameContainingRect(newX, newY, newW, newH);
        if (containing) {
          if (obj.frameId !== containing.id) {
            pushAction({ type: 'update', changes: [{ id, before: { frameId: obj.frameId }, after: { frameId: containing.id } }] });
            updateObject(id, { frameId: containing.id });
          }
        } else if (obj.frameId !== undefined) {
          // Use AABB check consistent with enter: shape must be fully inside to stay
          const frame = objects.find((o) => o.type === 'frame' && o.id === obj.frameId);
          const stillFullyInside = frame &&
            newX >= frame.x && newY >= frame.y &&
            newX + newW <= frame.x + frame.width && newY + newH <= frame.y + frame.height;
          if (!stillFullyInside) {
            pushAction({ type: 'update', changes: [{ id, before: { frameId: obj.frameId }, after: { frameId: undefined } }] });
            updateObject(id, { frameId: undefined });
          }
        }
      }
    },
    [objects, updateObject, batchUpdateObjects, pushAction, getShapesInFrame, getFrameContainingRect]
  );

  const handleBatchObjectUpdate = useCallback(
    (changes: { id: string; updates: Partial<BoardObject> }[]) => {
      if (changes.length === 0) return;

      // When a frame is moved/resized in a multi-select, sync its children:
      // Move = translate children, Shrink = scale proportionally, Grow = children stay put
      const resolvedChanges = [...changes];

      for (const { id, updates: ups } of changes) {
        const obj = objects.find((o) => o.id === id);
        if (!obj || obj.type !== 'frame') continue;
        const hasTransform = ups.x !== undefined || ups.y !== undefined || ups.width !== undefined || ups.height !== undefined || ups.rotation !== undefined;
        if (!hasTransform) continue;

        const newX = ups.x ?? obj.x;
        const newY = ups.y ?? obj.y;
        const newW = ups.width ?? obj.width;
        const newH = ups.height ?? obj.height;
        const newRot = ups.rotation ?? obj.rotation ?? 0;
        const oldX = obj.x;
        const oldY = obj.y;
        const oldW = obj.width;
        const oldH = obj.height;
        const oldRot = obj.rotation ?? 0;
        const rotDelta = newRot - oldRot;
        const sizeChanged = newW !== oldW || newH !== oldH;

        const children = getShapesInFrame(id);
        if (!sizeChanged) {
          // Frame MOVED — translate children
          const dx = newX - oldX;
          const dy = newY - oldY;
          if (dx !== 0 || dy !== 0 || rotDelta !== 0) {
            for (const child of children) {
              const childUpdates: Partial<BoardObject> = {
                x: child.x + dx,
                y: child.y + dy,
                rotation: (child.rotation ?? 0) + rotDelta,
              };
              const idx = resolvedChanges.findIndex((c) => c.id === child.id);
              if (idx >= 0) resolvedChanges[idx] = { id: child.id, updates: childUpdates };
              else resolvedChanges.push({ id: child.id, updates: childUpdates });
            }
          }
        } else {
          // Frame RESIZED — only scale on shrinking axes
          const rawScaleX = oldW > 0 ? newW / oldW : 1;
          const rawScaleY = oldH > 0 ? newH / oldH : 1;
          const isShrinking = rawScaleX < 1 || rawScaleY < 1;
          if (isShrinking) {
            const scaleX = Math.min(rawScaleX, 1);
            const scaleY = Math.min(rawScaleY, 1);
            for (const child of children) {
              const relX = child.x - oldX;
              const relY = child.y - oldY;
              const childUpdates: Partial<BoardObject> = {
                x: newX + relX * scaleX,
                y: newY + relY * scaleY,
                width: Math.max(child.type === 'line' ? 0 : 20, child.width * scaleX),
                height: Math.max(child.type === 'line' ? 0 : 20, child.height * scaleY),
                rotation: (child.rotation ?? 0) + rotDelta,
              };
              const idx = resolvedChanges.findIndex((c) => c.id === child.id);
              if (idx >= 0) resolvedChanges[idx] = { id: child.id, updates: childUpdates };
              else resolvedChanges.push({ id: child.id, updates: childUpdates });
            }
          }
          // When frame grows, children stay at their positions — no child changes needed
        }
      }

      const undoChanges = resolvedChanges
        .map(({ id, updates: ups }) => {
          const obj = objects.find((o) => o.id === id);
          if (!obj) return null;
          const before = Object.fromEntries(
            (Object.keys(ups) as (keyof BoardObject)[]).map((k) => [k, obj[k]])
          ) as Partial<BoardObject>;
          return { id, before, after: ups };
        })
        .filter((c): c is { id: string; before: Partial<BoardObject>; after: Partial<BoardObject> } => c !== null);
      if (undoChanges.length > 0) {
        pushAction({ type: 'update', changes: undoChanges });
      }
      batchUpdateObjects(resolvedChanges.map(({ id, updates: ups }) => ({ objectId: id, updates: ups })));
      // Frame containment for each moved object
      resolvedChanges.forEach(({ id, updates: ups }) => {
        const obj = objects.find((o) => o.id === id);
        if (!obj || obj.type === 'frame') return;
        if (ups.x === undefined && ups.y === undefined && ups.width === undefined && ups.height === undefined) return;
        const newX = ups.x ?? obj.x;
        const newY = ups.y ?? obj.y;
        const newW = ups.width ?? obj.width;
        const newH = ups.height ?? obj.height;
        const containing = getFrameContainingRect(newX, newY, newW, newH);
        if (containing && obj.frameId !== containing.id) {
          pushAction({ type: 'update', changes: [{ id, before: { frameId: obj.frameId }, after: { frameId: containing.id } }] });
          updateObject(id, { frameId: containing.id });
        } else if (!containing && obj.frameId !== undefined) {
          // Use AABB check consistent with enter: shape must be fully inside to stay
          const frame = objects.find((o) => o.type === 'frame' && o.id === obj.frameId);
          const stillFullyInside = frame &&
            newX >= frame.x && newY >= frame.y &&
            newX + newW <= frame.x + frame.width && newY + newH <= frame.y + frame.height;
          if (!stillFullyInside) {
            pushAction({ type: 'update', changes: [{ id, before: { frameId: obj.frameId }, after: { frameId: undefined } }] });
            updateObject(id, { frameId: undefined });
          }
        }
      });
    },
    [objects, updateObject, batchUpdateObjects, pushAction, getShapesInFrame, getFrameContainingRect]
  );

  const handleObjectDelete = useCallback(
    (id: string) => {
      deleteObject(id);
      setSelectedObjectIds((prev) => prev.filter((x) => x !== id));
    },
    [deleteObject]
  );

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!editingObject) return;
      const id = editingObject.id;
      try {
        const finalText = editingObject.objectType === 'frame'
          ? (text.trim() || 'Untitled Frame')
          : text;
        const obj = objects.find((o) => o.id === id);
        if (!obj) {
          clearEditing();
          setEditingObject(null);
          return;
        }
        const beforeText = (obj?.text ?? editingObject.text) ?? '';
        if (beforeText !== finalText) {
          pushAction({
            type: 'update',
            changes: [{ id, before: { text: beforeText }, after: { text: finalText } }],
          });
        }
        updateObject(id, { text: finalText });
      } catch (err) {
        console.error('handleTextSubmit error:', err);
      } finally {
        clearEditing();
        setEditingObject(null);
      }
    },
    [editingObject, objects, updateObject, clearEditing, pushAction]
  );

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      lastPointerRef.current = { x, y };
      updateCursor(x, y);
    },
    [updateCursor]
  );

  const openTextEditorForObject = useCallback(
    (obj: BoardObject) => {
      if (obj.type !== 'sticky' && obj.type !== 'text') return;
      // Guard: avoid NaN from bad rotation/transform — never pass non-finite values to TextEditor
      const x = Number.isFinite(obj.x) ? obj.x : 0;
      const y = Number.isFinite(obj.y) ? obj.y : 0;
      const w = Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 200;
      const h = Number.isFinite(obj.height) && obj.height > 0 ? obj.height : 100;
      const { x: screenX, y: screenY } = worldToScreen(x, y, viewport);
      const screenWidth = w * viewport.scaleX;
      const screenHeight = h * viewport.scaleY;
      setEditingObject({
        id: obj.id,
        x: Number.isFinite(screenX) ? screenX : 0,
        y: Number.isFinite(screenY) ? screenY : 0,
        width: Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 200,
        height: Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 100,
        text: obj.text || '',
        objectType: obj.type as 'sticky' | 'text',
      });
      setSelectedObjectIds([obj.id]);
      broadcastEditing(obj.id, obj.text ?? '');
    },
    [viewport, broadcastEditing]
  );

  const openFrameTitleEditor = useCallback(
    (obj: BoardObject) => {
      const x = Number.isFinite(obj.x) ? obj.x : 0;
      const y = Number.isFinite(obj.y) ? obj.y : 0;
      const w = Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 200;
      const { x: screenX, y: screenY } = worldToScreen(x, y - 22, viewport);
      const screenWidth = Math.min(w * viewport.scaleX, 400);
      setEditingObject({
        id: obj.id,
        x: Number.isFinite(screenX) ? screenX : 0,
        y: Number.isFinite(screenY) ? screenY : 0,
        width: Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 200,
        height: 24 * viewport.scaleY,
        text: obj.text || '',
        objectType: 'frame',
      });
      setSelectedObjectIds([obj.id]);
      broadcastEditing(obj.id, obj.text ?? '');
    },
    [viewport, broadcastEditing]
  );

  const handleObjectDoubleClick = useCallback(
    (obj: BoardObject) => {
      if (obj.type === 'sticky' || obj.type === 'text') {
        openTextEditorForObject(obj);
      } else if (obj.type === 'frame') {
        openFrameTitleEditor(obj);
      }
    },
    [openTextEditorForObject, openFrameTitleEditor]
  );

  const handleObjectRightClick = useCallback(
    (obj: BoardObject, screenPos: { x: number; y: number }) => {
      setSelectedObjectIds((prev) => (prev.includes(obj.id) ? prev : [obj.id]));
      const world = screenToWorld(screenPos.x, screenPos.y, viewport);
      setContextMenu({
        x: screenPos.x,
        y: screenPos.y,
        objectId: obj.id,
        pasteWorldX: world.x,
        pasteWorldY: world.y,
      });
    },
    [viewport]
  );

  const handleCanvasRightClick = useCallback(
    (screenPos: { x: number; y: number }) => {
      const world = screenToWorld(screenPos.x, screenPos.y, viewport);
      setContextMenu({
        x: screenPos.x,
        y: screenPos.y,
        objectId: null,
        pasteWorldX: world.x,
        pasteWorldY: world.y,
      });
    },
    [viewport]
  );

  const handleConnectShapes = useCallback(
    (fromId: string, fromPoint: string, toId: string, toPoint: string, startX: number, startY: number, endX: number, endY: number, waypoints: Waypoint[]) => {
      if (!user) return;
      const id = generateId();
      const newLine: BoardObject = {
        id,
        type: 'line',
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        rotation: 0,
        color: '#000000',
        strokeColor: '#000000',
        strokeWidth: 2,
        arrowType: 'none',
        waypoints,
        fromId: fromId || undefined,
        fromPoint: fromPoint || undefined,
        toId: toId || undefined,
        toPoint: toPoint || undefined,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      addObject(newLine)
        .then(() => {
          setSelectedObjectIds([id]);
          pushAction({ type: 'add', objects: [newLine] });
          console.log('🔗 Connected line created:', newLine);
        })
        .catch(err => console.error('❌ Failed to create connected line:', err));
    },
    [user, addObject, pushAction]
  );

  const handleShapeDrop = useCallback(
    (shapeType: 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double' | 'triangle' | 'star' | 'frame', screenX: number, screenY: number) => {
      if (!user) {
        console.error('❌ No user found - cannot create object');
        return;
      }

      const v = viewportRef.current;
      const scaleX = Math.min(100, Math.max(0.01, v.scaleX));
      const scaleY = Math.min(100, Math.max(0.01, v.scaleY));
      const safeViewport = { ...v, scaleX, scaleY };
      let worldPos = screenToWorld(screenX, screenY, safeViewport);
      const CLAMP = 1e6;
      worldPos = {
        x: Math.max(-CLAMP, Math.min(CLAMP, worldPos.x)),
        y: Math.max(-CLAMP, Math.min(CLAMP, worldPos.y)),
      };

      const dropFrame = shapeType !== 'frame' ? getFrameContainingPoint(worldPos.x, worldPos.y) : null;
      const dropFrameId = dropFrame?.id;

      const id = generateId();
      let newObject: BoardObject;

      if (shapeType === 'sticky') {
        const noteWidth = 200;
        const noteHeight = 200;
        newObject = {
          id,
          type: 'sticky',
          x: worldPos.x - noteWidth / 2,
          y: worldPos.y - noteHeight / 2,
          width: noteWidth,
          height: noteHeight,
          rotation: 0,
          text: '',
          color: '#FFD700',
          strokeWidth: 0,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'text') {
        const textWidth = 200;
        const textHeight = 40;
        newObject = {
          id,
          type: 'text',
          x: worldPos.x - textWidth / 2,
          y: worldPos.y - textHeight / 2,
          width: textWidth,
          height: textHeight,
          rotation: 0,
          text: '',
          color: 'transparent',
          strokeWidth: 0,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'circle') {
        const circleSize = 150;
        newObject = {
          id,
          type: 'circle',
          x: worldPos.x - circleSize / 2,
          y: worldPos.y - circleSize / 2,
          width: circleSize,
          height: circleSize,
          rotation: 0,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          aspectRatio: 1,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'line' || shapeType === 'arrow-single' || shapeType === 'arrow-double') {
        const lineWidth = 200;
        newObject = {
          id,
          type: 'line',
          x: worldPos.x - lineWidth / 2,
          y: worldPos.y,
          width: lineWidth,
          height: 0,
          rotation: 0,
          color: '#000000',
          strokeColor: '#000000',
          strokeWidth: 2,
          arrowType: shapeType === 'arrow-single' ? 'single' : shapeType === 'arrow-double' ? 'double' : 'none',
          waypoints: [],
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'triangle') {
        const triWidth = 150;
        const triHeight = 130;
        newObject = {
          id,
          type: 'triangle',
          x: worldPos.x - triWidth / 2,
          y: worldPos.y - triHeight / 2,
          width: triWidth,
          height: triHeight,
          rotation: 0,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          aspectRatio: triWidth / triHeight,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'star') {
        const starSize = 150;
        newObject = {
          id,
          type: 'star',
          x: worldPos.x - starSize / 2,
          y: worldPos.y - starSize / 2,
          width: starSize,
          height: starSize,
          rotation: 0,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          aspectRatio: 1,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else if (shapeType === 'frame') {
        const frameWidth = 300;
        const frameHeight = 200;
        const existingFrameCount = objects.filter(o => o.type === 'frame').length;
        newObject = {
          id,
          type: 'frame',
          x: worldPos.x - frameWidth / 2,
          y: worldPos.y - frameHeight / 2,
          width: frameWidth,
          height: frameHeight,
          rotation: 0,
          text: `Frame ${existingFrameCount + 1}`,
          color: '#3366ff',
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      } else {
        const rectWidth = 200;
        const rectHeight = 150;
        newObject = {
          id,
          type: 'rectangle',
          x: worldPos.x - rectWidth / 2,
          y: worldPos.y - rectHeight / 2,
          width: rectWidth,
          height: rectHeight,
          rotation: 0,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          aspectRatio: rectWidth / rectHeight,
          ...(dropFrameId && { frameId: dropFrameId }),
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
      }

      addObject(newObject)
        .then(() => {
          console.log(`✅ ${shapeType} added via drag-and-drop`);
          setSelectedObjectIds([id]);
          pushAction({ type: 'add', objects: [newObject] });
          if (shapeType === 'frame') {
            const contained = detectShapesInFrame(newObject, objects);
            contained.forEach((o) => {
              pushAction({ type: 'update', changes: [{ id: o.id, before: { frameId: o.frameId }, after: { frameId: newObject.id } }] });
              updateObject(o.id, { frameId: newObject.id });
            });
          }
        })
        .catch((err) => {
          console.error(`❌ Failed to add ${shapeType}:`, err);
        });
    },
    [addObject, user, pushAction, objects, getFrameContainingPoint, detectShapesInFrame, updateObject]
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('shape-type')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleCanvasDragLeave = useCallback((_e: React.DragEvent) => {
    // Optional: could clear drop indicator
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastDropHandledAtRef.current < 300) return;
      lastDropHandledAtRef.current = now;
      const shapeType = e.dataTransfer.getData('shape-type') as 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double' | 'triangle' | 'star' | 'frame';
      if (shapeType && canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        handleShapeDrop(shapeType, x, y);
      }
    },
    [handleShapeDrop]
  );

  const handleSelectedObjectUpdate = useCallback(
    (updates: Partial<BoardObject>) => {
      if (selectedObjectIds.length === 0) return;
      if (selectedObjectIds.length === 1) {
        handleObjectUpdate(selectedObjectIds[0], updates);
      } else {
        // Multi-select: apply all updates to all selected objects
        handleBatchObjectUpdate(
          selectedObjectIds.map((id) => ({ id, updates }))
        );
      }
    },
    [selectedObjectIds, handleObjectUpdate, handleBatchObjectUpdate]
  );

  const handleClearBoard = useCallback(async () => {
    if (objects.length === 0) return;
    const ok = window.confirm('Clear the board? This will delete all objects for everyone in this board.');
    if (!ok) return;
    pushAction({ type: 'delete', objects: [...objects] });
    setSelectedObjectIds([]);
    setContextMenu(null);
    setEditingObject(null);
    await clearObjects();
  }, [objects, clearObjects, pushAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingObject) return;
      const active = document.activeElement;
      const isEditingInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable);
      if (isEditingInput) return;
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      }
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCopySelected();
      }
      if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCutSelected();
      }
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handlePaste();
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedObjectIds.length > 0) {
        e.preventDefault();
        duplicateSelectedObjects();
      }
      if (e.key === 'b' && (e.metaKey || e.ctrlKey) && selectedObjectIds.length > 0) {
        e.preventDefault();
        const obj = objects.find((o) => o.id === selectedObjectIds[0]);
        if (obj && (obj.type === 'sticky' || obj.type === 'text')) {
          handleSelectedObjectUpdate({ bold: !obj.bold });
        }
      }
      if (e.key === 'i' && (e.metaKey || e.ctrlKey) && selectedObjectIds.length > 0) {
        e.preventDefault();
        const obj = objects.find((o) => o.id === selectedObjectIds[0]);
        if (obj && (obj.type === 'sticky' || obj.type === 'text')) {
          handleSelectedObjectUpdate({ italic: !obj.italic });
        }
      }
      if (e.key === 'u' && (e.metaKey || e.ctrlKey) && selectedObjectIds.length > 0) {
        e.preventDefault();
        const obj = objects.find((o) => o.id === selectedObjectIds[0]);
        if (obj && (obj.type === 'sticky' || obj.type === 'text')) {
          handleSelectedObjectUpdate({ underline: !obj.underline });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingObject,
    selectedObjectIds,
    objects,
    selectAll,
    handleCopySelected,
    handleCutSelected,
    handlePaste,
    handleDeleteSelected,
    handleSelectedObjectUpdate,
    duplicateSelectedObjects,
    undo,
    redo,
    createObjectAtCenter,
  ]);

  const handleLogout = useCallback(async () => {
    await Promise.all([
      cleanupPresence(),
      cleanupCursor(),
      cleanupTransform(),
      cleanupEditing(),
      cleanupSelection(),
    ]);
    await logout();
  }, [cleanupPresence, cleanupCursor, cleanupTransform, cleanupEditing, cleanupSelection, logout]);

  const selectedObject =
    selectedObjectIds.length >= 1
      ? objects.find((obj) => obj.id === selectedObjectIds[0]) || null
      : null;
  const contextMenuObject =
    contextMenu?.objectId != null
      ? objects.find((obj) => obj.id === contextMenu.objectId) || null
      : null;

  return (
    <div className="board-container">
      <Toolbar
        boardName={boardDisplayName}
        onBoardNameChange={handleBoardNameChange}
        onLogout={handleLogout}
      />
      <div className="board-content">
        <ShapeSidebar
          onShapeClick={createObjectAtCenter}
          onDragStateChange={setIsDraggingShapeFromSidebar}
          shapesPanelOpen={shapesPanelOpen}
          onShapesPanelOpenChange={setShapesPanelOpen}
        />
        <div className="board-main">
          <UndoRedoClearPanel
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onClear={handleClearBoard}
            clearDisabled={objects.length === 0}
          />
          <button
            type="button"
            className="ai-fab"
            onClick={() => setAiPanelOpen(true)}
            aria-label="Open AI Assistant"
            data-testid="ai-fab"
          >
            <span className="ai-fab-star" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor" className="ai-fab-star-svg">
                <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" />
              </svg>
            </span>
          </button>
          <div
            className="ai-command-panel-overlay"
            data-testid="ai-command-panel-overlay"
            style={{ display: aiPanelOpen ? undefined : 'none' }}
          >
            <div className="ai-command-panel-backdrop" onClick={() => setAiPanelOpen(false)} aria-hidden />
            <div className="ai-command-panel-wrap">
              <AICommandPanel boardId={boardId} onClose={() => setAiPanelOpen(false)} />
              <button
                type="button"
                className="ai-command-panel-close"
                onClick={() => setAiPanelOpen(false)}
                aria-label="Close AI Assistant"
              >
                ×
              </button>
            </div>
          </div>
          <PresenceBar onlineUsers={onlineUsers} />
          <div
            ref={canvasContainerRef}
            className={`canvas-area${isDraggingShapeFromSidebar ? ' dragging-shape' : ''}`}
            style={{ position: 'relative' }}
            onDragOver={handleCanvasDragOver}
            onDragEnter={handleCanvasDragEnter}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Canvas
              objects={objects}
              onObjectUpdate={handleObjectUpdate}
              onBatchObjectUpdate={handleBatchObjectUpdate}
              onObjectDelete={handleObjectDelete}
              onCanvasClick={handleCanvasClick}
              onCanvasRightClick={handleCanvasRightClick}
              onLastClickPosition={handleLastClickPosition}
              onObjectDoubleClick={handleObjectDoubleClick}
              onObjectRightClick={handleObjectRightClick}
              remoteCursors={cursors}
              onMouseMove={handleMouseMove}
              selectedObjectIds={selectedObjectIds}
              onSelectObject={selectObject}
              onClearSelection={clearSelection}
              onSelectAll={selectAll}
              onDeleteSelected={handleDeleteSelected}
              onDuplicateSelected={duplicateSelectedObjects}
              onSetSelectedIds={setSelectedWithZBump}
              viewport={viewport}
              setPosition={setPosition}
              zoomAtPoint={zoomAtPoint}
              isEditingText={!!editingObject}
              onLiveTransformChange={setLiveTransform}
              remoteTransforms={remoteTransforms}
              remoteEditings={remoteEditings}
              onBroadcastTransform={broadcastTransform}
              onClearTransform={clearTransform}
              onConnectShapes={handleConnectShapes}
              onDragStart={markDragging}
              onDragEnd={unmarkDragging}
              isDraggingShapeFromSidebar={isDraggingShapeFromSidebar}
            />
        {selectedObject && (
          <StyleBar
            key={selectedObjectIds.join(',')}
            selectedObject={selectedObject}
            selectedCount={selectedObjectIds.length}
            onUpdate={handleSelectedObjectUpdate}
            onDelete={handleDeleteSelected}
            liveTransform={liveTransform}
            viewport={viewport}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            objectType={contextMenuObject?.type}
            onEditText={
              contextMenuObject && (contextMenuObject.type === 'sticky' || contextMenuObject.type === 'text')
                ? () => {
                    openTextEditorForObject(contextMenuObject);
                    setContextMenu(null);
                  }
                : contextMenuObject && contextMenuObject.type === 'frame'
                  ? () => {
                      openFrameTitleEditor(contextMenuObject);
                      setContextMenu(null);
                    }
                  : undefined
            }
            onCopy={handleCopySelected}
            onCut={handleCutSelected}
            onPaste={() => handlePaste({ x: contextMenu.pasteWorldX, y: contextMenu.pasteWorldY })}
            onDuplicate={duplicateSelectedObjects}
            onSelectAll={selectAll}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            hasClipboardContent={clipboardCount > 0}
            onDelete={handleDeleteSelected}
            onClose={() => setContextMenu(null)}
          />
        )}
        {editingObject && (() => {
          const editObj = objects.find(obj => obj.id === editingObject.id);
          return (
            <TextEditor
              x={editingObject.x}
              y={editingObject.y}
              width={editingObject.width}
              height={editingObject.height}
              text={editingObject.text}
              color={editingObject.objectType === 'text' ? 'transparent' : editObj?.color}
              textColor={editObj?.textColor}
              objectType={editingObject.objectType}
              fontSize={editObj?.fontSize}
              fontFamily={editObj?.fontFamily}
              bold={editObj?.bold}
              italic={editObj?.italic}
              underline={editObj?.underline}
              onSubmit={handleTextSubmit}
              onCancel={() => {
                clearEditing();
                setEditingObject(null);
              }}
              onTextChange={(text) => editingObject && broadcastEditing(editingObject.id, text)}
            />
          );
        })()}
          </div>
        </div>
      </div>
      {deleteFrameConfirm && (
        <div className="delete-frame-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-frame-confirm-title">
          <div className="delete-frame-confirm-box">
            <h2 id="delete-frame-confirm-title" className="delete-frame-confirm-title">
              Delete frame and {deleteFrameConfirm.childCount} shape(s)?
            </h2>
            <p className="delete-frame-confirm-desc">Shapes inside the frame can be deleted or kept on the board.</p>
            <div className="delete-frame-confirm-actions">
              <button
                type="button"
                className="delete-frame-confirm-btn delete-frame-confirm-delete-all"
                onClick={() => handleDeleteFrameConfirm('deleteAll')}
              >
                Delete all
              </button>
              <button
                type="button"
                className="delete-frame-confirm-btn delete-frame-confirm-keep"
                onClick={() => handleDeleteFrameConfirm('keepShapes')}
              >
                Keep shapes
              </button>
              <button
                type="button"
                className="delete-frame-confirm-btn delete-frame-confirm-cancel"
                onClick={() => handleDeleteFrameConfirm('cancel')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
