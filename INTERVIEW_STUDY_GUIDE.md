# CollabBoard Interview Study Guide

Quick-reference for explaining CollabBoard's architecture, design patterns, and SWE/AI concepts.

---

## One-Sentence Pitch

CollabBoard is a **real-time collaborative whiteboard** (like a simple Figma/Miro) where multiple users create shapes and sticky notes on an infinite canvas, see each other's cursors live, and use an AI assistant to generate board content.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (Vite SPA) |
| Canvas rendering | Konva.js (HTML5 Canvas via react-konva) |
| Routing | React Router v7 |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Persistent storage | Cloud Firestore |
| Real-time ephemeral data | Firebase Realtime Database (RTDB) |
| Backend functions | Firebase Cloud Functions |
| AI | Claude API (Anthropic SDK) with tool use |
| Observability | Langfuse tracing |
| Testing | Vitest + React Testing Library + Playwright (E2E) |

---

## Architecture Diagram

```
React SPA (Vite)
  ├─ Auth (Firebase Auth)
  ├─ Board (Canvas + Hooks)
  │   ├─ Konva.js Stage/Layer
  │   └─ Custom Hooks ──┬── Firestore (persistent shapes)
  │                      └── RTDB (ephemeral: cursors, presence, transforms)
  └─ Dashboard (board list)

Cloud Functions
  └─ aiCommand ── Claude API (agentic tool-use loop)
```

---

## Key Design Decisions & Interview Talking Points

### 1. Two Firebase Databases

- **Firestore**: Source of truth for board objects (shapes, stickies). Persistent. Uses `onSnapshot` for real-time listeners.
- **RTDB**: Ephemeral data (cursors, presence, live transforms, live editing). Auto-cleaned via `onDisconnect`. Higher frequency, lower latency.

**Why?** Firestore excels at structured, queryable persistent data. RTDB excels at high-frequency, low-latency ephemeral updates (cursor moves 33x/sec).

### 2. Custom Hooks (Separation of Concerns)

Each collaboration feature is a self-contained hook:

| Hook | Concern | Backend |
|---|---|---|
| `useAuth` | Login/logout state | Firebase Auth |
| `useBoardObjects` | Shape CRUD + real-time sync | Firestore |
| `useCursors` | Mouse position broadcast (30ms throttle) | RTDB |
| `usePresence` | Online/offline status | RTDB |
| `useLiveTransforms` | Drag/resize broadcast (50ms throttle) | RTDB |
| `useLiveEditing` | Text typing broadcast | RTDB |
| `useSelection` | Prevent conflicts on same object | RTDB |
| `useViewport` | Pan/zoom (persisted to localStorage) | Local |
| `useUndoRedo` | Command pattern undo/redo | Local |

**Why hooks?** Single Responsibility Principle. Testable in isolation. Keeps `Board.tsx` manageable.

### 3. Last-Write-Wins Conflict Resolution

No OT or CRDT. If two users edit the same object, the last Firestore `updateDoc` wins.

**Trade-off:** Simple but lossy. Acceptable for whiteboards where objects are mostly independent.

### 4. Optimistic Updates

`updateObject` updates local React state immediately, then writes to Firestore async. User sees instant feedback. If Firestore fails, `onSnapshot` syncs correct state back.

### 5. Canvas Rendering (Konva.js)

HTML5 Canvas instead of DOM because hundreds of shapes with transforms (rotate, scale, drag) would be very slow in the DOM. Canvas is GPU-accelerated.

### 6. Coordinate System (World vs Screen)

```
Screen -> World: worldX = (screenX - viewport.x) / viewport.scaleX
World -> Screen: screenX = worldX * viewport.scaleX + viewport.x
```

Infinite canvas achieved by maintaining viewport position + scale, transforming all coordinates.

---

## Design Patterns Used

