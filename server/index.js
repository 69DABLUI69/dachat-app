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

// 4. FILE UPLOAD CONFIG (Added 5MB limit)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// --- HELPER: SAFE ROUTE WRAPPER (Prevents Server Crashes) ---
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
  
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .maybeSingle(); 

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

// Get My Friends
app.get("/my-friends/:userId", safeRoute(async (req, res) => {
  const { data: users } = await supabase.from("users").select("*").neq("id", req.params.userId).limit(10);
  res.json(users || []);
}));

// Create Server
app.post("/create-server", safeRoute(async (req, res) => {
  const { name, ownerId } = req.body;
  const { data: server, error } = await supabase.from("servers").insert([{ name, owner_id: ownerId }]).select().single();
  if (error) return res.json({ success: false, message: error.message });

  await supabase.from("members").insert([{ user_id: ownerId, server_id: server.id, is_admin: true }]);
  await supabase.from("channels").insert([
    { server_id: server.id, name: "general", type: "text" },
    { server_id: server.id, name: "voice-chat", type: "voice" }
  ]);
  
  res.json({ success: true, server });
}));

// Create Channel
app.post("/create-channel", safeRoute(async (req, res) => {
  const { serverId, name, type } = req.body;
  const { data } = await supabase.from("channels").insert([{ server_id: serverId, name, type }]).select().single();
  res.json({ success: true, channel: data });
}));

// Get Server Channels
app.get("/servers/:id/channels", safeRoute(async (req, res) => {
  const { data } = await supabase.from("channels").select("*").eq("server_id", req.params.id);
  res.json(data || []);
}));

// Get Server Members
app.get("/servers/:id/members", safeRoute(async (req, res) => {
  const { data: members } = await supabase.from("members").select("is_admin, users(*)").eq("server_id", req.params.id);
  const formatted = members.map(m => ({ ...m.users, is_admin: m.is_admin }));
  res.json(formatted || []);
}));

// Get User Profile
app.get("/users/:id", safeRoute(async (req, res) => {
  const { data } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  res.json({ success: true, user: data });
}));

// Update Profile
app.post("/update-profile", safeRoute(async (req, res) => {
  const { userId, username, avatarUrl, bio } = req.body;
  const { data, error } = await supabase.from("users").update({ username, avatar_url: avatarUrl, bio }).eq("id", userId).select().single();
  if(error) return res.json({ success: false });
  io.emit("user_updated", { userId });
  res.json({ success: true, user: data });
}));

// Invite User
app.post("/servers/invite", safeRoute(async (req, res) => {
  const { serverId, userString } = req.body; 
  // Allow searching by exact username for now
  const { data: user } = await supabase.from("users").select("*").eq("username", userString).maybeSingle();
  if (!user) return res.json({ success: false, message: "User not found (Must be exact match)" });

  const { data: exists } = await supabase.from("members").select("*").eq("server_id", serverId).eq("user_id", user.id).maybeSingle();
  if (exists) return res.json({ success: false, message: "Already a member" });

  await supabase.from("members").insert([{ server_id: serverId, user_id: user.id }]);
  io.emit("new_server_invite", { userId: user.id, serverId });
  res.json({ success: true });
}));

// Leave Server
app.post("/servers/leave", safeRoute(async (req, res) => {
  const { serverId, userId } = req.body;
  await supabase.from("members").delete().eq("server_id", serverId).eq("user_id", userId);
  io.emit("server_update", { serverId });
  res.json({ success: true });
}));

// File Upload
app.post("/upload", upload.single("file"), safeRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  // Sanitize filename
  const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
  const fileName = `${Date.now()}_${sanitizedName}`;
  
  const { error } = await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
  if (error) {
    console.error("Supabase Storage Error:", error);
    return res.json({ success: false, message: "Upload failed" });
  }
  
  const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(fileName);
  res.json({ success: true, fileUrl: publicData.publicUrl });
}));


