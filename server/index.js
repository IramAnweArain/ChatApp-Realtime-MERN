
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config(); // Ensure this is at the very top
const cors = require('cors');
const http = require('http'); // 1. Built-in Node tool
const { Server } = require('socket.io'); // 2. Import Socket.io
const Message = require('./models/Message'); // Import the blueprint
const User = require('./models/User'); // Import User model

const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

const normalizeOrigin = (value) => (value || "").trim().replace(/\/+$/, '');

const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:3000,http://localhost:3001")
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes('*')) return true;
    const normalizedOrigin = normalizeOrigin(origin);
    return allowedOrigins.includes(normalizedOrigin);
};

// Return a clear error instead of crashing to 500
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (isOriginAllowed(origin)) return next();
    return res.status(403).json({
        msg: 'CORS blocked',
        origin: normalizeOrigin(origin),
    });
});

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use('/api/auth', authRoutes); // This tells the server to use our new routes

// Health check for Railway / load balancers
app.get('/health', (req, res) => {
    const dbState = mongoose.connection?.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
    res.status(200).json({
        ok: true,
        dbReadyState: dbState,
        dbName: mongoose.connection?.db?.databaseName,
    });
});

// Track online users
const onlineUsersMap = new Map(); // username -> socket.id
const typingUsers = new Map(); // username -> Set of users they're typing to

const getRoomId = (userA, userB) => {
    if (!userA || !userB) return null;
    return [userA, userB].sort().join('_');
};

// Get Messages Route - Updated for one-to-one chat
app.get('/api/messages/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: otherUserId },
                { sender: otherUserId, receiver: userId }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Mark messages as read
app.put('/api/messages/read/:senderId/:receiverId', async (req, res) => {
    try {
        await Message.updateMany(
            { sender: req.params.senderId, receiver: req.params.receiverId, status: { $ne: 'read' } },
            { status: 'read' }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Create a Server "Wrapper"
const server = http.createServer(app); 

// Initialize Socket.io on top of our server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// --- DATABASE CONNECTION (MongoDB Atlas) ---
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌ Missing MongoDB connection string. Set MONGODB_URI (preferred) or MONGO_URI in your environment.");
    process.exit(1);
}

const connectWithRetry = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            dbName: process.env.MONGODB_DB_NAME || undefined,
            serverSelectionTimeoutMS: 15000,
        });
        const dbName = mongoose.connection?.db?.databaseName;
        console.log(`✅ MongoDB Connected${dbName ? ` (db: ${dbName})` : ""}`);
    } catch (err) {
        console.error("❌ DB Error:", err);
        console.log("🔁 Retrying MongoDB connection in 5s...");
        setTimeout(connectWithRetry, 5000);
    }
};
connectWithRetry();

