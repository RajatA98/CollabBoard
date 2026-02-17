import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { TextEditor } from './TextEditor';
import { PresenceBar } from './PresenceBar';
import { useAuth } from '../../hooks/useAuth';
import { useBoardObjects } from '../../hooks/useBoardObjects';
import { useCursors } from '../../hooks/useCursors';
import { usePresence } from '../../hooks/usePresence';
import { useViewport } from '../../hooks/useViewport';
import type { BoardObject } from '../../types';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function Board() {
  const { boardId = 'default' } = useParams();
  const { user, logout } = useAuth();
  const { objects, addObject, updateObject, deleteObject } = useBoardObjects(boardId);
  const { cursors, updateCursor } = useCursors(boardId, user);
  const { onlineUsers } = usePresence(boardId, user);
  const { viewport, setPosition, zoomAtPoint } = useViewport();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [editingObject, setEditingObject] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  } | null>(null);

  console.log('📊 Board state:', { objectCount: objects.length, objects, viewport });

  const handleAddRectangle = useCallback(() => {
    console.log('🔵 Rectangle button clicked!', { user, hasUser: !!user });
    
    if (!user) {
      console.error('❌ No user found - cannot create rectangle');
      return;
    }
    
    console.log('✅ User exists, creating rectangle...');
    
    // Calculate exact center of visible canvas in world coordinates
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 48; // Subtract toolbar height
    
    // Screen space center
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    // Convert screen center to world coordinates
    const worldCenterX = (screenCenterX - viewport.x) / viewport.scaleX;
    const worldCenterY = (screenCenterY - viewport.y) / viewport.scaleY;
    
    // Rectangle dimensions
    const rectWidth = 200;
    const rectHeight = 150;
    
    // Position rectangle so its center is at world center
    const rectX = worldCenterX - (rectWidth / 2);
    const rectY = worldCenterY - (rectHeight / 2);
    
    const id = generateId();
    const newObject: BoardObject = {
      id,
      type: 'rectangle',
      x: rectX,
      y: rectY,
      width: rectWidth,
      height: rectHeight,
      rotation: 0,
      color: '#FF0000', // Bright red for visibility
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: user.uid,
    };
    
    console.log('🟥 Creating rectangle:', {
      id,
      viewport,
      screenCenter: { x: screenCenterX, y: screenCenterY },
      worldCenter: { x: worldCenterX, y: worldCenterY },
      rectPosition: { x: rectX, y: rectY },
      rectSize: { width: rectWidth, height: rectHeight },
      canvasSize: { width: canvasWidth, height: canvasHeight }
    });
    
    console.log('📤 Calling addObject with:', newObject);
    
    addObject(newObject)
      .then(() => {
        console.log('✅ Rectangle added to Firestore successfully');
        setSelectedObjectId(id);
      })
      .catch((err) => {
        console.error('❌ Failed to add rectangle to Firestore:', err);
      });
  }, [addObject, user, viewport]);

  const handleCanvasClick = useCallback(() => {
    // Clicking empty canvas deselects
    setSelectedObjectId(null);
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
        setEditingObject(null);
      }
    },
    [editingObject, updateObject]
  );

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      lastPointerRef.current = { x, y };
      updateCursor(x, y);
    },
    [updateCursor]
  );

  return (
    <div className="board-container">
      <Toolbar
        onAddRectangle={handleAddRectangle}
        onLogout={logout}
      />
      <PresenceBar onlineUsers={onlineUsers} />
      <div className="canvas-area" style={{ position: 'relative' }}>
        <Canvas
          objects={objects}
          onObjectUpdate={handleObjectUpdate}
          onObjectDelete={handleObjectDelete}
          onCanvasClick={handleCanvasClick}
          remoteCursors={cursors}
          onMouseMove={handleMouseMove}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          viewport={viewport}
          setPosition={setPosition}
          zoomAtPoint={zoomAtPoint}
        />
        {editingObject && (
          <TextEditor
            x={editingObject.x}
            y={editingObject.y}
            width={editingObject.width}
            height={editingObject.height}
            text={editingObject.text}
            onSubmit={handleTextSubmit}
            onCancel={() => setEditingObject(null)}
          />
        )}
      </div>
    </div>
  );
}
