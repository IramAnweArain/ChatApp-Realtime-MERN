# 💬 ChatApp: Real-Time One-to-One Messaging
A full-stack chat application built with React, Express, Socket.io, and MongoDB.

## 🔧 Features
- One-to-one private chat rooms for direct user conversations
- Real-time typing indicators
- Online/offline presence with last seen timestamps
- Message read receipts
- Persistent chat history stored in MongoDB
- Emoji reactions and browser notifications
- Secure account registration and login

## 🧱 Project Structure
- `server/` — Express API, Socket.io server, MongoDB models, authentication routes
- `client/` — React UI with real-time socket interactions and chat experience

## 🚀 Local Setup
1. Open the workspace root:
   - `c:\Users\A R Y\Downloads\realtime-chat`
2. Install dependencies:
   - `npm install`
   - `npm --prefix server install`
   - `npm --prefix client install`
3. Start backend:
   - `npm --prefix server run dev`
4. Start frontend:
   - `npm --prefix client start`
5. Open the app in your browser at `http://localhost:3000`

## 🧠 How It Works
- The frontend logs in users and connects to Socket.io.
- When a user selects another user, the app creates a private one-to-one room.
- Messages are saved to MongoDB and delivered in real time.
- Read receipts update as users see new messages.
- The sidebar shows online status and unread message counts.

## 🛠️ Notes
- The server runs on port `5001` by default.
- The client connects to the backend URL using `socket.io-client`.
- If you change backend ports, update `client/src/App.js` or set `REACT_APP_API_URL` / `REACT_APP_SOCKET_URL` accordingly.

