# Collaborator Cursor Testing Instructions

## What Was Changed

### Enhanced Cursor Visualization ✅
- **Larger cursor dot**: Increased from 5px to 8px radius for better visibility
- **Name label with background**: Added semi-transparent colored background behind user names
- **Better contrast**: White text color for name labels
- **Shadow effect**: Added subtle shadow to cursor dots for depth
- **Non-blocking**: Cursors don't interfere with canvas interactions

### Diagnostic Logging Added 🔍
Console logs have been added to trace cursor data flow:
- `👁️ useCursors:` - Logs cursor setup, updates sent/received from Firebase RTDB
- `👁️ Canvas:` - Logs remote cursors rendered in Canvas component
- `📊 Board state:` - Logs cursor count in Board component

## Testing with Two Browsers

### Prerequisites
1. Make sure the dev server is running: `npm run dev`
2. Have two different browsers ready (or use regular + incognito mode)
3. Have two test user accounts created

### Step-by-Step Testing

#### Browser A (First User)
1. Open `http://localhost:5173` in Browser A
2. Log in as User A (e.g., `user1@example.com`)
3. Navigate to a board or use the default board
4. Open browser console (F12 / Cmd+Option+I)
5. Look for these log messages:
   ```
   👁️ useCursors: Setting up cursor tracking for [username] on board [boardId]
   ```

#### Browser B (Second User)
1. Open `http://localhost:5173` in Browser B (or incognito window)
2. Log in as User B (e.g., `user2@example.com`)
3. Navigate to **the same board** as User A
4. Open browser console (F12 / Cmd+Option+I)

### Test Scenarios

#### Test 1: Basic Cursor Visibility
1. **In Browser A**: Move your mouse around the canvas
2. **Check Browser A console**: You should see logs like:
   ```
   👁️ useCursors: Sending cursor update to Firebase RTDB: {x: 123, y: 456, name: "User A", color: "#abc123", ...}
   ```
3. **Check Browser B console**: You should see logs like:
   ```
   👁️ useCursors: Received cursor update from Firebase RTDB: {user-a-id: {x: 123, y: 456, ...}}
   👁️ Canvas: Remote cursors updated: {user-a-id: {...}}
   👁️ Canvas: Number of remote cursors: 1
   ```
4. **In Browser B canvas**: You should see User A's cursor appear as:
   - A colored dot (8px radius)
   - User A's name in a colored label next to the dot
   - The cursor should move smoothly as you move mouse in Browser A

#### Test 2: Bidirectional Cursors
1. **In Browser B**: Move your mouse around the canvas
2. **In Browser A canvas**: You should now see User B's cursor appear
3. **Verify**: Both users can see each other's cursors with different colors

#### Test 3: Color Uniqueness
1. Each user should have a unique, consistent color
2. The cursor dot and name label background should use the same color
3. Colors are generated based on user ID (consistent across sessions)

#### Test 4: Cursor Disconnect
1. **In Browser B**: Close the tab or log out
2. **In Browser A**: User B's cursor should disappear
3. **Check Browser A console**: Cursor count should decrease

#### Test 5: Multiple Collaborators
1. Open a third browser/window (Browser C)
2. Log in as User C and join the same board
3. **Verify**: All three users can see each other's cursors with unique colors

### What to Look For

#### ✅ Success Indicators
- [ ] Remote cursors appear as colored dots with name labels
- [ ] Each user has a unique color
- [ ] Cursors move smoothly (< 50ms latency)
- [ ] Name labels have semi-transparent colored backgrounds
- [ ] White text is readable on colored backgrounds
- [ ] Cursors don't block canvas interactions
- [ ] Cursors disappear when users disconnect
- [ ] Console logs show cursor data flowing through the system

#### ❌ Potential Issues to Report

**If cursors don't appear:**
1. Check browser console for Firebase errors
2. Verify RTDB URL is set in `.env`: `VITE_FIREBASE_DATABASE_URL`
3. Check console logs - are cursor updates being sent?
4. Check console logs - are cursor updates being received?
5. Verify both users are on the **exact same board** (check URL)

**If cursors are jumpy or laggy:**
1. Check network connection
2. Check browser console for throttling warnings
3. Verify Firebase RTDB rules allow read/write

**If colors are hard to see:**
1. Report the specific color values from console logs
2. Note the background color of your canvas

## Diagnostic Information to Collect

If you encounter issues, please provide:
1. **Browser console logs** from both users (copy the full output)
2. **Screenshot** of what you see (or don't see)
3. **Board ID** you're testing with
4. **User IDs/emails** for both test users
5. **Network tab** in DevTools (check for failed Firebase requests)

## Expected Console Output

### When cursor system is working correctly:

**User A moves mouse:**
```
👁️ useCursors: Sending cursor update to Firebase RTDB: {x: 150, y: 200, name: "User A", color: "#ff5733", lastActive: 1234567890}
```

**User B receives update:**
```
👁️ useCursors: Received cursor update from Firebase RTDB: {"user-a-id": {x: 150, y: 200, name: "User A", color: "#ff5733", lastActive: 1234567890}}
👁️ useCursors: Filtered remote cursors (excluding self): {"user-a-id": {...}}
👁️ Canvas: Remote cursors updated: {"user-a-id": {...}}
👁️ Canvas: Number of remote cursors: 1
📊 Board state: {..., remoteCursorCount: 1}
```

## Clean Up After Testing

After verifying cursors work correctly, we'll remove the diagnostic console logs to clean up the output.

## Questions or Issues?

If cursors still don't appear after following these steps, please share:
- Full console logs from both browsers
- Screenshots
- Firebase project settings (check if RTDB is enabled in Firebase Console)
