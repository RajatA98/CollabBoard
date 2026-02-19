import { useState, useEffect, useCallback } from 'react';
import {
  setSelection as rtdbSetSelection,
  onSelectionsChange,
  setupSelectionDisconnect,
  removeSelection,
} from '../firebase/rtdb';
import { filterRemoteData, hashColor } from '../utils/cursor';
import type { AppUser, SelectionData } from '../types';

/** Map: objectId -> { userId, userName, userColor } for objects selected by other users */
export type RemoteSelectionByObject = Record<
  string,
  { userId: string; userName?: string; userColor?: string }
>;

export function useSelection(boardId: string, user: AppUser | null) {
  const [remoteSelections, setRemoteSelections] = useState<Record<string, SelectionData>>({});
  const [remoteSelectionByObject, setRemoteSelectionByObject] = useState<RemoteSelectionByObject>({});

  useEffect(() => {
    if (!user) return;

    setupSelectionDisconnect(boardId, user.uid);

    const unsubscribe = onSelectionsChange(boardId, (allSelections) => {
      const filtered = filterRemoteData(allSelections, user.uid);
      setRemoteSelections(filtered);

      const byObject: RemoteSelectionByObject = {};
      for (const [uid, data] of Object.entries(filtered)) {
        if (data?.objectId != null) {
          byObject[data.objectId] = {
            userId: uid,
            userName: data.userName,
            userColor: data.userColor,
          };
        }
      }
      setRemoteSelectionByObject(byObject);
    });

    return () => {
      unsubscribe();
    };
  }, [boardId, user]);

  const setLocalSelection = useCallback(
    (objectId: string | null) => {
      if (!user) return;
      if (objectId == null) {
        removeSelection(boardId, user.uid);
        return;
      }
      const data: SelectionData = {
        objectId,
        userName: user.displayName || user.email,
        userColor: hashColor(user.uid),
        lastActive: Date.now(),
      };
      rtdbSetSelection(boardId, user.uid, data);
    },
    [boardId, user]
  );

  const cleanupSelection = useCallback(async () => {
    if (!user) return;
    await removeSelection(boardId, user.uid);
  }, [boardId, user]);

  return {
    remoteSelectionByObject,
    setLocalSelection,
    cleanupSelection,
  };
}
