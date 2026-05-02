# 💬 ChatApp: Real-Time One-to-One Messaging

A modern full-stack chat application built with **React**, **Express**, **Socket.io**, and **MongoDB**. This project demonstrates a complete real-time messaging workflow with private rooms, live presence, read receipts, profile photo upload, and responsive UI.

---

## 🚀 Project Summary

ChatApp is a developer-focused real-time communication platform built to showcase production-style functionality:

- **Private one-to-one chat rooms**
- **Realtime messaging** and socket-driven updates
- **Online/offline presence** with live `last seen` updates
- **Read receipts** and message lifecycle statuses
- **Persistent MongoDB chat history**
- **Local DP upload** for profile pictures
- **Responsive mobile-friendly UI** with clean chat input styling

---

## 🧱 Architecture

The repository is composed of two separate applications:

- `server/` — Backend API and Socket.io server
- `client/` — React frontend application

Data flows from the frontend to the backend through REST APIs and Socket.io events.

---

## 🧪 Tech Stack

- **React** for the SPA frontend
- **Socket.io** for realtime messaging and presence
- **Express** for REST API routing
- **MongoDB + Mongoose** for data persistence
- **bcryptjs** for password hashing
- **Axios** for HTTP requests
- **Create React App** for frontend tooling

---

## ✅ Key Features

- One-to-one private chat rooms
- Realtime typing indicators
- Live online/offline presence and last seen timestamps
- Message status tracking: `sent`, `delivered`, `read`
- Persistent chat history and unread counts
- Local profile photo uploads per user
- Responsive mobile layout with clean message input
- Browser push notifications for hidden tab messages

---

## 📁 Project Structure

```
realtime-chat/
├── client/          # React client application
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── server/          # Backend server and sockets
│   ├── models/
│   │   ├── Message.js
│   │   └── User.js
│   ├── routes/
│   │   └── auth.js
│   ├── index.js
│   └── package.json
├── package.json     # monorepo helper scripts
└── README.md
```

---

## 🚀 Getting Started

### Local Development

1. Open the project root in your terminal.
2. Install dependencies:
   - `npm install`
   - `npm --prefix server install`
   - `npm --prefix client install`
3. Start the backend:
   - `npm --prefix server run dev`
4. Start the frontend:
   - `npm --prefix client start`
5. Visit `http://localhost:3000`

### Environment Notes

- Backend defaults to port `5001`.
- Client uses `REACT_APP_API_URL` / `REACT_APP_SOCKET_URL` when defined.

---

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` — create a new account
- `POST /api/auth/login` — authenticate a user
- `POST /api/auth/logout` — mark a user as offline
- `GET /api/auth/users` — list users with status and unread counts

### Messages

- `GET /api/messages/:userId/:otherUserId` — fetch conversation history
- `PUT /api/messages/read/:senderId/:receiverId` — mark conversation as read

---

## 🔧 Socket.io Events

- `join` — connect user and broadcast presence
- `join_room` — join the one-to-one room for a specific conversation
- `send_private_message` — emit a new chat message
- `receive_private_message` — receive a message in real time
- `typing_start` / `typing_stop` — realtime typing indicators
- `mark_messages_read` — bulk update conversation read status
- `message_read` — message-level read acknowledgement
- `user_status_update` — realtime presence data
- `online_users_update` — current online user list

---

## 📌 Implementation Highlights

### Backend: Server and Realtime Logic

- `server/index.js` initializes Express, applies CORS, and sets up Socket.io.
- `onlineUsersMap` tracks socket connections per username.
- `getRoomId()` generates deterministic private room names using both usernames.
- Realtime presence updates are emitted on `join` and `disconnect`.
- Message delivery status is updated in MongoDB and emitted back to the sender/receiver.

### Database Models

- `server/models/User.js`
  - username, password, status, lastSeen, avatar, bio
- `server/models/Message.js`
  - sender, receiver, roomId, message, messageType, status, timestamp, reactions

### Authentication API

- `server/routes/auth.js` supports registration, login, logout, and user listing.
- Passwords are hashed with `bcryptjs`.
- User list returns unread counts via aggregation.

### Frontend: React Chat Client

- `client/src/App.js` handles authentication, user state, socket events, and chat rendering.
- Local DP upload uses browser `localStorage` per username.
- Realtime client logic handles:
  - incoming messages
  - online/offline presence
  - typing indicators
  - message read receipts
  - message reactions

### Frontend Styling

- `client/src/App.css` provides modern dark/light theming, responsive mobile layout, and polished chat controls.
- Mobile view includes a responsive sidebar and full-width chat input.

---

## 📌 Notes and Constraints

- DP upload is currently client-side only and stored in browser localStorage.
- Online/offline presence is real-time while connected; disconnect events update `lastSeen`.
- This version is optimized for demonstration and local deployment.

---

## 📎 Useful References

- React: https://reactjs.org/
- Socket.io: https://socket.io/
- Express: https://expressjs.com/
- MongoDB: https://www.mongodb.com/
- Mongoose: https://mongoosejs.com/
- bcryptjs: https://www.npmjs.com/package/bcryptjs

---

## 📝 Recommended Improvements

- Add persisted avatar uploads on the backend
- Add JWT authentication
- Add group chat support
- Add message search and media sharing
- Add server-side session persistence

---

## 📄 Additional Report

A full technical project report is available in `PROJECT_REPORT.md`.