// --- SOCKET.IO (REAL-TIME) ---
let voiceRooms = {}; 
let socketToUser = {}; 

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("setup", (userId) => {
    // Ensure userId is a string for room consistency
    if(userId) socket.join(userId.toString());
  });

  // 1. JOIN ROOM & LOAD MESSAGES
  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);

    try {
      if (roomId.toString().startsWith("dm-")) {
          const parts = roomId.split("-");
          if(parts.length >= 3) {
              const u1 = parts[1];
              const u2 = parts[2];
              
              const { data } = await supabase
                  .from("messages")
                  .select("*")
                  // Use raw filter string for complicated OR logic
                  .or(`and(sender_id.eq.${u1},recipient_id.eq.${u2}),and(sender_id.eq.${u2},recipient_id.eq.${u1})`)
                  .order("created_at", { ascending: true });
              socket.emit("load_messages", data || []);
          }
      } else {
          const { data } = await supabase
              .from("messages")
              .select("*")
              .eq("channel_id", roomId)
              .order("created_at", { ascending: true });
          socket.emit("load_messages", data || []);
      }
    } catch (err) {
      console.error("Message Fetch Error:", err);
    }
  });

  // 2. SEND MESSAGE & SAVE
  socket.on("send_message", async (data) => {
    const { content, senderId, senderName, fileUrl, channelId, recipientId, avatar_url } = data;
    
    // Determine Room
    let room = channelId ? channelId.toString() : recipientId ? `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}` : null;
    
    // Broadcast immediately (Optimistic UI)
    const messagePayload = { ...data, id: Date.now(), created_at: new Date().toISOString() };
    if (room) io.to(room).emit("receive_message", messagePayload);

    // Save DB
    try {
        await supabase.from("messages").insert([{
            content,
            sender_id: senderId,
            sender_name: senderName,
            file_url: fileUrl,
            avatar_url: avatar_url, // Save avatar snapshot
            channel_id: channelId || null,
            recipient_id: recipientId || null
        }]);
    } catch (err) { console.error("DB Save Error:", err); }
  });

  // --- VOICE LOGIC ---
  socket.on("join_voice", ({ roomId, userData }) => {
    const rId = roomId.toString();
    if (!voiceRooms[rId]) voiceRooms[rId] = [];
    
    // Prevent duplicate entries
    voiceRooms[rId] = voiceRooms[rId].filter(u => u.socketId !== socket.id);
    voiceRooms[rId].push({ socketId: socket.id, userData });
    
    socketToUser[socket.id] = { roomId: rId, userData };
    socket.join(rId);

    const usersInRoom = voiceRooms[rId].filter(u => u.socketId !== socket.id);
    socket.emit("all_users", usersInRoom);

    const allUsersInRoomIds = voiceRooms[rId].map(u => u.userData.id);
    io.emit("voice_state_update", { channelId: rId, users: allUsersInRoomIds });
  });

  socket.on("sending_signal", (payload) => {
    io.to(payload.userToSignal).emit("user_joined", { signal: payload.signal, callerID: payload.callerID, userData: payload.userData });
  });

  socket.on("returning_signal", (payload) => {
    io.to(payload.callerID).emit("receiving_returned_signal", { signal: payload.signal, id: socket.id });
  });

  const handleLeave = () => {
    const info = socketToUser[socket.id];
    if (info) {
        const { roomId } = info;
        if (voiceRooms[roomId]) {
            voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
            const allUsersInRoomIds = voiceRooms[roomId].map(u => u.userData.id);
            io.emit("voice_state_update", { channelId: roomId, users: allUsersInRoomIds });
            
            // Clean up empty rooms to save memory
            if(voiceRooms[roomId].length === 0) delete voiceRooms[roomId];
        }
    }
    delete socketToUser[socket.id];
  };

  socket.on("leave_voice", handleLeave);
  socket.on("disconnect", handleLeave);
});

server.listen(PORT, () => {
  console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
});