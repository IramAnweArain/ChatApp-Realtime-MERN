const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    status: { type: String, default: "Offline", enum: ["Online", "Offline", "Away"] },
    lastSeen: { type: Date, default: Date.now },
    avatar: { type: String, default: "" }, // For future avatar feature
    bio: { type: String, default: "", maxlength: 100 }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);