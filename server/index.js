require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// 1. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 2. SUPABASE CONFIG
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 3. SOCKET SERVER SETUP
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 4. FILE UPLOAD CONFIG
const upload = multer({ storage: multer.memoryStorage() });

// --- REST API ROUTES ---

// Auth: Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const { data: existing } = await supabase.from("users").select("*").eq("username", username).single();
  if (existing) return res.json({ success: false, message: "Username taken" });

  const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const { data, error } = await supabase
    .from("users")
    .insert([{ username, password, discriminator: Math.floor(1000 + Math.random() * 9000), avatar_url }])
    .select()
    .single();

  if (error) return res.json({ success: false, message: error.message });
  res.json({ success: true, user: data });
});

// Auth: Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !user) return res.json({ success: false, message: "Invalid credentials" });
  res.json({ success: true, user });
});

// Get My Servers
app.get("/my-servers/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data: members } = await supabase.from("members").select("server_id").eq("user_id", userId);
  if (!members || members.length === 0) return res.json([]);
  
  const serverIds = members.map(m => m.server_id);
  const { data: servers } = await supabase.from("servers").select("*").in("id", serverIds);
  res.json(servers || []);
});

// Get My Friends
app.get("/my-friends/:userId", async (req, res) => {
  const { data: users } = await supabase.from("users").select("*").neq("id", req.params.userId).limit(10);
  res.json(users || []);
});

// Create Server
app.post("/create-server", async (req, res) => {
  const { name, ownerId } = req.body;
  const { data: server, error } = await supabase.from("servers").insert([{ name, owner_id: ownerId }]).select().single();
  if (error) return res.json({ success: false });

  await supabase.from("members").insert([{ user_id: ownerId, server_id: server.id, is_admin: true }]);
  await supabase.from("channels").insert([
    { server_id: server.id, name: "general", type: "text" },
    { server_id: server.id, name: "voice-chat", type: "voice" }
  ]);
  
  res.json({ success: true, server });
});

// Create Channel
app.post("/create-channel", async (req, res) => {
  const { serverId, name, type } = req.body;
  const { data } = await supabase.from("channels").insert([{ server_id: serverId, name, type }]).select().single();
  res.json({ success: true, channel: data });
});

// Get Server Channels
app.get("/servers/:id/channels", async (req, res) => {
  const { data } = await supabase.from("channels").select("*").eq("server_id", req.params.id);
  res.json(data || []);
});

// Get Server Members
app.get("/servers/:id/members", async (req, res) => {
  const { data: members } = await supabase.from("members").select("is_admin, users(*)").eq("server_id", req.params.id);
  const formatted = members.map(m => ({ ...m.users, is_admin: m.is_admin }));
  res.json(formatted || []);
});

// Get User Profile
app.get("/users/:id", async (req, res) => {
  const { data } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  res.json({ success: true, user: data });
});

// Update Profile
app.post("/update-profile", async (req, res) => {
  const { userId, username, avatarUrl, bio } = req.body;
  const { data, error } = await supabase.from("users").update({ username, avatar_url: avatarUrl, bio }).eq("id", userId).select().single();
  if(error) return res.json({ success: false });
  io.emit("user_updated", { userId });
  res.json({ success: true, user: data });
});

// Invite User
app.post("/servers/invite", async (req, res) => {
  const { serverId, userString } = req.body; 
  const { data: user } = await supabase.from("users").select("*").ilike("username", userString).single();
  if (!user) return res.json({ success: false, message: "User not found" });

  const { data: exists } = await supabase.from("members").select("*").eq("server_id", serverId).eq("user_id", user.id).single();
  if (exists) return res.json({ success: false, message: "Already a member" });

  await supabase.from("members").insert([{ server_id: serverId, user_id: user.id }]);
  io.emit("new_server_invite", { userId: user.id, serverId });
  res.json({ success: true });
});

// Leave Server
app.post("/servers/leave", async (req, res) => {
  const { serverId, userId } = req.body;
  await supabase.from("members").delete().eq("server_id", serverId).eq("user_id", userId);
  io.emit("server_update", { serverId });
  res.json({ success: true });
});

