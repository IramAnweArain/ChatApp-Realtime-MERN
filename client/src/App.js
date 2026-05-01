import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const SOCKET_URL = (process.env.REACT_APP_SOCKET_URL || API_BASE_URL).replace(/\/+$/, '');

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
});

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification
  const showNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'chat-message'
      });
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username: username.trim().toLowerCase(),
        password
      });

      setUser(res.data);
      socket.emit('join', res.data.username);

      // Fetch users list
      await fetchUsers(res.data.username);

    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.msg || "Login failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle register
  const handleRegister = async () => {
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username: username.trim().toLowerCase(),
        password
      });

      setError("✅ " + res.data.msg);
      setTimeout(() => setError(""), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.msg || "Registration failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users list
  const fetchUsers = async (currentUsername = user?.username) => {
    if (!currentUsername) return;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/users`, {
        params: { username: currentUsername }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  // Fetch messages for selected user
  const fetchMessages = async (otherUserId) => {
    if (!user || !otherUserId) return;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/${user.username}/${otherUserId}`);
      setMessages(res.data);

      // Mark messages as read
      socket.emit('mark_messages_read', {
        senderId: otherUserId,
        receiverId: user.username
      });
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  // Select user to chat with
  const selectUser = async (selectedUserData) => {
    setSelectedUser(selectedUserData);
    setTypingUsers(new Set());

    setUsers(prev => prev.map(u =>
      u.username === selectedUserData.username ? { ...u, unreadCount: 0 } : u
    ));

    await fetchMessages(selectedUserData.username);
  };

  // Send message
  const sendMessage = async () => {
    if (!message.trim() || !selectedUser || !user) return;

    const messageData = {
      sender: user.username,
      receiver: selectedUser.username,
      text: message.trim()
    };

    socket.emit('send_private_message', messageData);
    setMessage("");

    // Stop typing indicator
    handleTypingStop();
  };

  // Handle typing start
  const handleTypingStart = () => {
    if (!isTyping && selectedUser) {
      socket.emit('typing_start', {
        sender: user.username,
        receiver: selectedUser.username
      });
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 2000);
  };

  // Handle typing stop
  const handleTypingStop = () => {
    if (isTyping && selectedUser) {
      socket.emit('typing_stop', {
        sender: user.username,
        receiver: selectedUser.username
      });
      setIsTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Add emoji to message
  const addEmoji = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // Add reaction to message
  const addReaction = (messageId, emoji) => {
    socket.emit('add_reaction', {
      messageId,
      userId: user.username,
      emoji
    });
  };

  // Socket event listeners
  useEffect(() => {
    socket.on('receive_private_message', (data) => {
      const incomingSender = data.sender;
      if (selectedUser && data.sender === selectedUser.username) {
        setMessages(prev => [...prev, data]);
        showNotification(`${data.sender}`, data.text || data.message);
        socket.emit('mark_messages_read', {
          senderId: data.sender,
          receiverId: user.username
        });
        setUsers(prev => prev.map(u =>
          u.username === data.sender ? { ...u, unreadCount: 0 } : u
        ));
      } else {
        setUsers(prev => prev.map(u =>
          u.username === incomingSender
            ? { ...u, unreadCount: (u.unreadCount || 0) + 1 }
            : u
        ));
        showNotification(`${data.sender}`, data.text || data.message);
      }
    });

    socket.on('message_sent', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socket.on('online_users_update', (onlineUsernames) => {
      setOnlineUsers(onlineUsernames);
    });

    socket.on('user_typing', (data) => {
      if (selectedUser && data.userId === selectedUser.username) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.userId);
          } else {
            newSet.delete(data.userId);
          }
          return newSet;
        });
      }
    });

    socket.on('messages_read', (data) => {
      if (data.readerId === selectedUser?.username) {
        setMessages(prev => prev.map(msg =>
          msg.sender === user.username && msg.receiver === data.readerId
            ? { ...msg, status: 'read' }
            : msg
        ));
      }
    });

    socket.on('reaction_added', (data) => {
      setMessages(prev => prev.map(msg =>
        (msg._id === data.messageId || msg.id === data.messageId)
          ? {
              ...msg,
              reactions: [
                ...(msg.reactions || []).filter(r => r.user !== data.userId),
                { user: data.userId, emoji: data.emoji }
              ]
            }
          : msg
      ));
    });

    return () => {
      socket.off('receive_private_message');
      socket.off('message_sent');
      socket.off('online_users_update');
      socket.off('user_typing');
      socket.off('messages_read');
      socket.off('reaction_added');
    };
  }, [selectedUser, user]);

  // Show logout confirmation modal
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Confirm logout
  const confirmLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, { userId: user.userId });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setShowLogoutModal(false);
    setUser(null);
    setSelectedUser(null);
    setMessages([]);
    setUsername("");
    setPassword("");
  };

  // Cancel logout
  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  // Format last seen time
  const formatLastSeen = (lastSeenDate) => {
    if (!lastSeenDate) return 'Last seen unknown';
    
    const date = new Date(lastSeenDate);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Last seen just now';
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `Last seen ${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now'; // less than 1 minute
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; // less than 1 hour
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // today
    return date.toLocaleDateString(); // older
  };

  // Emoji picker component
  const EmojiPicker = () => {
    const emojis = ['😀', '😂', '❤️', '👍', '👎', '🔥', '💯', '🎉', '🤔', '😢', '😮', '🙄'];

    return (
      <div className="emoji-picker">
        {emojis.map(emoji => (
          <button key={emoji} onClick={() => addEmoji(emoji)} className="emoji-btn">
            {emoji}
          </button>
        ))}
      </div>
    );
  };

  // Logout confirmation modal component
  const LogoutModal = () => {
    return (
      <div className="modal-overlay" onClick={cancelLogout}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🚪 Logout Confirmation</h3>
          </div>
          <div className="modal-body">
            <p>Are you sure you want to logout from your account?</p>
            <p className="modal-subtext">You can always log back in later.</p>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={cancelLogout}>
              No, Stay
            </button>
            <button className="btn-confirm" onClick={confirmLogout}>
              Yes, Logout
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className={`auth-container ${darkMode ? 'dark' : ''}`}>
        <div className="auth-card">
          <div className="auth-header">
            <h1>💬 ChatApp</h1>
            <p>{isRegistering ? "Create your account" : "Welcome back"}</p>
            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>

          <div className="auth-form">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />

            {error && <div className="error-message">{error}</div>}

            <div className="auth-buttons">
              <button
                onClick={isRegistering ? handleRegister : handleLogin}
                disabled={loading}
                className="auth-btn primary"
              >
                {loading ? '🔄 Processing...' : (isRegistering ? 'Register' : 'Login')}
              </button>
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="auth-btn secondary"
              >
                {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <span className="username">{user.username}</span>
          </div>
          <div className="sidebar-actions">
            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="logout-btn">🚪</button>
          </div>
        </div>

        <div className="users-list">
          {users.filter(u => u.username !== user.username).map(u => (
            <div
              key={u.username}
              className={`user-item ${selectedUser?.username === u.username ? 'active' : ''}`}
              onClick={() => selectUser(u)}
            >
              <div className="user-avatar">
                {u.username[0].toUpperCase()}
                <div className={`status-indicator ${onlineUsers.includes(u.username) ? 'online' : 'offline'}`}></div>
              </div>
              <div className="user-details">
                <div className="user-name">
                  {u.username}
                  {u.unreadCount > 0 && (
                    <span className="unread-badge">{u.unreadCount}</span>
                  )}
                </div>
                <div className="user-status">
                  {onlineUsers.includes(u.username) ? '🟢 Online' : `⚫ ${formatLastSeen(u.lastSeen)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="chat-avatar">{selectedUser.username[0].toUpperCase()}</div>
                <div className="chat-user-details">
                  <div className="chat-username">{selectedUser.username}</div>
                  <div className="chat-status">
                    {onlineUsers.includes(selectedUser.username) ? '🟢 Online' : `⚫ ${formatLastSeen(selectedUser.lastSeen)}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <div className="welcome-icon">👋</div>
                  <h3>Start a conversation!</h3>
                  <p>Send your first message to {selectedUser.username}</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={msg._id || msg.id || i}
                    className={`message ${msg.sender === user.username ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      <div className="message-text">{msg.message || msg.text}</div>
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                        {msg.sender === user.username && (
                          <span className={`message-status ${msg.status}`}>
                            {msg.status === 'sent' ? '✓' : msg.status === 'delivered' ? '✓✓' : '✓✓'}
                          </span>
                        )}
                      </div>
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="message-reactions">
                          {msg.reactions.map((reaction, idx) => (
                            <span key={idx} className="reaction">{reaction.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="message-actions">
                      <button
                        className="reaction-btn"
                        onClick={() => addReaction(msg._id, '❤️')}
                      >
                        ❤️
                      </button>
                      <button
                        className="reaction-btn"
                        onClick={() => addReaction(msg._id, '👍')}
                      >
                        👍
                      </button>
                      <button
                        className="reaction-btn"
                        onClick={() => addReaction(msg._id, '😂')}
                      >
                        😂
                      </button>
                    </div>
                  </div>
                ))
              )}

              {typingUsers.has(selectedUser.username) && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="typing-text">{selectedUser.username} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
              <div className="message-input-wrapper">
                <button
                  className="emoji-toggle"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  😊
                </button>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTypingStart();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${selectedUser.username}...`}
                  className="message-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className="send-btn"
                >
                  📤
                </button>
              </div>

              {showEmojiPicker && <EmojiPicker />}
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <div className="no-chat-icon">💬</div>
              <h3>Welcome to ChatApp!</h3>
              <p>Select a user from the sidebar to start chatting</p>
              <div className="features-list">
                <div className="feature">
                  <span className="feature-icon">⚡</span>
                  <span>Real-time messaging</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🔒</span>
                  <span>Secure & private</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">😊</span>
                  <span>Emoji reactions</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">📱</span>
                  <span>Modern interface</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {showLogoutModal && <LogoutModal />}
    </div>
  );
}

export default App;
