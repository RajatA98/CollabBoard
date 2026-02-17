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
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
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

  console.log('📊 Board state:', { 
    objectCount: objects.length, 
    objects, 
    viewport,
    editingObject: editingObject ? editingObject.id : null,
    remoteCursors: cursors,
    remoteCursorCount: Object.keys(cursors).length 
  });

  const createObjectAtCenter = useCallback((type: 'rectangle' | 'sticky') => {
    if (!user) {
      console.error('❌ No user found - cannot create object');
      return;
    }
    
    console.log(`✅ User exists, creating ${type}...`);
    
    // Calculate exact center of visible canvas in world coordinates
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 48; // Subtract toolbar height
    
    // Screen space center
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    // Convert screen center to world coordinates
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
        color: '#FFD54F', // Classic sticky note yellow
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
        color: '#90CAF9', // Light blue
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
        setSelectedObjectId(id);
      })
      .catch((err) => {
        console.error(`❌ Failed to add ${type} to Firestore:`, err);
      });
  }, [addObject, user, viewport]);

  const handleCanvasClick = useCallback(() => {
    // Clicking empty canvas deselects
    setSelectedObjectId(null);
    setContextMenu(null);
  }, []);

  const handleObjectUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      updateObject(id, updates);
    },
    [updateObject]
  );

  const handleObjectDelete = useCallback(
    (id: string) => {
      deleteObject(id);
      if (selectedObjectId === id) {
        setSelectedObjectId(null);
      }
    },
    [deleteObject, selectedObjectId]
  );

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
      setSelectedObjectId(obj.id);
      broadcastEditing(obj.id, obj.text ?? '');
    },
    [viewport, broadcastEditing]
  );

  const handleObjectDoubleClick = useCallback(
    (obj: BoardObject) => {
      if (obj.type === 'sticky') {
        openTextEditorForObject(obj);
      }
      // Rectangle: no-op on double-click
    },
    [openTextEditorForObject]
  );

  const duplicateObject = useCallback(
    (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj || !user) return;
      const newId = generateId();
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
      addObject(newObject)
        .then(() => setSelectedObjectId(newId))
        .catch((err) => console.error('❌ Failed to duplicate object:', err));
    },
    [objects, user, addObject]
  );

  const handleObjectRightClick = useCallback((obj: BoardObject, screenPos: { x: number; y: number }) => {
    setSelectedObjectId(obj.id);
    setContextMenu({ x: screenPos.x, y: screenPos.y, objectId: obj.id });
  }, []);

  const handleShapeDrop = useCallback(
    (shapeType: 'rectangle' | 'sticky', screenX: number, screenY: number) => {
      if (!user) {
        console.error('❌ No user found - cannot create object');
        return;
      }

      // Convert screen coordinates to world coordinates
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
          setSelectedObjectId(id);
        })
        .catch((err) => {
          console.error(`❌ Failed to add ${shapeType}:`, err);
        });
    },
    [addObject, user, viewport]
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
      if (selectedObjectId) {
        handleObjectUpdate(selectedObjectId, updates);
      }
    },
    [selectedObjectId, handleObjectUpdate]
  );

  const handleClearBoard = useCallback(async () => {
    if (objects.length === 0) return;
    const ok = window.confirm('Clear the board? This will delete all objects for everyone in this board.');
    if (!ok) return;

    setSelectedObjectId(null);
    setContextMenu(null);
    setEditingObject(null);
    await clearObjects();
  }, [objects.length, clearObjects]);

  const handleLogout = useCallback(async () => {
    await Promise.all([
      cleanupPresence(),
      cleanupCursor(),
      cleanupTransform(),
      cleanupEditing(),
    ]);
    await logout();
  }, [cleanupPresence, cleanupCursor, cleanupTransform, cleanupEditing, logout]);

  const selectedObject = objects.find((obj) => obj.id === selectedObjectId) || null;
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
              onObjectDelete={handleObjectDelete}
              onCanvasClick={handleCanvasClick}
              onObjectDoubleClick={handleObjectDoubleClick}
              onObjectRightClick={handleObjectRightClick}
              onDuplicateObject={duplicateObject}
              remoteCursors={cursors}
              onMouseMove={handleMouseMove}
              selectedObjectId={selectedObjectId}
              onSelectObject={setSelectedObjectId}
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
              duplicateObject(contextMenu.objectId);
              setContextMenu(null);
            }}
            onDelete={() => {
              handleObjectDelete(contextMenu.objectId);
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
