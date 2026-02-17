import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { TextEditor } from './TextEditor';
import { PresenceBar } from './PresenceBar';
import { useAuth } from '../../hooks/useAuth';
import { useBoardObjects } from '../../hooks/useBoardObjects';
import { useCursors } from '../../hooks/useCursors';
import { usePresence } from '../../hooks/usePresence';
import type { BoardObject } from '../../types';

const STICKY_COLORS = ['#FFE066', '#FF6B6B', '#51CF66', '#339AF0', '#CC5DE8', '#FF922B'];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function Board() {
  const { boardId = 'default' } = useParams();
  const { user, logout } = useAuth();
  const { objects, addObject, updateObject, deleteObject } = useBoardObjects(boardId);
  const { cursors, updateCursor } = useCursors(boardId, user);
  const { onlineUsers } = usePresence(boardId, user);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObject, setEditingObject] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  } | null>(null);

  const handleCanvasClick = useCallback(
    (worldX: number, worldY: number) => {
      if (!user) return;

      if (activeTool === 'sticky') {
        const newObject: BoardObject = {
          id: generateId(),
          type: 'sticky',
          x: worldX,
          y: worldY,
          width: 150,
          height: 100,
          rotation: 0,
          text: '',
          color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
        addObject(newObject);
        setActiveTool('select');
      } else if (activeTool === 'rectangle') {
        const newObject: BoardObject = {
          id: generateId(),
          type: 'rectangle',
          x: worldX,
          y: worldY,
          width: 200,
          height: 150,
          rotation: 0,
          color: '#E8E8E8',
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user.uid,
        };
        addObject(newObject);
        setActiveTool('select');
      }
    },
    [activeTool, user, addObject]
  );

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
      updateCursor(x, y);
    },
    [updateCursor]
  );

  return (
    <div className="board-container">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
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
