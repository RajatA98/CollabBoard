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
| Payments | Stripe (Checkout, Webhooks, Customer Portal) |
| AI | Claude API (Anthropic SDK) with tool use |
| Observability | Langfuse tracing |
| Testing | Vitest + React Testing Library + Playwright (E2E) |

---

## Architecture Diagram

```
React SPA (Vite)
  ├─ Landing Page (marketing, public)
  ├─ Auth (Firebase Auth: email/password + Google OAuth)
  ├─ Dashboard (board list + profile panel)
  ├─ Board (Canvas + Hooks)
  │   ├─ Konva.js Stage/Layer (shapes, pen strokes, cursors)
  │   └─ Custom Hooks ──┬── Firestore (persistent shapes + user docs)
  │                      └── RTDB (ephemeral: cursors, presence, transforms)
  └─ Subscription (Stripe checkout/portal flows)

Cloud Functions
  ├─ aiCommand ── Claude API (agentic tool-use loop)
  ├─ createCheckoutSession ── Stripe Checkout
  ├─ createPortalSession ── Stripe Customer Portal
  └─ stripeWebhook ── Stripe event handler → Firestore user doc updates
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
| `useSubscription` | Stripe tier, AI usage count, billing status | Firestore `/users/{uid}` |

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

### 7. Stripe Subscription Billing

**Two tiers:** Free (3 AI commands/day) vs Pro ($9.99/month, unlimited).

**Data model:** `UserDoc` in Firestore `/users/{uid}`:
```
{ subscriptionTier: 'free'|'pro', aiCommandCount: number, lastResetAt: number,
  stripeCustomerId?: string, subscriptionStatus?: 'active'|'canceling'|'expired'|'past_due' }
```

**Flow:**
1. User clicks "Upgrade" → frontend calls `createCheckoutSession` Cloud Function
2. Function creates Stripe Checkout session → returns URL → frontend redirects
3. User pays on Stripe-hosted page → redirects to `/checkout/success`
4. Stripe sends `checkout.session.completed` webhook → `stripeWebhook` Cloud Function updates `UserDoc.subscriptionTier = 'pro'`
5. Frontend's `useSubscription` hook listens to `UserDoc` via `onSnapshot` → UI updates in real-time

**Webhook events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

**Usage gating:** `aiCommand` Cloud Function checks `aiCommandCount >= 3` for free tier. Daily reset at UTC midnight. Admin users (`custom claim admin: true`) bypass limits.

**Why this matters:** Webhook-driven state sync — Stripe is source of truth for billing, webhooks push state to Firestore, frontend reads Firestore. No polling.

### 8. Freehand Pen Tool & Eraser

**Canvas modes:** `cursor | grab | pen | eraser` — toggled from ShapeSidebar.

- `pen`: mouse down starts stroke, mouse move appends points, mouse up saves `BoardObject` of type `'pen'` to Firestore
- `eraser`: clicking on a pen stroke deletes it
- Points stored as flat array `[x1,y1,x2,y2,...]` in `BoardObject.points` (efficient for Firestore — no nested objects)
- `PenStroke.tsx`: Konva `<Line>` with `lineCap="round"`, `lineJoin="round"`

### 9. Google OAuth & Admin Roles

- `signInWithGoogle()` uses `GoogleAuthProvider` + `signInWithPopup`
- `useAuth` exposes `loginWithGoogle()` and `isAdmin` (from Firebase custom claims)
- Admin claim set via server script `functions/scripts/set-admin-claim.mjs`

### 10. Per-Command AI Concurrency

**Before:** Board-level AI lock — only one AI command per board at a time.
**After:** Each command gets a unique `commandId` tracked at `/boards/{boardId}/aiCommands/{commandId}`. Multiple users can run AI commands concurrently. Cancellation is per-command.

This is a shift from **pessimistic locking** (block everyone) to **per-resource tracking** (track each operation independently).

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
| **Webhook-Driven Sync** | Stripe → Cloud Function → Firestore | External service pushes state changes; frontend reads via listener |

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
- **Per-Command Tracking**: Each command gets a `commandId` in RTDB — multiple commands can run concurrently
- **Cancellation**: Per-command `cancel` flag in RTDB lets users stop individual commands
- **Usage Gating**: Free tier limited to 3 commands/day; Pro tier unlimited

---

## Security

- **Firestore rules**: Authenticated users can read/write board objects. Only creator can delete board metadata. Users can only read/write their own `/users/{uid}` doc.
- **RTDB rules**: Users can only write their own cursor/presence/transform data (`auth.uid === $userId`). All authenticated users can read.
- **Cloud Functions**: Require authentication (`request.auth` check).
- **Stripe webhooks**: Verified via `stripe.webhooks.constructEvent()` with webhook signing secret.
- **Admin role**: Firebase custom claims (`admin: true`) — set server-side, read from ID token.

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

**Q: How does the subscription/payment system work?**
A: Stripe handles all payment processing. When a user upgrades, we create a Stripe Checkout session server-side and redirect them. After payment, Stripe sends a webhook to our Cloud Function, which updates the user's Firestore doc. The frontend listens to that doc via `onSnapshot`, so the UI updates in real-time without polling. This is a webhook-driven state sync pattern.

**Q: How do you handle the pen drawing tool?**
A: Canvas has four modes (cursor, grab, pen, eraser). In pen mode, mouse-down starts a new stroke, mouse-move appends coordinates to a flat array, mouse-up saves the complete stroke as a `BoardObject` with `type: 'pen'` and `points: [x1,y1,x2,y2,...]` to Firestore. The flat array format is more efficient for Firestore than nested objects.

**Q: How do you manage AI usage limits?**
A: Free users get 3 AI commands per day. The Cloud Function checks `aiCommandCount` in the user's Firestore doc before running. Counter resets daily at UTC midnight. After successful execution, the count is incremented atomically via `FieldValue.increment(1)`. Pro users and admins (via Firebase custom claims) bypass the limit entirely.

**Q: What routes does the app have?**
A: `/` = Landing page (public), `/auth` = Login/signup, `/dashboard` = Board list (protected), `/board/:boardId` = Whiteboard (protected), `/checkout/success` and `/checkout/cancel` = Stripe redirect pages (protected).
