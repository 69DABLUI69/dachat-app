require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;

// 1. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 2. SUPABASE CONFIG
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ MISSING .ENV VARIABLES: SUPABASE_URL or SUPABASE_KEY");
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 3. SOCKET SERVER SETUP
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // ✅ Allow your specific Render frontend URL + Localhost for testing
    origin: ["https://dachat-app.onrender.com", "http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// 4. FILE UPLOAD CONFIG (5MB limit)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// --- HELPER: SAFE ROUTE WRAPPER ---
const safeRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    console.error("🔥 Route Error:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// --- REST API ROUTES ---

// Auth: Register
app.post("/register", safeRoute(async (req, res) => {
  const { username, password } = req.body;
  const { data: existing } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
  if (existing) return res.json({ success: false, message: "Username taken" });

  const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const { data, error } = await supabase
    .from("users")
    .insert([{ username, password, discriminator: Math.floor(1000 + Math.random() * 9000), avatar_url }])
    .select()
    .single();

  if (error) return res.json({ success: false, message: error.message });
  res.json({ success: true, user: data });
}));

// Auth: Login
app.post("/login", safeRoute(async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle(); 
  if (error) return res.json({ success: false, message: "Database error" });
  if (!user) return res.json({ success: false, message: "Invalid credentials" });
  res.json({ success: true, user });
}));

// Get My Servers
app.get("/my-servers/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: members } = await supabase.from("members").select("server_id").eq("user_id", userId);
  if (!members || members.length === 0) return res.json([]);
  const serverIds = members.map(m => m.server_id);
  const { data: servers } = await supabase.from("servers").select("*").in("id", serverIds);
  res.json(servers || []);
}));

// Get Friends
app.get("/my-friends/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: friendRows } = await supabase.from("friends").select("friend_id").eq("user_id", userId);
  if (!friendRows || friendRows.length === 0) return res.json([]);
  const friendIds = friendRows.map(row => row.friend_id);
  const { data: friends } = await supabase.from("users").select("*").in("id", friendIds);
  res.json(friends || []);
}));

// Send Request
app.post("/send-request", safeRoute(async (req, res) => {
  const { myId, usernameToAdd } = req.body;
  const { data: target } = await supabase.from("users").select("*").eq("username", usernameToAdd).maybeSingle();
  if (!target) return res.json({ success: false, message: "User not found" });
  if (target.id === myId) return res.json({ success: false, message: "Cannot add yourself" });

  const { data: isFriend } = await supabase.from("friends").select("*").eq("user_id", myId).eq("friend_id", target.id).maybeSingle();
  if (isFriend) return res.json({ success: false, message: "Already friends" });

  const { data: existing } = await supabase.from("friend_requests").select("*").eq("sender_id", myId).eq("receiver_id", target.id).maybeSingle();
  if (existing) return res.json({ success: false, message: "Request already sent" });

  await supabase.from("friend_requests").insert([{ sender_id: myId, receiver_id: target.id }]);
  io.emit("new_friend_request", { toUserId: target.id });
  res.json({ success: true, message: "Request sent!" });
}));

// Get Requests
app.get("/my-requests/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: requests } = await supabase.from("friend_requests").select("id, sender_id").eq("receiver_id", userId);
  if (!requests || requests.length === 0) return res.json([]);
  const senderIds = requests.map(r => r.sender_id);
  const { data: senders } = await supabase.from("users").select("*").in("id", senderIds);
  res.json(senders || []);
}));

// Accept Request
app.post("/accept-request", safeRoute(async (req, res) => {
  const { myId, senderId } = req.body;
  await supabase.from("friends").insert([ { user_id: myId, friend_id: senderId }, { user_id: senderId, friend_id: myId } ]);
  await supabase.from("friend_requests").delete().match({ sender_id: senderId, receiver_id: myId });
  res.json({ success: true });
}));

// Decline Request
app.post("/decline-request", safeRoute(async (req, res) => {
  const { myId, senderId } = req.body;
  await supabase.from("friend_requests").delete().match({ sender_id: senderId, receiver_id: myId });
  res.json({ success: true });
}));

