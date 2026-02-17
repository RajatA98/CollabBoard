# Conflict Resolution: Last-Write-Wins

This document describes how CollabBoard handles simultaneous edits when multiple users modify the same content.

## Strategy

**Last-write-wins.** No operational transform (OT) or CRDT is used. When two users change the same object, the last successful write to the backend overwrites any previous value.

## Implementation

### Firestore Objects

Board objects (stickies, rectangles) are stored in Firestore. Updates use `updateDoc`, which merges the provided fields with the existing document.

- If User A and User B edit the same sticky note and both submit (blur or Enter), whichever `updateDoc` completes last determines the persisted text.
- Same applies to position, size, rotation, and color changes: the last write wins.
- Firestore provides no built-in conflict detection or merge semantics for concurrent updates.

### Live Editing (RTDB)

While a user is typing, their text is streamed to Firebase Realtime Database at `boards/{boardId}/editing/{userId}`. This is ephemeral and is removed when the user blurs or disconnects.

- Each user has at most one editing entry (one objectId at a time).
- If two users type in the same sticky, only one live typing stream is shown on other clients (`remoteEditingByObjectId` maps objectId to a single entry).
- On submit, the text is written to Firestore; last-write-wins applies as above.

### Live Transforms (RTDB)

Drag, resize, and rotate are broadcast to RTDB at `boards/{boardId}/transforms/{userId}`. On transform end, the final state is written to Firestore.

- Same pattern: one live transform per user; last write to Firestore wins if two users transform the same object.

## Rationale

- Simplicity: no need for OT/CRDT libraries or custom merge logic.
- Predictability: the final state is always the last successful write.
- Acceptable for many collaborative whiteboard use cases where occasional overwrites are tolerable.

## Limitations

- Simultaneous edits to the same object result in one user's changes being overwritten.
- There is no conflict UI or warning when overwrites occur.
- For highly contentious editing (e.g., many users editing the same note), consider future enhancements such as locking or richer merge strategies.
