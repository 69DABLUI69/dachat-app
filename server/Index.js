require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

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

// --- UPLOAD ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false });
    const fileName = `${Date.now()}-${file.originalname}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(fileName, file.buffer, { contentType: file.mimetype });
    if (error) throw error;
    const { data } = supabase.storage.from("chat-uploads").getPublicUrl(fileName);
    res.json({ success: true, fileUrl: data.publicUrl });
  } catch (err) { res.status(500).json({ success: false }); }
});

// --- AUTH & PROFILES ---
function generateDiscriminator() { return Math.floor(1000 + Math.random() * 9000).toString(); }

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const discriminator = generateDiscriminator();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query("INSERT INTO users (username, password, discriminator) VALUES ($1, $2, $3) RETURNING id, username, discriminator, avatar_url, bio", [username, hashedPassword, discriminator]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.json({ success: false, message: "User not found" });
    const user = result.rows[0];
    if (await bcrypt.compare(password, user.password)) {
      res.json({ success: true, user: { id: user.id, username: user.username, discriminator: user.discriminator, avatar_url: user.avatar_url, bio: user.bio } });
    } else { res.json({ success: false, message: "Wrong password" }); }
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get("/users/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, discriminator, avatar_url, bio FROM users WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post("/update-profile", async (req, res) => {
  const { userId, username, avatarUrl, bio } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET username = $1, avatar_url = $2, bio = $3 WHERE id = $4 RETURNING id, username, discriminator, avatar_url, bio",
      [username, avatarUrl, bio, userId]
    );
    io.emit("user_updated", { userId }); 
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: "Update failed" }); }
});

app.get("/my-friends/:userId", async (req, res) => {
  const result = await pool.query(`SELECT u.id, u.username, u.discriminator, u.avatar_url FROM users u JOIN friends f ON (u.id = f.user_id_2 AND f.user_id_1 = $1) OR (u.id = f.user_id_1 AND f.user_id_2 = $1)`, [req.params.userId]);
  res.json(result.rows);
});

app.post("/add-friend", async (req, res) => {
  const { myId, friendString } = req.body;
  const parts = friendString.split("#");
  if (parts.length !== 2) return res.json({ success: false, message: "Format: Name#1234" });
  try {
    const userRes = await pool.query("SELECT id, username, discriminator FROM users WHERE username = $1 AND discriminator = $2", [parts[0], parts[1]]);
    if (userRes.rows.length === 0) return res.json({ success: false, message: "User not found" });
    const friend = userRes.rows[0];
    if (friend.id == myId) return res.json({ success: false });
    await pool.query("INSERT INTO friends (user_id_1, user_id_2) VALUES ($1, $2)", [myId, friend.id]);
    res.json({ success: true, friend });
  } catch (err) { res.json({ success: false, message: "Already friends" }); }
});

// --- SERVERS & CHANNELS ---
app.post("/create-server", async (req, res) => {
  const { name, ownerId } = req.body;
  const serverRes = await pool.query("INSERT INTO servers (name, owner_id) VALUES ($1, $2) RETURNING *", [name, ownerId]);
  const s = serverRes.rows[0];
  await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, 'general', 'text')", [s.id]);
  await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, 'Voice Chat', 'voice')", [s.id]);
  await pool.query("INSERT INTO server_members (server_id, user_id, is_admin) VALUES ($1, $2, true)", [s.id, ownerId]);
  res.json({ success: true, server: s });
});

app.get("/my-servers/:userId", async (req, res) => {
  const result = await pool.query(`SELECT s.* FROM servers s JOIN server_members sm ON s.id = sm.server_id WHERE sm.user_id = $1`, [req.params.userId]);
  res.json(result.rows);
});

app.get("/servers/:serverId/channels", async (req, res) => {
  const result = await pool.query("SELECT * FROM channels WHERE server_id = $1 ORDER BY id ASC", [req.params.serverId]);
  res.json(result.rows);
});

app.post("/create-channel", async (req, res) => {
  const { serverId, name, type } = req.body;
  await pool.query("INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3)", [serverId, name, type || 'text']);
  res.json({ success: true });
});

app.get("/servers/:serverId/members", async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.discriminator, u.avatar_url, sm.is_admin 
     FROM users u 
     JOIN server_members sm ON u.id = sm.user_id 
     WHERE sm.server_id = $1`, 
    [req.params.serverId]
  );
  res.json(result.rows);
});

