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
  const { cursors, updateCursor, hideCursor } = useCursors(boardId, user);
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

  console.log('📊 Board state:', { 
    objectCount: objects.length, 
    objects, 
    viewport,
    editingObject: editingObject ? editingObject.id : null 
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

  const handleAddRectangle = useCallback(() => {
    console.log('🔵 Rectangle button clicked!');
    createObjectAtCenter('rectangle');
  }, [createObjectAtCenter]);

  const handleAddStickyNote = useCallback(() => {
    console.log('🟨 Sticky Note button clicked!');
    createObjectAtCenter('sticky');
  }, [createObjectAtCenter]);

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
      console.log('💾 handleTextSubmit called', { text, editingObject });
      if (editingObject) {
        console.log('✅ Saving text to object:', editingObject.id);
        updateObject(editingObject.id, { text });
        setEditingObject(null);
      } else {
        console.error('❌ No editing object found');
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

  const handleObjectDoubleClick = useCallback(
    (obj: BoardObject) => {
      console.log('📝 handleObjectDoubleClick called', { objId: obj.id, type: obj.type });
      
      if (obj.type === 'sticky') {
        console.log('✅ Opening text editor for sticky note', obj);
        
        // Convert world coordinates to screen coordinates for the text editor
        const screenX = obj.x * viewport.scaleX + viewport.x;
        const screenY = obj.y * viewport.scaleY + viewport.y;
        const screenWidth = obj.width * viewport.scaleX;
        const screenHeight = obj.height * viewport.scaleY;
        
        console.log('📍 Editor position:', {
          world: { x: obj.x, y: obj.y, w: obj.width, h: obj.height },
          screen: { x: screenX, y: screenY, w: screenWidth, h: screenHeight },
          viewport
        });
        
        setEditingObject({
          id: obj.id,
          x: screenX,
          y: screenY,
          width: screenWidth,
          height: screenHeight,
          text: obj.text || '',
        });
      } else {
        console.log('ℹ️ Not a sticky note, skipping editor');
      }
    },
    [viewport]
  );

  return (
    <div className="board-container">
      <Toolbar
        onAddRectangle={handleAddRectangle}
        onAddStickyNote={handleAddStickyNote}
        onLogout={logout}
      />
      <PresenceBar onlineUsers={onlineUsers} />
      <div className="canvas-area" style={{ position: 'relative' }}>
        <Canvas
          objects={objects}
          onObjectUpdate={handleObjectUpdate}
          onObjectDelete={handleObjectDelete}
          onCanvasClick={handleCanvasClick}
          onObjectDoubleClick={handleObjectDoubleClick}
          remoteCursors={cursors}
          onMouseMove={handleMouseMove}
          onMouseLeave={hideCursor}
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
