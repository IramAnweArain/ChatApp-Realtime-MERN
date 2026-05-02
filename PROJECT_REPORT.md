# Project Report: ChatApp - Real-Time One-to-One Messaging

## 1. Executive Summary

ChatApp is a real-time one-to-one messaging platform built to demonstrate a complete full-stack communication solution.
The application combines React for the frontend, Express and Socket.io for the backend, and MongoDB via Mongoose for persistence.

This report documents the system architecture, data model, realtime flows, authentication, UI behavior, and technical implementation details.

---

## 2. Purpose and Goals

The primary goal of ChatApp is to showcase the following capabilities:

- Real-time chat with instant delivery and status updates
- One-to-one private rooms using deterministic room keys
- Live user presence and last-seen activity
- Persistent history with MongoDB storage
- Read receipts and typing indicators
- Responsive UI with mobile-friendly chat experience
- Secure authentication with hashed passwords
- Local DP upload support for avatars

This project is intended as a portfolio-level demonstration of building modern realtime applications.

---

## 3. System Architecture

### 3.1 High-Level View

The system is separated into two applications:

- **Frontend (`client/`)**: React app that manages authentication, UI state, socket connections, and message rendering.
- **Backend (`server/`)**: Express server with REST API routes and Socket.io realtime engine.

The backend manages the database and socket events, while the frontend consumes APIs and listens for realtime updates.

### 3.2 Data Flow

1. Client authenticates via REST API.
2. Client establishes a Socket.io connection.
3. Client emits `join` to register online status.
4. Clients use `send_private_message` to send chat payloads.
5. Server saves messages to MongoDB and delivers them via Socket.io.
6. Presence, typing, and read status are broadcast in realtime.

---

## 4. Backend Implementation

### 4.1 Entry Point: `server/index.js`

The server file performs the following responsibilities:

- Loads environment variables with `dotenv`.
- Configures Express middleware with JSON parsing and CORS.
- Registers the auth router under `/api/auth`.
- Implements a health check endpoint at `/health`.
- Connects to MongoDB with retry logic.
- Initializes Socket.io with allowed origins.
- Listens for socket events and manages realtime state.

### 4.2 CORS and Security

CORS is configured to allow frontend origins from environment variables or defaults to `http://localhost:3000` and `http://localhost:3001`.
The server also performs origin validation before allowing requests.

### 4.3 Socket State Management

The server tracks active users with:

- `onlineUsersMap`: maps username to socket ID
- `typingUsers`: maps receiver username to a `Set` of senders who are typing

This enables targeted event delivery and realtime presence updates.

### 4.4 Realtime Room Logic

The helper `getRoomId(userA, userB)` creates a deterministic room name by sorting the usernames and joining them with `_`.
This ensures that any pair of users share the same private room regardless of sender/receiver order.

### 4.5 Message Persistence and Delivery

When `send_private_message` arrives:

- The backend creates a new `Message` document with `sender`, `receiver`, `roomId`, `message`, and `status: 'sent'`.
- It saves the message to MongoDB.
- It emits `message_sent` back to the sender for UI confirmation.
- If the recipient is online, it emits `receive_private_message` and updates the stored status to `delivered`.

### 4.6 Presence and Last Seen

- On `join`, the server updates the user status to `Online` and broadcasts `online_users_update` and `user_status_update`.
- On `disconnect`, it updates the user's status to `Offline`, records `lastSeen`, and broadcasts updates.
- This allows the frontend to show live status and last seen timestamps accurately.

### 4.7 Typing Indicators

Typing events are managed using `typing_start` and `typing_stop`.
The server broadcasts `user_typing` either via the private room or directly to the receiver socket.

### 4.8 Read Receipts

Two socket events support read receipts:

- `mark_messages_read`: bulk-mark all messages from a sender to a receiver as read.
- `message_read`: mark an individual message as read.

The server notifies the sender with `messages_read` so the UI can update the message status.

### 4.9 Reactions

The backend supports reactions with `add_reaction`.
It stores one reaction per user per message, replacing any existing reaction from the same user.
It then emits `reaction_added` to both sender and receiver.

