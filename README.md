# 🎨 CollabBoard

A real-time collaborative whiteboard built with React, TypeScript, Konva, and Firebase.

## ✨ Features

- **Real-time Collaboration**: Multiple users can work on the same board simultaneously
- **Live Cursors**: See other collaborators' cursors with their names in real-time
- **Presence Awareness**: See who's online with colored user avatars
- **Shapes & Sticky Notes**: Add rectangles and sticky notes to your board
- **Transform Tools**: Resize, rotate, and position objects
- **Pan & Zoom**: Navigate large canvases with ease
- **Drag & Drop**: Drag shapes from the sidebar onto the canvas
- **Text Editing**: Double-click sticky notes to edit text
- **Firebase Sync**: All changes sync instantly across all clients

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd CollabBoard
npm install
```

### 2. Deploy Firebase Rules (REQUIRED!)
```bash
cd ..
./deploy-rules.sh
```

This enables real-time cursors and presence by updating Firebase Realtime Database permissions.

### 3. Start Development Server
```bash
cd CollabBoard
npm run dev
```

Open `http://localhost:5173` (or the port shown in terminal)

### 4. Test with Two Browsers
1. Open the app in two different browsers (or one regular + one incognito)
2. Log in as different users in each browser
3. Navigate to the same board
4. Move your mouse - you'll see cursors appear in real-time!

## 📁 Project Structure

```
CollabBoard/
├── src/
│   ├── components/
│   │   ├── auth/          # Authentication components
│   │   └── board/         # Board, Canvas, Shapes, Cursors
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useBoardObjects.ts
│   │   ├── useCursors.ts  # Real-time cursor tracking
│   │   ├── usePresence.ts # User presence tracking
│   │   └── useViewport.ts
│   ├── firebase/          # Firebase configuration
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── database.rules.json    # Firebase RTDB rules
└── firestore.rules        # Firestore security rules
```

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npm test -- RemoteCursor.test.tsx
```

## 🔒 Firebase Setup

### Required Services
- **Firebase Authentication** (Email/Password)
- **Cloud Firestore** (Board objects storage)
- **Realtime Database** (Cursors and presence)

### Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase config:
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_DATABASE_URL=your-rtdb-url  # Required for cursors!
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 🎨 Cursor & Presence Features

### Enhanced Cursors
- **8px colored dots** for high visibility
- **Name labels** with semi-transparent backgrounds
- **Unique colors** per user (consistent across sessions)
- **Smooth movement** with 30ms throttling
- **Auto-cleanup** when users disconnect

### Presence Bar
Shows online users with:
- User count ("2 online")
- Colored avatar circles with initials
- Hover to see full names

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Fast setup guide
- **[FIREBASE_RULES_DEPLOYMENT.md](FIREBASE_RULES_DEPLOYMENT.md)** - Firebase rules deployment
- **[CURSOR_TESTING_INSTRUCTIONS.md](CURSOR_TESTING_INSTRUCTIONS.md)** - Testing guide
- **[CURSOR_FIX_SUMMARY.md](CURSOR_FIX_SUMMARY.md)** - Technical implementation details

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Canvas**: Konva.js + react-konva
- **Backend**: Firebase (Auth, Firestore, Realtime Database)
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library
- **Routing**: React Router v7

## 🐛 Troubleshooting

### Cursors not appearing?
1. Deploy Firebase rules: `./deploy-rules.sh`
2. Refresh both browsers
3. Check browser console for errors
4. Verify users are on the same board URL

### "0 online" shown?
- Same as above - deploy Firebase rules first

### Permission denied errors?
- Run: `firebase deploy --only database`

## 📝 License

MIT

## 👥 Contributors

Built with ❤️ using Test-Driven Development
