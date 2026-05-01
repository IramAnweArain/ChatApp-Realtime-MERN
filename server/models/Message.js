const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    message: { type: String, required: true },
    messageType: { type: String, default: "text", enum: ["text", "image", "file"] },
    status: { type: String, default: "sent", enum: ["sent", "delivered", "read"] },
    timestamp: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    reactions: [{
        user: String,
        emoji: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Message', MessageSchema);