---

## 5. Database Models

### 5.1 `server/models/User.js`

The `User` schema includes:

- `username` — unique identifier
- `password` — hashed password
- `status` — `Online`, `Offline`, or `Away`
- `lastSeen` — timestamp for presence
- `avatar` — placeholder field for future backend avatar support
- `bio` — optional user bio text

The model also has timestamps for auditing.

### 5.2 `server/models/Message.js`

The `Message` schema includes:

- `sender` and `receiver`
- `roomId` — deterministic private room key
- `message` — message content
- `messageType` — supports `text`, `image`, `file`
- `status` — `sent`, `delivered`, `read`
- `timestamp`
- `edited` / `editedAt`
- `reactions` — array of emoji reactions with user attribution

This structure supports both chat history and message lifecycle tracking.

---

## 6. Authentication and User API

### 6.1 `register`

The registration flow validates:

- minimum username length of 3
- minimum password length of 6
- alphanumeric/underscore username characters

It hashes passwords using `bcryptjs` and stores the user with initial status `Online`.

### 6.2 `login`

Login validates credentials and returns user data while marking the user as `Online`.

### 6.3 `logout`

Logout updates the user's status to `Offline` and records `lastSeen`.

### 6.4 `users`

This route returns all users with:

- username
- online/offline status
- last seen timestamp
- unread message count for the current user

Unread counts are computed using a MongoDB aggregation pipeline.

---

## 7. Frontend Architecture

### 7.1 App Composition

The React frontend is implemented entirely within `client/src/App.js` and `client/src/App.css`.
The app uses React hooks for state management and Socket.io for realtime events.

### 7.2 Key State Variables

- `user` — authenticated user object
- `users` — contact list with status and unread counts
- `selectedUser` — currently active conversation partner
- `messages` — current conversation messages
- `onlineUsers` — current online usernames
- `typingUsers` — currently typing contact IDs
- `avatarUrl` — current user's local profile photo

### 7.3 Realtime Client Logic

The client listens for Socket.io events and updates state accordingly:

- `receive_private_message`
- `message_sent`
- `online_users_update`
- `user_status_update`
- `user_typing`
- `messages_read`
- `reaction_added`

These events drive live UI updates and presence awareness.

### 7.4 Local DP Upload

The avatar upload feature accepts image files and stores them in `localStorage` under `chatapp-avatar-<username>`.
This allows the user to maintain a local profile picture on the current device.

### 7.5 Mobile UI and Responsiveness

The app uses CSS media queries to adjust layout and spacing for smaller screens.
The mobile experience ensures contact items stack vertically and the message input remains accessible.

### 7.6 Notifications

The frontend requests browser notification permission and creates notifications when new messages arrive while the tab is hidden.

---

## 8. Deployment and Execution

### 8.1 Local Development

From repo root:

```bash
npm install
npm --prefix server install
npm --prefix client install
npm --prefix server run dev
npm --prefix client start
```

### 8.2 Production Build

The frontend can be built with:

```bash
npm --prefix client run build
```

The backend server can be started using:

```bash
npm --prefix server start
```

---

## 9. Technical Strengths Demonstrated

This project highlights the following technical capabilities:

- Realtime system design with Socket.io
- REST API development with Express
- MongoDB data modeling and aggregation
- Secure password handling with bcrypt
- React state management and lifecycle
- Responsive UI/UX design
- Local persistence via browser storage
- Debuggable and maintainable architecture

---

## 10. Future Enhancements

Possible next steps for the project:

- Backend avatar persistence and CDN storage
- JWT or OAuth-based authentication
- Group chat rooms and channels
- Message search, edit, and delete support
- File and media attachments
- Better session handling and reconnect logic
- Improved mobile navigation and chat drawer

---

## 11. Conclusion

ChatApp is a solid demonstration of a realtime chat system with professional structure and modern features.
It balances backend realtime mechanics with frontend UX polish, and it is ready for further extension into production-grade communication platforms.
