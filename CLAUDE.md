# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All frontend commands run from the `CollabBoard/` subdirectory:

```bash
cd CollabBoard

npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm test -- Canvas.test.tsx   # Run a single test file by name
```

Firebase rules deployment (from repo root):
```bash
firebase deploy --only database    # Realtime Database rules
firebase deploy --only firestore   # Firestore rules
```

## Architecture

CollabBoard is a real-time collaborative whiteboard. The frontend is a React 19 + TypeScript SPA built with Vite, located in the `CollabBoard/` subdirectory. The repo root contains Firebase configuration (rules, hosting, cloud functions).

### Two Firebase backends serve different purposes

- **Cloud Firestore** (`firebase/firestore.ts`): Persistent storage for board objects at `/boards/{boardId}/objects`. This is the source of truth for shapes and their properties.
- **Firebase Realtime Database** (`firebase/rtdb.ts`): Ephemeral real-time data — cursors, presence, live transforms, and live text editing. Data here is transient and auto-cleaned on disconnect.

### Canvas rendering with Konva

The canvas uses Konva.js (`react-konva`). The component hierarchy is:
- `Board.tsx` — top-level coordinator, wires hooks together and manages selection state
- `Canvas.tsx` — Konva `Stage`/`Layer`, handles drawing, drag-drop from sidebar, and broadcasts transforms/editing to RTDB
- Shape components (`StickyNote.tsx`, `Rectangle.tsx`) — individual Konva shape renderers

### Real-time collaboration via custom hooks

Each collaboration concern has a dedicated hook that reads/writes Firebase RTDB:
- `useCursors` — mouse position broadcast (30ms throttle)
- `usePresence` — online/offline status with `onDisconnect` cleanup
- `useLiveTransforms` — shape drag/resize/rotate broadcast (50ms throttle)
- `useLiveEditing` — text editing broadcast for sticky notes

All hooks filter out the current user's own data from the listener results. Remote data is rendered as visual overlays (colored borders, cursor dots with name labels).

### Routing and auth

React Router v7 with two routes: `/` (auth page) and `/board/:boardId` (protected). The `useAuth` hook wraps Firebase Auth (email/password). `ProtectedRoute` redirects unauthenticated users.

### Conflict resolution

Last-write-wins. No OT or CRDT. Simultaneous edits to the same object result in the last Firestore `updateDoc` winning. See `CONFLICTS.md` for details.

### Type definitions

All shared types are in `src/types/index.ts`: `BoardObject`, `CursorData`, `PresenceData`, `LiveTransformData`, `LiveEditingData`, `AppUser`.

## Testing

Tests use Vitest with jsdom environment and React Testing Library. Test files live alongside source in `__tests__/` directories. Firebase is fully mocked in tests — no real Firebase calls. The test setup file is `src/test/setup.ts`.
