# Logout Fix: Remove User Presence on Logout

## Problem

When users logged out of CollabBoard, their presence and cursor data remained in Firebase Realtime Database, causing them to appear as still online to other users. Even after initial fixes, there was a race condition where:
1. Cleanup would remove presence/cursor data
2. But then presence would reappear momentarily due to async operations and React re-renders

## Root Cause

Multiple issues:
1. The Firebase RTDB `onDisconnect` handlers only trigger when the connection is lost (not during explicit logout)
2. Async cleanup in React effect cleanup functions wasn't completing before the component unmounted
3. Race conditions: cleanup operations happened too late or were followed by unexpected re-renders that re-added presence

## Solution

Modified the presence and cursor hooks to explicitly clean up user data when the user logs out:

### Changes Made

1. **`firebase/rtdb.ts`**
   - Added `cleanupUserData()` function to remove both presence and cursor data for a user

2. **`hooks/usePresence.ts`**
   - Added `currentUserRef` to track the current user's board ID and user ID
   - Added `isCleaningUpRef` flag to prevent re-adding presence during cleanup
   - **Exposed `cleanupPresence()` function** that can be called explicitly before logout
   - Effect cleanup function also calls cleanup to handle unexpected unmounts
   - Prevents setting presence if cleanup is in progress

3. **`hooks/useCursors.ts`**
   - Added `currentUserRef` to track the current user's board ID and user ID
   - Added `isCleaningUpRef` flag to prevent cursor updates during cleanup
   - **Exposed `cleanupCursor()` function** that can be called explicitly before logout
   - Effect cleanup function also calls cleanup to handle unexpected unmounts
   - `updateCursor()` checks cleanup flag and ignores updates during cleanup

4. **`components/board/Board.tsx`**
   - Created `handleLogout()` function that:
     - Calls `cleanupPresence()` and `cleanupCursor()` explicitly **BEFORE** logout
     - Waits for both cleanup operations to complete (`await Promise.all()`)
     - Only then calls the actual `logout()` function
   - Passes `handleLogout` to `<Toolbar>` instead of raw `logout`

## How It Works

### Explicit Cleanup Before Logout (Primary Mechanism)

1. User clicks the Logout button in the Toolbar
2. `Board.handleLogout()` is called
3. **BEFORE calling Firebase signOut**:
   - Calls `cleanupPresence()` - removes presence data from RTDB
   - Calls `cleanupCursor()` - removes cursor data from RTDB
   - Sets `isCleaningUpRef.current = true` to block any further updates
   - Waits for both promises to complete (`await Promise.all()`)
4. Only after cleanup completes, calls `logout()` which triggers Firebase signOut
5. Auth state changes, `ProtectedRoute` navigates away
6. Board component unmounts

### Cleanup Flags (Prevent Race Conditions)

- `isCleaningUpRef.current` flag prevents:
  - Re-setting presence in the effect if it tries to run during cleanup
  - Cursor updates via `updateCursor()` during cleanup
  - Multiple cleanup attempts

### Fallback Cleanup (Safety Net)

- Effect cleanup functions still exist as a safety net
- If component unmounts for any reason other than explicit logout, cleanup still runs
- Checks `isCleaningUpRef` to avoid duplicate cleanup

**Key Insight**: By doing explicit cleanup **before** logout (and before auth state changes), we avoid all the race conditions that come from React's async render cycle and Firebase's async auth state changes.

## Testing

### Manual Testing

1. Open CollabBoard in two different browsers
2. Log in as different users in each browser
3. Verify both users appear in the presence bar
4. Log out one user
5. Verify that user disappears from the presence bar immediately in the other browser
6. Verify the cursor for the logged-out user also disappears

### Automated Tests

All existing tests continue to pass:
- ✓ `usePresence.test.ts` - 5 tests
- ✓ `useCursors.test.ts` - 10 tests
- ✓ All component tests that use these hooks

## Benefits

1. **Immediate Cleanup**: Users disappear from presence list instantly on logout
2. **Better UX**: Accurate online user list
3. **Data Hygiene**: No stale presence/cursor data in RTDB
4. **Backwards Compatible**: The `onDisconnect` handlers still work for network disconnections and browser closures

## Console Logs

When a user clicks logout, you'll see these console messages in order:

```
🚪 Board: Logout initiated, cleaning up presence and cursor data
👥 usePresence: Explicitly removing presence for user: <userId>
✅ usePresence: Presence removed successfully
👁️ useCursors: Explicitly removing cursor for user: <userId>
✅ useCursors: Cursor removed successfully
🚪 Board: Cleanup complete, proceeding with logout
```

Then, after the component unmounts:

```
👥 usePresence: Cleaning up presence listener and removing presence data
👥 usePresence: Already cleaning up
👁️ useCursors: Cleaning up cursor listener and removing cursor data
👁️ useCursors: Already cleaning up
```

Note the "Already cleaning up" messages - this shows the flag is working to prevent duplicate cleanup attempts.

## Edge Cases Handled

1. **Race condition: presence reappearing**: Cleanup happens **synchronously** before logout, with flags preventing re-adds
2. **Rapid logout**: Even if user clicks logout immediately, cleanup completes before auth state changes
3. **Component unmount for any reason**: Works not just for logout, but any scenario where the Board component unmounts
4. **User switching boards**: If the user navigates to a different board, the old presence/cursor is cleaned up properly
5. **Network disconnection**: The existing `onDisconnect` handlers still work as a fallback for unexpected disconnections
6. **Duplicate cleanup attempts**: The `isCleaningUpRef` flag prevents multiple cleanup operations from running simultaneously

## The Race Condition Fix

**Previous Issue**: 
1. User clicks logout
2. Cleanup starts (async)
3. Component starts unmounting
4. BUT: Firebase auth state hasn't changed yet, so `user` is still defined
5. Effect might re-run with stale data
6. Presence gets re-added
7. Component finishes unmounting before cleanup completes

**New Solution**:
1. User clicks logout
2. `handleLogout()` calls cleanup functions **synchronously**
3. Sets `isCleaningUpRef.current = true` **immediately**
4. Any effect re-runs are blocked by the flag
5. Waits for cleanup promises to complete
6. **Only then** calls Firebase signOut
7. Auth state changes, navigation happens
8. Component unmounts (cleanup already done, flag prevents duplicates)
