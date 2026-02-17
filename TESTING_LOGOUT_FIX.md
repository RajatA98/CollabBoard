# Testing the Logout Presence Fix

## Quick Test

Follow these steps to verify that users are properly removed from presence when they log out:

### Test Setup

1. Open CollabBoard in **two different browsers** (e.g., Chrome and Firefox, or Chrome and Chrome Incognito)
2. Create two test accounts if you haven't already (or use existing accounts)

### Test Steps

1. **Browser 1**: Log in as User A
   - Navigate to a board (e.g., `/board/default`)
   - You should see User A in the presence bar (top of the screen)

2. **Browser 2**: Log in as User B
   - Navigate to the same board (`/board/default`)
   - You should see User B in the presence bar

3. **Verify Both Users Visible**
   - In Browser 1: You should see User B in the presence bar
   - In Browser 2: You should see User A in the presence bar
   - Both users should be visible to each other

4. **Test Logout**
   - In Browser 2: Click the "Logout" button
   - Browser 2 should redirect to the login page

5. **Verify Presence Removed**
   - In Browser 1: User B should **immediately disappear** from the presence bar
   - This should happen within 1-2 seconds

6. **Check Console Logs** (Optional but Recommended)
   - Open Browser 2's Developer Console (F12)
   - Before clicking logout, keep an eye on the console
   - After clicking logout, you should see:
     ```
     👥 usePresence: Cleaning up presence listener and removing presence data
     👥 usePresence: Removing presence for user: <userId>
     ✅ usePresence: Presence removed successfully
     
     👁️ useCursors: Cleaning up cursor listener and removing cursor data
     👁️ useCursors: Removing cursor for user: <userId>
     ✅ useCursors: Cursor removed successfully
     ```

### What Should Happen

✅ **Expected**: User B disappears from Browser 1's presence bar immediately after logout
❌ **Bug (if still present)**: User B remains in Browser 1's presence bar even after logout

### Additional Tests

#### Test 1: Cursor Removal
1. Before logging out, move the mouse in Browser 2
2. In Browser 1, you should see User B's cursor moving
3. In Browser 2, click logout
4. In Browser 1, User B's cursor should disappear immediately

#### Test 2: Multiple Users
1. Open a third browser with User C
2. Log out User B
3. User C should see User B disappear from the presence bar
4. User A and User C should still see each other

#### Test 3: Rapid Logout
1. Log in User B again
2. As soon as the board loads, immediately click logout
3. User B should not appear in Browser 1's presence bar at all (or disappear instantly)

## Firebase Console Verification

For a more technical verification:

1. Open Firebase Console
2. Go to Realtime Database
3. Navigate to: `boards/{boardId}/presence/`
4. Before logout: You should see entries for both users
5. After logout: The logged-out user's entry should be **removed** (not just marked offline)

## Troubleshooting

If the fix doesn't work:

1. **Clear browser cache**: Hard refresh both browsers (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check Firebase Rules**: Ensure your RTDB rules allow deleting presence data
3. **Check Network Tab**: Look for DELETE or SET operations to Firebase RTDB on logout
4. **Check Console Errors**: Look for any errors in the browser console
5. **Verify Code Changes**: Make sure the updated code is being served (check the file modification times)

## Expected Firebase Operations

When logout occurs, you should see these operations in the Network tab:

1. Firebase Auth sign out
2. Firebase RTDB: Remove presence (DELETE or SET to null)
3. Firebase RTDB: Remove cursor (DELETE or SET to null)
4. Navigation to login page

## Success Criteria

✅ User disappears from presence bar within 1-2 seconds of logout
✅ User's cursor disappears from other users' views
✅ Console logs show successful cleanup
✅ Firebase Realtime Database no longer contains the user's presence/cursor data