| Pattern | Where | How |
|---|---|---|
| **Observer** | Firebase listeners (`onSnapshot`, `onValue`, `onAuthStateChanged`) | Components subscribe to data changes, re-render on updates |
| **Pub/Sub** | Cursors, presence, transforms, editing | Each user publishes own data, subscribes to everyone else's |
| **Command** | Undo/Redo (`useUndoRedo`) | Each action stores how to execute and reverse itself |
| **Strategy** | Conflict resolution | Last-write-wins (could swap for OT/CRDT) |
| **Facade** | Firebase service modules (`firestore.ts`, `rtdb.ts`) | Simple API hiding Firebase SDK complexity |
| **Guard (Route Guard)** | `ProtectedRoute` | Checks auth before rendering protected components |
| **Throttle** | Cursor (30ms), transforms (50ms) | Limits high-frequency operations |
| **Agentic Loop** | AI Cloud Function | LLM calls tools in a loop until done |

---

## Data Flow: Creating a Sticky Note

1. User clicks "Sticky Note" in sidebar
2. `Board.tsx` calls `createObjectAtCenter('sticky')`
3. Converts screen center to world coordinates via viewport transform
4. Creates `BoardObject` with unique ID (`Date.now() + random`)
5. `useBoardObjects.addObject()` -> `setDoc` to Firestore
6. Firestore `onSnapshot` fires for ALL connected clients
7. Each client's state updates, React re-renders Canvas
8. Everyone sees the sticky note appear in real-time

---

## AI Agent Architecture

```
User types command
  -> Frontend calls Cloud Function (httpsCallable)
    -> Cloud Function calls Claude API with system prompt + tool definitions
      -> Claude returns tool_use blocks (e.g. createStickyNote)
        -> Cloud Function executes tools (writes to Firestore)
          -> Results sent back to Claude
            -> Claude may call more tools (loop up to 40 iterations)
              -> Final text response returned to frontend
```

**Key concepts:**
- **Tool Use / Function Calling**: LLM generates structured calls to predefined functions
- **Agentic Loop**: Model keeps calling tools until `stop_reason === 'end_turn'`
- **Concurrency Control**: AI lock in RTDB prevents parallel AI runs on same board
- **Cancellation**: `aiCancel` flag in RTDB lets users stop mid-execution

---

## Security

- **Firestore rules**: Authenticated users can read/write board objects. Only creator can delete board metadata.
- **RTDB rules**: Users can only write their own cursor/presence/transform data (`auth.uid === $userId`). All authenticated users can read.
- **Cloud Functions**: Require authentication (`request.auth` check).

---

## Testing Approach

- **Unit tests**: Vitest + React Testing Library + jsdom
- **Firebase mocking**: All Firebase calls mocked in tests (no real backend)
- **Test location**: `__tests__/` directories alongside source
- **E2E tests**: Playwright

---

## Likely Interview Questions & Answers

**Q: How does real-time collaboration work?**
A: Pub/Sub pattern via Firebase. Each user writes their cursor/transform data to the database, and all other clients have listeners that fire on changes. Firebase handles the message bus.

**Q: How do you handle a user closing their browser?**
A: Firebase RTDB `onDisconnect` handlers run server-side to clean up cursor/presence data, even if the browser crashes.

**Q: Why custom hooks instead of Redux?**
A: Firebase already manages shared state. Hooks encapsulate each collaboration concern (cursors, presence, transforms) independently. Redux would add a redundant state layer.

**Q: How would you improve conflict resolution?**
A: For text: use OT or CRDTs for character-level merging. For shapes: add optimistic locking (check `updatedAt` before writing). For critical scenarios: add a conflict UI showing both versions.

**Q: How does the AI feature work?**
A: It's an agentic loop. User's command goes to a Cloud Function, which calls Claude with tool definitions (createShape, moveObject, etc.). Claude decides which tools to call, the function executes them (writes to Firestore), sends results back to Claude, and loops until done. All clients see changes in real-time via Firestore listeners.

**Q: What's throttling and why use it?**
A: Throttling limits function execution frequency. Mouse events fire 60+ times/sec. Writing to a database that fast is wasteful. A 30ms throttle caps it at ~33 updates/sec, which is visually smooth and cost-efficient.

**Q: Canvas vs DOM for rendering?**
A: Canvas (via Konva.js) because hundreds of shapes with transforms (rotate, scale, drag) would be slow in the DOM. Canvas is GPU-accelerated and designed for this. DOM is better for standard UI elements.