// File Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const fileName = `${Date.now()}_${req.file.originalname}`;
  const { data, error } = await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
  if (error) return res.json({ success: false });
  const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(fileName);
  res.json({ success: true, fileUrl: publicData.publicUrl });
});


// --- SOCKET.IO (REAL-TIME + DATABASE SAVING) ---
let voiceRooms = {}; 
let socketToUser = {}; 

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("setup", (userId) => {
    socket.join(userId);
  });

  // 1. JOIN ROOM & LOAD HISTORY
  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);

    // Determine if Channel or DM
    if (roomId.toString().startsWith("dm-")) {
        // DM Logic: Fetch messages between these two users
        const parts = roomId.split("-"); // dm-ID1-ID2
        if(parts.length >= 3) {
            const u1 = parts[1];
            const u2 = parts[2];
            const { data } = await supabase
                .from("messages")
                .select("*")
                .or(`and(sender_id.eq.${u1},recipient_id.eq.${u2}),and(sender_id.eq.${u2},recipient_id.eq.${u1})`)
                .order("created_at", { ascending: true });
            socket.emit("load_messages", data || []);
        }
    } else {
        // Channel Logic: Fetch messages by channel_id
        const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", roomId)
            .order("created_at", { ascending: true });
        socket.emit("load_messages", data || []);
    }
  });

  // 2. SEND MESSAGE & SAVE TO DB
  socket.on("send_message", async (data) => {
    // Determine Target Room
    let room = data.channelId ? data.channelId.toString() : data.recipientId ? `dm-${[data.senderId, data.recipientId].sort((a,b)=>a-b).join('-')}` : null;
    
    // Broadcast Real-time
    if (room) io.to(room).emit("receive_message", { ...data, id: Date.now() }); // Temporary ID for instant UI update

    // Save to Database
    const { content, senderId, senderName, fileUrl, channelId, recipientId } = data;
    try {
        await supabase.from("messages").insert([{
            content,
            sender_id: senderId,
            sender_name: senderName,
            file_url: fileUrl,
            channel_id: channelId || null,
            recipient_id: recipientId || null
        }]);
    } catch (err) {
        console.error("Error saving message:", err);
    }
  });

  // --- VOICE LOGIC ---
  socket.on("join_voice", ({ roomId, userData }) => {
    if (!voiceRooms[roomId]) voiceRooms[roomId] = [];
    voiceRooms[roomId].push({ socketId: socket.id, userData });
    socketToUser[socket.id] = { roomId, userData };
    socket.join(roomId);

    const usersInRoom = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
    socket.emit("all_users", usersInRoom);

    const allUsersInRoomIds = voiceRooms[roomId].map(u => u.userData.id);
    io.emit("voice_state_update", { channelId: roomId, users: allUsersInRoomIds });
  });

  socket.on("sending_signal", (payload) => {
    io.to(payload.userToSignal).emit("user_joined", { signal: payload.signal, callerID: payload.callerID, userData: payload.userData });
  });

  socket.on("returning_signal", (payload) => {
    io.to(payload.callerID).emit("receiving_returned_signal", { signal: payload.signal, id: socket.id });
  });

  socket.on("leave_voice", () => {
    const info = socketToUser[socket.id];
    if (info) {
        const { roomId } = info;
        if (voiceRooms[roomId]) {
            voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
            const allUsersInRoomIds = voiceRooms[roomId].map(u => u.userData.id);
            io.emit("voice_state_update", { channelId: roomId, users: allUsersInRoomIds });
        }
    }
    delete socketToUser[socket.id];
  });

  socket.on("disconnect", () => {
    const info = socketToUser[socket.id];
    if (info) {
        const { roomId } = info;
        if (voiceRooms[roomId]) {
            voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
            const allUsersInRoomIds = voiceRooms[roomId].map(u => u.userData.id);
            io.emit("voice_state_update", { channelId: roomId, users: allUsersInRoomIds });
        }
    }
    delete socketToUser[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});