require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const ytdl = require('ytdl-core'); // 🎵 YouTube Downloader

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ PASTE YOUR DB & SUPABASE INFO HERE ⚠️
const connectionString = "postgresql://postgres.mgrjnnhqsadsquupqkgt:Skibidibibi69@aws-1-eu-west-1.pooler.supabase.com:6543/postgres";
const SUPABASE_URL = "https://mgrjnnhqsadsquupqkgt.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncmpubmhxc2Fkc3F1dXBxa2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4OTM1MCwiZXhwIjoyMDg0NTY1MzUwfQ.0iAtrnwhtCn02bgeGBR9TaEJDKqlNRQzAGUnsAKEkkc"; 

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- 🎵 YOUTUBE RINGTONE STREAMER ---
app.get("/stream-audio", async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) return res.status(400).send("No URL provided");

    try {
        if (!ytdl.validateURL(videoURL)) {
            return res.status(400).send("Invalid YouTube URL");
        }
        res.header("Content-Type", "audio/mpeg");
        ytdl(videoURL, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
    } catch (err) {
        console.error("Stream Error:", err.message);
        res.status(500).send("Failed to stream audio");
    }
});

// --- AUTH & API ---
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query("INSERT INTO users (username, password_hash, discriminator) VALUES ($1, $2, $3) RETURNING *", [username, hash, Math.floor(1000 + Math.random() * 9000)]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) res.json({ success: true, user });
    else res.status(401).json({ success: false, message: "Invalid password" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get("/my-servers/:id", async (req, res) => {
  const result = await pool.query(`SELECT s.* FROM servers s JOIN server_members sm ON s.id = sm.server_id WHERE sm.user_id = $1`, [req.params.id]);
  res.json(result.rows);
});

app.get("/my-friends/:id", async (req, res) => {
  const result = await pool.query(`SELECT u.id, u.username, u.avatar_url, u.discriminator FROM friends f JOIN users u ON (CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END) = u.id WHERE $1 IN (f.user_id_1, f.user_id_2)`, [req.params.id]);
  res.json(result.rows);
});

app.get("/servers/:id/channels", async (req, res) => {
  const result = await pool.query("SELECT * FROM channels WHERE server_id = $1 ORDER BY id ASC", [req.params.id]);
  res.json(result.rows);
});

app.get("/servers/:id/members", async (req, res) => {
  const result = await pool.query(`SELECT u.id, u.username, u.avatar_url, u.discriminator, sm.is_admin FROM server_members sm JOIN users u ON sm.user_id = u.id WHERE sm.server_id = $1`, [req.params.id]);
  res.json(result.rows);
});

app.post("/create-server", async (req, res) => {
  const { name, ownerId } = req.body;
  try {
    const serverRes = await pool.query("INSERT INTO servers (name, owner_id) VALUES ($1, $2) RETURNING *", [name, ownerId]);
    const server = serverRes.rows[0];
    await pool.query("INSERT INTO server_members (server_id, user_id, is_admin) VALUES ($1, $2, true)", [server.id, ownerId]);
    await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, 'general', 'text')", [server.id]);
    await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, 'General Voice', 'voice')", [server.id]);
    res.json({ success: true, server });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post("/create-channel", async (req, res) => {
  const { serverId, name, type } = req.body;
  await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3)", [serverId, name, type]);
  res.json({ success: true });
});

app.post("/servers/invite", async (req, res) => {
  const { serverId, userString } = req.body;
  const [username, discriminator] = userString.split("#");
  if (!username || !discriminator) return res.json({ success: false, message: "Format: Name#1234" });
  const userRes = await pool.query("SELECT id FROM users WHERE username = $1 AND discriminator = $2", [username, discriminator]);
  if (userRes.rows.length === 0) return res.json({ success: false, message: "User not found" });
  const userId = userRes.rows[0].id;
  try {
      await pool.query("INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)", [serverId, userId]);
      const userSocket = Object.keys(socketMapping).find(key => String(socketMapping[key].userId) === String(userId));
      if (userSocket) io.to(userSocket).emit("new_server_invite", { serverId });
      res.json({ success: true });
  } catch (err) { res.json({ success: false, message: "User already in server" }); }
});

app.post("/add-friend", async (req, res) => {
    const { myId, friendString } = req.body;
    const [username, discriminator] = friendString.split("#");
    const friendRes = await pool.query("SELECT id FROM users WHERE username = $1 AND discriminator = $2", [username, discriminator]);
    if (friendRes.rows.length === 0) return res.json({ success: false, message: "User not found" });
    const friendId = friendRes.rows[0].id;
    try {
        await pool.query("INSERT INTO friends (user_id_1, user_id_2) VALUES ($1, $2)", [Math.min(myId, friendId), Math.max(myId, friendId)]);
        const friendSocket = Object.keys(socketMapping).find(key => String(socketMapping[key].userId) === String(friendId));
        if(friendSocket) io.to(friendSocket).emit("user_updated");
        res.json({ success: true });
    } catch { res.json({ success: false, message: "Already friends" }); }
});

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const fileName = `${Date.now()}_${file.originalname}`;
        const { data, error } = await supabase.storage.from("uploads").upload(fileName, file.buffer, { contentType: file.mimetype });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(fileName);
        res.json({ success: true, fileUrl: publicUrl });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post("/update-profile", async (req, res) => {
    const { userId, username, avatarUrl, bio } = req.body;
    try {
        const result = await pool.query("UPDATE users SET username = $1, avatar_url = $2, bio = $3 WHERE id = $4 RETURNING *", [username, avatarUrl, bio, userId]);
        io.emit("user_updated");
        res.json({ success: true, user: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get("/users/:id", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, discriminator, avatar_url, bio FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true, user: result.rows[0] });
    } catch(e) { res.status(500).json({ success: false }); }
});

// --- SOCKET.IO LOGIC ---
const voiceRooms = {}; // { roomId: [{ socketId, userData }] }
const socketMapping = {}; // { socketId: { userId, roomId } }
const roomStates = {}; // { channelId: Set(userIds) }

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("setup", (userId) => {
    socketMapping[socket.id] = { userId, roomId: null };
    console.log(`Setup complete for user ${userId} on socket ${socket.id}`);
  });

  socket.on("join_room", ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on("send_message", async (payload) => {
    const { content, senderId, senderName, channelId, recipientId, fileUrl } = payload;
    let roomId = channelId ? channelId.toString() : `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}`;
    
    // In production, insert into DB here
    const msg = { content, sender_id: senderId, sender_name: senderName, file_url: fileUrl, created_at: new Date() };
    const userRes = await pool.query("SELECT avatar_url FROM users WHERE id = $1", [senderId]);
    msg.avatar_url = userRes.rows[0]?.avatar_url;

    io.to(roomId).emit("receive_message", msg);
  });

  // --- WEBRTC SIGNALING (VOICE/VIDEO) ---
  socket.on("join_voice", ({ roomId, userData }) => {
    if (socketMapping[socket.id]) socketMapping[socket.id].roomId = roomId;
    
    // UI State Update
    if (!roomStates[roomId]) roomStates[roomId] = new Set();
    roomStates[roomId].add(userData.id);

    // Add to Voice Room
    if (voiceRooms[roomId]) {
      // Remove any ghost instances of this socket if they exist
      voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
      voiceRooms[roomId].push({ socketId: socket.id, userData });
    } else {
      voiceRooms[roomId] = [{ socketId: socket.id, userData }];
    }

    // Get others in the room to initiate connections
    const otherUsers = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
    socket.emit("all_users", otherUsers); 

    // Update UI for everyone
    io.emit("voice_state_update", { channelId: roomId, users: Array.from(roomStates[roomId]) });
  });

  socket.on("sending_signal", payload => {
    io.to(payload.userToSignal).emit("user_joined", { 
      signal: payload.signal, 
      callerID: payload.callerID, 
      userData: payload.userData 
    });
  });

  socket.on("returning_signal", payload => {
    io.to(payload.callerID).emit("receiving_returned_signal", { signal: payload.signal, id: socket.id });
  });

  // --- CALLING SYSTEM ---
  socket.on("start_call", ({ userToCall, fromUser, roomId }) => {
    console.log(`[CALL] ${fromUser.username} calling ${userToCall} in room ${roomId}`);
    
    // Find all sockets for the recipient (String conversion is critical)
    const recipientSockets = Object.keys(socketMapping).filter(key => 
      String(socketMapping[key].userId) === String(userToCall)
    );

    if (recipientSockets.length > 0) {
      recipientSockets.forEach(socketId => {
          io.to(socketId).emit("incoming_call", { from: fromUser, roomId });
      });
    } else {
        console.log("Recipient not found in socket mapping.");
    }
  });

  socket.on("answer_call", ({ to, roomId }) => {
    // Find caller sockets
    const callerSockets = Object.keys(socketMapping).filter(key => 
        String(socketMapping[key].userId) === String(to.id)
    );
    callerSockets.forEach(socketId => io.to(socketId).emit("call_accepted", { roomId }));
  });

  socket.on("reject_call", ({ to }) => {
    const callerSockets = Object.keys(socketMapping).filter(key => 
        String(socketMapping[key].userId) === String(to.id)
    );
    callerSockets.forEach(socketId => io.to(socketId).emit("call_rejected"));
  });

  // --- DISCONNECT HANDLING (FIXED) ---
  const handleLeaveRoom = () => {
    const info = socketMapping[socket.id];
    
    // Only proceed if we know who this socket is AND they are actually in a room
    if (info && info.roomId) {
      const { roomId, userId } = info;

      if (voiceRooms[roomId]) {
        // 1. Remove user from the memory list for that room
        voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
        
        // 2. Tell everyone else in the room to remove this peer (Kill the Ghost)
        io.to(roomId).emit("user_left", socket.id);

        // 3. Update the visual "Who is in this channel" state
        const stillInRoom = voiceRooms[roomId]?.some(u => String(u.userData.id) === String(userId));
        if (!stillInRoom && roomStates[roomId]) {
            roomStates[roomId].delete(userId);
            io.emit("voice_state_update", { channelId: roomId, users: Array.from(roomStates[roomId]) });
        }
      }
      
      // ✅ CRITICAL FIX: Just clear the room ID, do NOT delete the user from the map!
      if (socketMapping[socket.id]) {
        socketMapping[socket.id].roomId = null;
      }
    }
  };

  // When user clicks "Leave Call" button
  socket.on("leave_voice", () => {
      handleLeaveRoom();
      console.log(`User ${socket.id} left voice (Still Online)`);
  });

  // When user closes the tab
  socket.on("disconnect", () => {
      handleLeaveRoom(); // Remove from rooms first
      delete socketMapping[socket.id]; // THEN remove from online list
      console.log("User Disconnected (Offline):", socket.id);
  });
});

server.listen(3001, () => console.log("Server running on 3001"));