// --- MODERATION ---
app.post("/servers/leave", async (req, res) => {
  const { serverId, userId } = req.body;
  try {
    const serverCheck = await pool.query("SELECT owner_id FROM servers WHERE id = $1", [serverId]);
    if (serverCheck.rows.length === 0) return res.json({ success: false, message: "Server not found" });
    if (serverCheck.rows[0].owner_id.toString() === userId.toString()) {
      return res.json({ success: false, message: "Owner cannot leave. You must delete the server." });
    }
    await pool.query("DELETE FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
    io.emit("server_update", { serverId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post("/servers/invite", async (req, res) => {
  const { serverId, userString } = req.body; 
  const parts = userString.split("#");
  if (parts.length !== 2) return res.json({ success: false, message: "Use format Name#1234" });
  try {
    const userRes = await pool.query("SELECT id FROM users WHERE username = $1 AND discriminator = $2", [parts[0], parts[1]]);
    if (userRes.rows.length === 0) return res.json({ success: false, message: "User not found" });
    const userId = userRes.rows[0].id;
    await pool.query("INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)", [serverId, userId]);
    io.to(userId.toString()).emit("new_server_invite"); 
    io.emit("server_update", { serverId });
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: "User already in server" }); }
});

app.post("/servers/promote", async (req, res) => {
  const { serverId, userId, ownerId } = req.body;
  const serverCheck = await pool.query("SELECT owner_id FROM servers WHERE id = $1", [serverId]);
  if (serverCheck.rows.length === 0 || serverCheck.rows[0].owner_id.toString() !== ownerId.toString()) return res.json({ success: false, message: "Only Owner can promote" });
  await pool.query("UPDATE server_members SET is_admin = true WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
  io.emit("server_update", { serverId });
  res.json({ success: true });
});

app.post("/servers/demote", async (req, res) => {
  const { serverId, userId, ownerId } = req.body;
  const serverCheck = await pool.query("SELECT owner_id FROM servers WHERE id = $1", [serverId]);
  if (serverCheck.rows.length === 0 || serverCheck.rows[0].owner_id.toString() !== ownerId.toString()) return res.json({ success: false, message: "Only Owner can demote" });
  await pool.query("UPDATE server_members SET is_admin = false WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
  io.emit("server_update", { serverId });
  res.json({ success: true });
});

app.post("/servers/kick", async (req, res) => {
  const { serverId, userId, requesterId } = req.body;
  const serverCheck = await pool.query("SELECT owner_id FROM servers WHERE id = $1", [serverId]);
  const serverOwnerId = serverCheck.rows[0].owner_id.toString();
  const requesterCheck = await pool.query("SELECT is_admin FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, requesterId]);
  const requesterIsAdmin = requesterCheck.rows.length > 0 && requesterCheck.rows[0].is_admin;
  const targetCheck = await pool.query("SELECT is_admin FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
  const targetIsAdmin = targetCheck.rows.length > 0 && targetCheck.rows[0].is_admin;
  const isOwner = serverOwnerId === requesterId.toString();

  if (!isOwner && !requesterIsAdmin) return res.json({ success: false, message: "Not authorized" });
  if (requesterIsAdmin && !isOwner) {
    if (targetIsAdmin || userId.toString() === serverOwnerId) return res.json({ success: false, message: "Admins cannot kick other Admins/Owner" });
  }

  await pool.query("DELETE FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, userId]);
  io.to(userId.toString()).emit("new_server_invite");
  io.emit("server_update", { serverId });
  res.json({ success: true });
});

app.post("/channels/delete", async (req, res) => {
  const { channelId, requesterId } = req.body;
  const chanRes = await pool.query("SELECT server_id FROM channels WHERE id = $1", [channelId]);
  if (chanRes.rows.length === 0) return res.json({ success: false });
  const serverId = chanRes.rows[0].server_id;
  const serverCheck = await pool.query("SELECT owner_id FROM servers WHERE id = $1", [serverId]);
  const isOwner = serverCheck.rows[0].owner_id.toString() === requesterId.toString();
  const memberCheck = await pool.query("SELECT is_admin FROM server_members WHERE server_id = $1 AND user_id = $2", [serverId, requesterId]);
  const isAdmin = memberCheck.rows.length > 0 && memberCheck.rows[0].is_admin;
  if (!isOwner && !isAdmin) return res.json({ success: false, message: "Not authorized" });
  await pool.query("DELETE FROM channels WHERE id = $1", [channelId]);
  res.json({ success: true });
});

// --- SOCKET & WEBRTC (NO GHOSTS FIX) ---
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    // Allow both localhost (for you) and your future Vercel app
    origin: ["http://localhost:3000", process.env.CLIENT_URL], 
    methods: ["GET", "POST"] 
  } 
});

const socketMapping = {}; // socketId -> { userId, roomId, userData }
const roomStates = {}; // roomId -> Set(userId) (UI)
const voiceRooms = {}; // roomId -> [ { socketId, userData } ] (WebRTC)

io.on("connection", (socket) => {
  socket.on("setup", (userId) => { socket.join(userId.toString()); });

  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    let res;
    if (typeof roomId === 'string' && roomId.startsWith('dm-')) {
      const parts = roomId.split('-');
      res = await pool.query(`SELECT * FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY id ASC LIMIT 50`, [parts[1], parts[2]]);
    } else {
      res = await pool.query("SELECT * FROM messages WHERE channel_id = $1 ORDER BY id ASC LIMIT 50", [roomId]);
    }
    socket.emit("load_messages", res.rows);
  });

  socket.on("send_message", async (data) => {
    const { content, senderId, senderName, channelId, recipientId, fileUrl } = data;
    const userRes = await pool.query("SELECT avatar_url FROM users WHERE id = $1", [senderId]);
    const avatarUrl = userRes.rows[0]?.avatar_url || null;

    if (channelId) {
      const res = await pool.query("INSERT INTO messages (content, sender_id, sender_name, channel_id, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *", [content, senderId, senderName, channelId, fileUrl || null]);
      io.to(channelId).emit("receive_message", { ...res.rows[0], avatar_url: avatarUrl });
    } else if (recipientId) {
      const res = await pool.query("INSERT INTO messages (content, sender_id, sender_name, recipient_id, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *", [content, senderId, senderName, recipientId, fileUrl || null]);
      const ids = [senderId, recipientId].sort((a,b) => a-b);
      io.to(`dm-${ids[0]}-${ids[1]}`).emit("receive_message", { ...res.rows[0], avatar_url: avatarUrl });
    }
  });

  // 🔥 ROBUST JOIN LOGIC 🔥
  socket.on("join_voice", ({ roomId, userData }) => {
    if (!userData || !userData.id) return;

    socketMapping[socket.id] = { userId: userData.id, roomId, userData };

    if (!voiceRooms[roomId]) voiceRooms[roomId] = [];
    
    // 🛑 CRITICAL FIX: Convert IDs to strings to ensure correct duplicate removal
    voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.userData.id.toString() !== userData.id.toString());
    
    voiceRooms[roomId].push({ socketId: socket.id, userData });

    if (!roomStates[roomId]) roomStates[roomId] = new Set();
    roomStates[roomId].add(userData.id);

    const otherUsers = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
    socket.emit("all_users", otherUsers); 

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

  // 🔥 CLEAN DISCONNECT LOGIC 🔥
  const handleDisconnect = () => {
    const info = socketMapping[socket.id];
    if (info) {
      const { roomId, userId } = info;

      if (voiceRooms[roomId]) {
        voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
      }

      // Check if user is truly gone (no other sockets for same user ID)
      const stillInRoom = voiceRooms[roomId]?.some(u => u.userData.id.toString() === userId.toString());
      
      if (!stillInRoom && roomStates[roomId]) {
        roomStates[roomId].delete(userId);
        io.emit("voice_state_update", { channelId: roomId, users: Array.from(roomStates[roomId]) });
      }

      delete socketMapping[socket.id];
    }
  };

  socket.on("leave_voice", () => handleDisconnect());
  socket.on("disconnect", () => handleDisconnect());
});
server.listen(3001, () => console.log("SERVER RUNNING"));