// ✅ NEW: REMOVE FRIEND ROUTE
app.post("/remove-friend", safeRoute(async (req, res) => {
  const { myId, friendId } = req.body;
  // Delete the friendship in both directions using explicit OR logic
  const { error } = await supabase
    .from("friends")
    .delete()
    .or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`);

  if (error) return res.json({ success: false, message: error.message });
  res.json({ success: true });
}));

// Server Routes
app.post("/create-server", safeRoute(async (req, res) => {
  const { name, ownerId } = req.body;
  const { data: server } = await supabase.from("servers").insert([{ name, owner_id: ownerId }]).select().single();
  await supabase.from("members").insert([{ user_id: ownerId, server_id: server.id, is_admin: true }]);
  await supabase.from("channels").insert([ { server_id: server.id, name: "general", type: "text" }, { server_id: server.id, name: "voice-chat", type: "voice" } ]);
  res.json({ success: true, server });
}));

app.post("/create-channel", safeRoute(async (req, res) => {
  const { serverId, name, type } = req.body;
  const { data } = await supabase.from("channels").insert([{ server_id: serverId, name, type }]).select().single();
  res.json({ success: true, channel: data });
}));

app.get("/servers/:id/channels", safeRoute(async (req, res) => {
  const { data } = await supabase.from("channels").select("*").eq("server_id", req.params.id);
  res.json(data || []);
}));

app.get("/servers/:id/members", safeRoute(async (req, res) => {
  const { data: members } = await supabase.from("members").select("is_admin, users(*)").eq("server_id", req.params.id);
  res.json(members.map(m => ({ ...m.users, is_admin: m.is_admin })) || []);
}));

// User Profile
app.get("/users/:id", safeRoute(async (req, res) => {
  const { data } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  res.json({ success: true, user: data });
}));

app.post("/update-profile", safeRoute(async (req, res) => {
  const { userId, username, avatarUrl, bio } = req.body;
  const { data, error } = await supabase.from("users").update({ username, avatar_url: avatarUrl, bio }).eq("id", userId).select().single();
  if(error) return res.json({ success: false, message: error.message });
  io.emit("user_updated", { userId });
  res.json({ success: true, user: data });
}));

app.post("/servers/invite", safeRoute(async (req, res) => {
  const { serverId, userString } = req.body; 
  const { data: user } = await supabase.from("users").select("*").eq("username", userString).maybeSingle();
  if (!user) return res.json({ success: false, message: "User not found" });
  const { data: exists } = await supabase.from("members").select("*").eq("server_id", serverId).eq("user_id", user.id).maybeSingle();
  if (exists) return res.json({ success: false, message: "Already a member" });
  await supabase.from("members").insert([{ server_id: serverId, user_id: user.id }]);
  io.emit("new_server_invite", { userId: user.id, serverId });
  res.json({ success: true });
}));

app.post("/servers/leave", safeRoute(async (req, res) => {
  const { serverId, userId } = req.body;
  await supabase.from("members").delete().eq("server_id", serverId).eq("user_id", userId);
  io.emit("server_update", { serverId });
  res.json({ success: true });
}));

app.post("/upload", upload.single("file"), safeRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
  const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);
  res.json({ success: true, fileUrl: data.publicUrl });
}));

// --- SOCKET.IO ---
let voiceRooms = {}; 
let socketToUser = {}; 

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);
  socket.on("setup", (userId) => { if(userId) socket.join(userId.toString()); });

  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    try {
      if (roomId.toString().startsWith("dm-")) {
          const parts = roomId.split("-");
          if(parts.length >= 3) {
              const u1 = parts[1]; const u2 = parts[2];
              const { data } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${u1},recipient_id.eq.${u2}),and(sender_id.eq.${u2},recipient_id.eq.${u1})`).order("created_at", { ascending: true });
              socket.emit("load_messages", data || []);
          }
      } else {
          const { data } = await supabase.from("messages").select("*").eq("channel_id", roomId).order("created_at", { ascending: true });
          socket.emit("load_messages", data || []);
      }
    } catch (err) { console.error("Msg Error:", err); }
  });

  socket.on("send_message", async (data) => {
    const { content, senderId, senderName, fileUrl, channelId, recipientId, avatar_url } = data;
    let room = channelId ? channelId.toString() : recipientId ? `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}` : null;
    const msg = { ...data, id: Date.now(), created_at: new Date().toISOString() };
    if (room) io.to(room).emit("receive_message", msg);
    try { await supabase.from("messages").insert([{ content, sender_id: senderId, sender_name: senderName, file_url: fileUrl, avatar_url, channel_id: channelId || null, recipient_id: recipientId || null }]); } catch (err) {}
  });

  socket.on("join_voice", ({ roomId, userData }) => {
    const rId = roomId.toString();
    if (!voiceRooms[rId]) voiceRooms[rId] = [];
    voiceRooms[rId] = voiceRooms[rId].filter(u => u.socketId !== socket.id);
    voiceRooms[rId].push({ socketId: socket.id, userData });
    socketToUser[socket.id] = { roomId: rId, userData };
    socket.join(rId);
    socket.emit("all_users", voiceRooms[rId].filter(u => u.socketId !== socket.id));
    io.emit("voice_state_update", { channelId: rId, users: voiceRooms[rId].map(u => u.userData.id) });
  });

  socket.on("sending_signal", (p) => io.to(p.userToSignal).emit("user_joined", { signal: p.signal, callerID: p.callerID, userData: p.userData }));
  socket.on("returning_signal", (p) => io.to(p.callerID).emit("receiving_returned_signal", { signal: p.signal, id: socket.id }));

  const handleLeave = () => {
    const info = socketToUser[socket.id];
    if (info) {
        const { roomId } = info;
        if (voiceRooms[roomId]) {
            voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
            io.emit("voice_state_update", { channelId: roomId, users: voiceRooms[roomId].map(u => u.userData.id) });
            if(voiceRooms[roomId].length === 0) delete voiceRooms[roomId];
        }
    }
    delete socketToUser[socket.id];
  };
  socket.on("leave_voice", handleLeave);
  socket.on("disconnect", handleLeave);
});

server.listen(PORT, () => { console.log(`✅ SERVER RUNNING ON PORT ${PORT}`); });