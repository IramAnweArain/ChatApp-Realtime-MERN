# 💬 Real-Time WhatsApp Clone
A full-stack real-time chat application built with the MERN stack and Socket.io.

## 🚀 Features
* **Real-time Messaging:** Messages appear instantly without page refresh.
* **Authentication:** Secure Signup and Login using Bcrypt password hashing.
* **Message Persistence:** Chat history is saved in MongoDB.
* **Responsive UI:** Clean, WhatsApp-inspired interface.

## 🛠️ Tech Stack
* **Frontend:** React.js, CSS3
* **Backend:** Node.js, Express.js
* **Database:** MongoDB
* **Real-Time:** Socket.io
* **API Testing:** Postman

## 💻 Local Setup
1. Clone the repo: `git clone <your-repo-link>`
2. **Server:** 
   - `cd server`
   - Create a `.env` file inside `server/` with your MongoDB Atlas URI:
     - `MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority"`
   - `npm install`
   - `npm run dev`
3. **Client:**
   - `cd client`
   - `npm install`
   - `npm start`