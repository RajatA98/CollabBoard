import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { TextEditor } from './TextEditor';
import { PresenceBar } from './PresenceBar';
import { ShapeSidebar } from './ShapeSidebar';
import { UndoRedoClearPanel } from './UndoRedoClearPanel';
import { StylePanel } from './StylePanel';
import { ContextMenu } from './ContextMenu';
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
  const { objects, addObject, updateObject, deleteObject, clearObjects } = useBoardObjects(boardId);
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
    objectType: 'sticky' | 'text';
  } | null>(null);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [shapesPanelOpen, setShapesPanelOpen] = useState(false);
  const [boardMeta, setBoardMeta] = useState<BoardMeta | null>(null);
  const [isDraggingShapeFromSidebar, setIsDraggingShapeFromSidebar] = useState(false);
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

  const selectObject = useCallback(
    (id: string, additive: boolean) => {
      if (remoteSelectionByObject[id]) return;
      if (additive) {
        setSelectedObjectIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
      } else {
        setSelectedObjectIds([id]);
      }
    },
    [remoteSelectionByObject]
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

  const createObjectAtCenter = useCallback((type: 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double') => {
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
        color: '#FFD54F',
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
        color: '#CE93D8',
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
        color: '#424242',
        arrowType: type === 'arrow-single' ? 'single' : type === 'arrow-double' ? 'double' : 'none',
        waypoints: [],
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.uid,
      };
      console.log('📏 Creating line/arrow:', newObject);
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
        color: '#90CAF9',
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
      })
      .catch((err) => {
        console.error(`❌ Failed to add ${type} to Firestore:`, err);
      });
  }, [addObject, user, viewport, pushAction]);

  const handleCanvasClick = useCallback(() => {
    setContextMenu(null);
    setShapesPanelOpen(false);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const toDelete = objects.filter((o) => selectedObjectIds.includes(o.id));
    toDelete.forEach((o) => deleteObject(o.id));
    pushAction({ type: 'delete', objects: toDelete });
    setSelectedObjectIds([]);
  }, [selectedObjectIds, objects, deleteObject, pushAction]);

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

  const handleObjectUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        const before = Object.fromEntries(
          (Object.keys(updates) as (keyof BoardObject)[]).map((k) => [k, obj[k]])
        ) as Partial<BoardObject>;
        pushAction({ type: 'update', changes: [{ id, before, after: updates }] });
      }
      updateObject(id, updates);
    },
    [objects, updateObject, pushAction]
  );

  const handleBatchObjectUpdate = useCallback(
    (changes: { id: string; updates: Partial<BoardObject> }[]) => {
      if (changes.length === 0) return;
      const undoChanges = changes
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
      changes.forEach(({ id, updates: ups }) => updateObject(id, ups));
    },
    [objects, updateObject, pushAction]
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
      if (editingObject) {
        // Use current object text from store so undo restores the correct value (avoids stale editingObject)
        const obj = objects.find((o) => o.id === editingObject.id);
        const beforeText = (obj?.text ?? editingObject.text) ?? '';
        if (beforeText !== text) {
          pushAction({
            type: 'update',
            changes: [{ id: editingObject.id, before: { text: beforeText }, after: { text } }],
          });
        }
        updateObject(editingObject.id, { text });
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
      const { x: screenX, y: screenY } = worldToScreen(obj.x, obj.y, viewport);
      const screenWidth = obj.width * viewport.scaleX;
      const screenHeight = obj.height * viewport.scaleY;
      setEditingObject({
        id: obj.id,
        x: screenX,
        y: screenY,
        width: screenWidth,
        height: screenHeight,
        text: obj.text || '',
        objectType: obj.type as 'sticky' | 'text',
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
      }
    },
    [openTextEditorForObject]
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
        color: '#424242',
        arrowType: 'none',
        waypoints,
        fromId,
        fromPoint,
        toId,
        toPoint,
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
    (shapeType: 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double', screenX: number, screenY: number) => {
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
          color: '#FFD54F',
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
          color: '#CE93D8',
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
          color: '#424242',
          arrowType: shapeType === 'arrow-single' ? 'single' : shapeType === 'arrow-double' ? 'double' : 'none',
          waypoints: [],
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
          color: '#90CAF9',
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
        })
        .catch((err) => {
          console.error(`❌ Failed to add ${shapeType}:`, err);
        });
    },
    [addObject, user, pushAction]
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
      const shapeType = e.dataTransfer.getData('shape-type') as 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double';
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
        // Multi-select: apply color to all selected shapes
        if ('color' in updates && updates.color !== undefined) {
          handleBatchObjectUpdate(
            selectedObjectIds.map((id) => ({ id, updates: { color: updates.color! } }))
          );
        }
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
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        createObjectAtCenter('sticky');
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        createObjectAtCenter('text');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingObject,
    selectedObjectIds.length,
    selectAll,
    handleCopySelected,
    handleCutSelected,
    handlePaste,
    handleDeleteSelected,
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
              onSetSelectedIds={setSelectedObjectIds}
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
              isDraggingShapeFromSidebar={isDraggingShapeFromSidebar}
            />
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
        {editingObject && (
          <TextEditor
            x={editingObject.x}
            y={editingObject.y}
            width={editingObject.width}
            height={editingObject.height}
            text={editingObject.text}
            color={editingObject.objectType === 'text' ? 'transparent' : objects.find(obj => obj.id === editingObject.id)?.color}
            objectType={editingObject.objectType}
            onSubmit={handleTextSubmit}
            onCancel={() => {
              clearEditing();
              setEditingObject(null);
            }}
            onTextChange={(text) => editingObject && broadcastEditing(editingObject.id, text)}
          />
        )}
          </div>
        </div>
        {selectedObject && !stylePanelOpen && (
          <button
            type="button"
            className="style-panel-tab"
            onClick={() => setStylePanelOpen(true)}
            aria-label="Open style panel"
            data-testid="style-panel-tab"
          >
            <span className="style-panel-tab-arrow" aria-hidden>‹</span>
          </button>
        )}
        {selectedObject && stylePanelOpen && (
          <StylePanel
            key={selectedObjectIds.join(',')}
            selectedObject={selectedObject}
            selectedCount={selectedObjectIds.length}
            onUpdate={handleSelectedObjectUpdate}
            liveTransform={liveTransform}
            onCollapse={() => setStylePanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