// Start server immediately (Railway requires a bound PORT)
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// --- SOCKET.IO LOGIC (The "Phone Call") ---
io.on('connection', (socket) => {
    console.log(`⚡ User Connected: ${socket.id}`);

    // User joins with their username
    socket.on('join', async (username) => {
        socket.username = username;
        onlineUsersMap.set(username, socket.id);

        // Update user status in database
        await User.findOneAndUpdate({ username }, {
            status: 'Online',
            lastSeen: new Date()
        });

        // Broadcast updated online users list
        io.emit('online_users_update', Array.from(onlineUsersMap.keys()));
        io.emit('user_status_update', {
            username,
            status: 'Online',
            lastSeen: new Date()
        });

        console.log(`${username} is now online`);
    });

    // User joins a private room for a one-to-one chat
    socket.on('join_room', ({ sender, receiver }) => {
        const roomId = getRoomId(sender, receiver);
        if (!roomId) return;
        socket.join(roomId);
        console.log(`${sender} joined room ${roomId}`);
    });

    // Listen for private message
    socket.on('send_private_message', async (data) => {
        console.log("Private Message Received:", data);

        try {
            const roomId = getRoomId(data.sender, data.receiver);
            if (!roomId) return;

            // 1. Save the message to the database
            const newMessage = new Message({
                sender: data.sender,
                receiver: data.receiver,
                roomId,
                message: data.text,
                status: 'sent'
            });

            await newMessage.save();

            const receiverSocketId = onlineUsersMap.get(data.receiver);
            const messagePayload = {
                ...data,
                _id: newMessage._id,
                roomId,
                message: newMessage.message,
                timestamp: newMessage.timestamp,
                status: receiverSocketId ? 'delivered' : 'sent'
            };

            // 2. Send back to sender for confirmation
            socket.emit('message_sent', messagePayload);

            // 3. Emit to receiver via room when available, otherwise directly
            if (receiverSocketId) {
                const receiverSocket = io.sockets.sockets.get(receiverSocketId);
                if (receiverSocket && receiverSocket.rooms.has(roomId)) {
                    socket.to(roomId).emit('receive_private_message', messagePayload);
                } else {
                    io.to(receiverSocketId).emit('receive_private_message', messagePayload);
                }

                await Message.findByIdAndUpdate(newMessage._id, { status: 'delivered' });
            }
        } catch (err) {
            console.error('Message save error:', err);
            socket.emit('message_error', { error: 'Failed to send message' });
        }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
        const { sender, receiver } = data;
        if (!typingUsers.has(receiver)) {
            typingUsers.set(receiver, new Set());
        }
        typingUsers.get(receiver).add(sender);

        const roomId = getRoomId(sender, receiver);
        const receiverSocketId = onlineUsersMap.get(receiver);
        if (receiverSocketId) {
            const receiverSocket = io.sockets.sockets.get(receiverSocketId);
            if (receiverSocket && receiverSocket.rooms.has(roomId)) {
                socket.to(roomId).emit('user_typing', {
                    userId: sender,
                    isTyping: true
                });
            } else {
                io.to(receiverSocketId).emit('user_typing', {
                    userId: sender,
                    isTyping: true
                });
            }
        }
    });

    socket.on('typing_stop', (data) => {
        const { sender, receiver } = data;
        if (typingUsers.has(receiver)) {
            typingUsers.get(receiver).delete(sender);

            const roomId = getRoomId(sender, receiver);
            const receiverSocketId = onlineUsersMap.get(receiver);
            if (receiverSocketId) {
                const receiverSocket = io.sockets.sockets.get(receiverSocketId);
                if (receiverSocket && receiverSocket.rooms.has(roomId)) {
                    socket.to(roomId).emit('user_typing', {
                        userId: sender,
                        isTyping: false
                    });
                } else {
                    io.to(receiverSocketId).emit('user_typing', {
                        userId: sender,
                        isTyping: false
                    });
                }
            }
        }
    });

    // Mark messages as read
    socket.on('mark_messages_read', async (data) => {
        const { senderId, receiverId } = data;
        try {
            await Message.updateMany(
                { sender: senderId, receiver: receiverId, status: { $ne: 'read' } },
                { status: 'read' }
            );

            // Notify sender that messages were read
            const senderSocketId = onlineUsersMap.get(senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages_read', { readerId: receiverId });
            }
        } catch (err) {
            console.error('Mark as read error:', err);
        }
    });

    // Client acknowledges reading a single message
    socket.on('message_read', async (data) => {
        const { messageId, senderId, receiverId } = data;
        try {
            const updated = await Message.findByIdAndUpdate(messageId, { status: 'read' }, { new: true });
            if (updated) {
                const senderSocketId = onlineUsersMap.get(senderId);
                if (senderSocketId) {
                    io.to(senderSocketId).emit('messages_read', { readerId: receiverId, messageId });
                }
            }
        } catch (err) {
            console.error('Message read error:', err);
        }
    });

    // Add reaction to message
    socket.on('add_reaction', async (data) => {
        const { messageId, userId, emoji } = data;
        try {
            const message = await Message.findById(messageId);
            if (message) {
                // Remove existing reaction from this user
                message.reactions = message.reactions.filter(r => r.user !== userId);
                // Add new reaction
                message.reactions.push({ user: userId, emoji });
                await message.save();

                // Notify both sender and receiver
                const senderSocketId = onlineUsersMap.get(message.sender);
                const receiverSocketId = onlineUsersMap.get(message.receiver);

                const reactionData = { messageId, userId, emoji };
                if (senderSocketId) io.to(senderSocketId).emit('reaction_added', reactionData);
                if (receiverSocketId) io.to(receiverSocketId).emit('reaction_added', reactionData);
            }
        } catch (err) {
            console.error('Reaction error:', err);
        }
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            onlineUsersMap.delete(socket.username);

            // Clear typing indicators
            typingUsers.forEach((users, receiver) => {
                if (users.has(socket.username)) {
                    users.delete(socket.username);
                    const receiverSocketId = onlineUsersMap.get(receiver);
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('user_typing', {
                            userId: socket.username,
                            isTyping: false
                        });
                    }
                }
            });

            // Update user status in database
            const lastSeenValue = new Date();
            await User.findOneAndUpdate({ username: socket.username }, {
                status: 'Offline',
                lastSeen: lastSeenValue
            });

            // Broadcast updated online users list
            io.emit('online_users_update', Array.from(onlineUsersMap.keys()));
            io.emit('user_status_update', {
                username: socket.username,
                status: 'Offline',
                lastSeen: lastSeenValue
            });

            console.log(`${socket.username} disconnected`);
        }
        console.log('❌ User Disconnected');
    });
});

// server.listen moved to DB connect success handler