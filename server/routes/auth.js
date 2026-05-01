const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const bcrypt = require('bcryptjs');

// Input validation helper
const validateInput = (username, password) => {
    const errors = [];

    if (!username || username.trim().length < 3) {
        errors.push('Username must be at least 3 characters long');
    }

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push('Username can only contain letters, numbers, and underscores');
    }

    return errors;
};

// Get all users (for user list)
router.get('/users', async (req, res) => {
    try {
        const currentUsername = req.query.username?.trim().toLowerCase();
        const users = await User.find({}, 'username status lastSeen').sort({ username: 1 });

        let unreadCounts = {};
        if (currentUsername) {
            const unreadData = await Message.aggregate([
                {
                    $match: {
                        receiver: currentUsername,
                        status: { $ne: 'read' }
                    }
                },
                {
                    $group: {
                        _id: '$sender',
                        count: { $sum: 1 }
                    }
                }
            ]);
            unreadData.forEach(item => {
                unreadCounts[item._id] = item.count;
            });
        }

        const response = users.map(user => ({
            username: user.username,
            status: user.status,
            lastSeen: user.lastSeen,
            unreadCount: unreadCounts[user.username] || 0
        }));

        res.json(response);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// SIGNUP ROUTE
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        const validationErrors = validateInput(username, password);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                msg: 'Validation failed',
                errors: validationErrors
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                msg: 'Registration failed',
                error: 'Username already exists. Please choose a different username.'
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            username: username.trim().toLowerCase(),
            password: hashedPassword,
            status: 'Online'
        });
        await newUser.save();

        res.status(201).json({
            msg: 'Account created successfully! You can now log in.',
            username: newUser.username
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            msg: 'Registration failed',
            error: 'An unexpected error occurred. Please try again.'
        });
    }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                msg: 'Login failed',
                error: 'Please provide both username and password.'
            });
        }

        const user = await User.findOne({ username: username.trim().toLowerCase() });
        if (!user) {
            return res.status(401).json({
                msg: 'Login failed',
                error: 'Invalid username or password.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                msg: 'Login failed',
                error: 'Invalid username or password.'
            });
        }

        // Update user status to online
        await User.findByIdAndUpdate(user._id, {
            status: 'Online',
            lastSeen: new Date()
        });

        res.json({
            userId: user._id,
            username: user.username,
            status: 'Online'
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            msg: 'Login failed',
            error: 'An unexpected error occurred. Please try again.'
        });
    }
});

// LOGOUT ROUTE
router.post('/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        if (userId) {
            await User.findByIdAndUpdate(userId, {
                status: 'Offline',
                lastSeen: new Date()
            });
        }
        res.json({ msg: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

module.exports = router;