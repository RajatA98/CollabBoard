import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { TextEditor } from './TextEditor';
import { PresenceBar } from './PresenceBar';
import { ShapeSidebar } from './ShapeSidebar';
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
import { screenToWorld } from '../../utils/coordinates';
import type { BoardObject } from '../../types';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function Board() {
  const { boardId = 'default' } = useParams();
  const { user, logout } = useAuth();
  const { objects, addObject, updateObject, deleteObject, clearObjects } = useBoardObjects(boardId);
  const { cursors, updateCursor, cleanupCursor } = useCursors(boardId, user);
  const { onlineUsers, cleanupPresence } = usePresence(boardId, user, cursors);
  const { viewport, setPosition, zoomAtPoint } = useViewport();
  const { remoteTransforms, broadcastTransform, clearTransform, cleanupTransform } = useLiveTransforms(boardId, user);
  const { remoteEditings, broadcastEditing, clearEditing, cleanupEditing } = useLiveEditing(boardId, user);

  // Multi-select state
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
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
  } | null>(null);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

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

  // Clipboard for copy/paste
  const clipboardRef = useRef<BoardObject[]>([]);

  // Undo/redo
  const { pushAction, undo, redo } = useUndoRedo({
    addObject,
    updateObject: async (id: string, updates: Partial<BoardObject>) => {
      await updateObject(id, updates);
    },
    deleteObject,
  });

  console.log('📊 Board state:', {
    objectCount: objects.length,
    objects,
    viewport,
    editingObject: editingObject ? editingObject.id : null,
    remoteCursors: cursors,
    remoteCursorCount: Object.keys(cursors).length,
    selectedCount: selectedObjectIds.length,
  });

  // --- Selection helpers ---
  const selectObject = useCallback((id: string, additive: boolean) => {
    if (additive) {
      setSelectedObjectIds(prev =>
        prev.includes(id)
          ? prev.filter(x => x !== id)
          : [...prev, id]
      );
    } else {
      setSelectedObjectIds([id]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedObjectIds([]);
    setContextMenu(null);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedObjectIds(objects.map(o => o.id));
  }, [objects]);

  const createObjectAtCenter = useCallback((type: 'rectangle' | 'sticky') => {
    if (!user) {
      console.error('❌ No user found - cannot create object');
      return;
    }

    console.log(`✅ User exists, creating ${type}...`);

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 48;
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    const worldCenterX = (screenCenterX - viewport.x) / viewport.scaleX;
    const worldCenterY = (screenCenterY - viewport.y) / viewport.scaleY;

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
  }, []);

  const handleObjectUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      updateObject(id, updates);
    },
    [updateObject]
  );

  // --- Delete selected (also copies to clipboard like cut) ---
  const handleDeleteSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const toDelete = objects.filter(o => selectedObjectIds.includes(o.id));
    // Copy to clipboard before deleting (cut behavior)
    clipboardRef.current = toDelete.map(o => ({ ...o }));
    toDelete.forEach(o => deleteObject(o.id));
    pushAction({ type: 'delete', objects: toDelete });
    setSelectedObjectIds([]);
  }, [selectedObjectIds, objects, deleteObject, pushAction]);

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (editingObject) {
        updateObject(editingObject.id, { text });
        clearEditing();
        setEditingObject(null);
      }
    },
    [editingObject, updateObject, clearEditing]
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
      if (obj.type !== 'sticky') return;
      const screenX = obj.x * viewport.scaleX + viewport.x;
      const screenY = obj.y * viewport.scaleY + viewport.y;
      const screenWidth = obj.width * viewport.scaleX;
      const screenHeight = obj.height * viewport.scaleY;
      setEditingObject({
        id: obj.id,
        x: screenX,
        y: screenY,
        width: screenWidth,
        height: screenHeight,
        text: obj.text || '',
      });
      setSelectedObjectIds([obj.id]);
      broadcastEditing(obj.id, obj.text ?? '');
    },
    [viewport, broadcastEditing]
  );

  const handleObjectDoubleClick = useCallback(
    (obj: BoardObject) => {
      if (obj.type === 'sticky') {
        openTextEditorForObject(obj);
      }
    },
    [openTextEditorForObject]
  );

  // --- Duplicate selected ---
  const duplicateSelectedObjects = useCallback(() => {
    if (!user || selectedObjectIds.length === 0) return;
    const newIds: string[] = [];
    const newObjects: BoardObject[] = [];
    const promises = selectedObjectIds.map(id => {
      const obj = objects.find(o => o.id === id);
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
      .catch(err => console.error('❌ Failed to duplicate objects:', err));
  }, [objects, user, addObject, selectedObjectIds, pushAction]);

  const handleObjectRightClick = useCallback((obj: BoardObject, screenPos: { x: number; y: number }) => {
    setSelectedObjectIds(prev => prev.includes(obj.id) ? prev : [obj.id]);
    setContextMenu({ x: screenPos.x, y: screenPos.y, objectId: obj.id });
  }, []);

  const handleShapeDrop = useCallback(
    (shapeType: 'rectangle' | 'sticky', screenX: number, screenY: number) => {
      if (!user) {
        console.error('❌ No user found - cannot create object');
        return;
      }

      const worldPos = screenToWorld(screenX, screenY, viewport);
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
    [addObject, user, viewport, pushAction]
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const shapeType = e.dataTransfer.getData('shape-type') as 'rectangle' | 'sticky';

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
      if (selectedObjectIds.length === 1) {
        handleObjectUpdate(selectedObjectIds[0], updates);
      }
    },
    [selectedObjectIds, handleObjectUpdate]
  );

  const handleClearBoard = useCallback(async () => {
    if (objects.length === 0) return;
    const ok = window.confirm('Clear the board? This will delete all objects for everyone in this board.');
    if (!ok) return;

    const allObjects = [...objects];
    setSelectedObjectIds([]);
    setContextMenu(null);
    setEditingObject(null);
    await clearObjects();
    pushAction({ type: 'delete', objects: allObjects });
  }, [objects, clearObjects, pushAction]);

  const handleLogout = useCallback(async () => {
    await Promise.all([
      cleanupPresence(),
      cleanupCursor(),
      cleanupTransform(),
      cleanupEditing(),
    ]);
    await logout();
  }, [cleanupPresence, cleanupCursor, cleanupTransform, cleanupEditing, logout]);

  // --- Keyboard shortcuts for clipboard and undo/redo ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when editing text
      const active = document.activeElement;
      const isEditingInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable);
      if (isEditingInput) return;
      if (editingObject) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+Z = Undo
      if (e.key === 'z' && mod && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y = Redo
      if ((e.key === 'z' && mod && e.shiftKey) || (e.key === 'y' && mod)) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+C = Copy
      if (e.key === 'c' && mod && selectedObjectIds.length > 0) {
        e.preventDefault();
        const toCopy = objects.filter(o => selectedObjectIds.includes(o.id));
        clipboardRef.current = toCopy.map(o => ({ ...o }));
        return;
      }

      // Ctrl+X = Cut
      if (e.key === 'x' && mod && selectedObjectIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Ctrl+V = Paste
      if (e.key === 'v' && mod && clipboardRef.current.length > 0) {
        e.preventDefault();
        if (!user) return;
        const newIds: string[] = [];
        const newObjects: BoardObject[] = [];
        clipboardRef.current.forEach(obj => {
          const newId = generateId();
          newIds.push(newId);
          newObjects.push({
            ...obj,
            id: newId,
            x: obj.x + 20,
            y: obj.y + 20,
            createdBy: user.uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updatedBy: user.uid,
          });
        });
        Promise.all(newObjects.map(o => addObject(o)))
          .then(() => {
            setSelectedObjectIds(newIds);
            pushAction({ type: 'add', objects: newObjects });
            // Update clipboard positions for subsequent pastes
            clipboardRef.current = newObjects.map(o => ({ ...o }));
          })
          .catch(err => console.error('❌ Failed to paste objects:', err));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, objects, user, addObject, editingObject, undo, redo, handleDeleteSelected, pushAction]);

  // Derive selected object for StylePanel (only when 1 selected)
  const selectedObject = selectedObjectIds.length === 1
    ? objects.find(obj => obj.id === selectedObjectIds[0]) || null
    : null;

  const contextMenuObject = contextMenu
    ? objects.find((obj) => obj.id === contextMenu.objectId) || null
    : null;

  return (
    <div className="board-container">
      <Toolbar onLogout={handleLogout} />
      <div className="board-content">
        <ShapeSidebar
          onShapeClick={createObjectAtCenter}
        />
        <div className="board-main">
          <PresenceBar onlineUsers={onlineUsers} />
          <div
            ref={canvasContainerRef}
            className="canvas-area"
            style={{ position: 'relative' }}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            <Canvas
              objects={objects}
              onObjectUpdate={handleObjectUpdate}
              onCanvasClick={handleCanvasClick}
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
            />
            <button
              type="button"
              className="tool-btn canvas-clear-btn"
              onClick={handleClearBoard}
              disabled={objects.length === 0}
              aria-label="Clear board"
              data-testid="clear-board-btn"
            >
              Clear
            </button>
        {contextMenu && contextMenuObject && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            objectType={contextMenuObject.type}
            onEditText={
              contextMenuObject.type === 'sticky'
                ? () => {
                    openTextEditorForObject(contextMenuObject);
                    setContextMenu(null);
                  }
                : undefined
            }
            onDuplicate={() => {
              duplicateSelectedObjects();
              setContextMenu(null);
            }}
            onDelete={() => {
              handleDeleteSelected();
              setContextMenu(null);
            }}
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
            color={objects.find(obj => obj.id === editingObject.id)?.color}
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
            key={selectedObject.id}
            selectedObject={selectedObject}
            onUpdate={handleSelectedObjectUpdate}
            liveTransform={liveTransform}
            onCollapse={() => setStylePanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
