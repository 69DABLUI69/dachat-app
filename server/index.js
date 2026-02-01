require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const yts = require("yt-search"); 
const { AccessToken } = require('livekit-server-sdk');
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

const STEAM_API_KEY = "CD1B7F0E29E06F43E0F94CF1431C27AE";
const PORT = process.env.PORT || 3001;

const app = express();

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
    origin: [
        "https://dachat-app.onrender.com", 
        "https://dachat-app.vercel.app", 
        "http://localhost:3000"
    ],
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

// ==============================================================================
// 🔐 AUTH ROUTES
// ==============================================================================

app.post("/register", safeRoute(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || username.trim() === "" || password.trim() === "") {
      return res.json({ success: false, message: "Username and password are required" });
  }
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

app.post("/login", safeRoute(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || username.trim() === "" || password.trim() === "") {
      return res.json({ success: false, message: "Username and password are required" });
  }

  const { data: user, error } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle(); 

  if (error) return res.json({ success: false, message: "Database error" });
  if (!user) return res.json({ success: false, message: "Invalid credentials" });
  
  if (user.is_2fa_enabled) {
      return res.json({ success: false, requires2FA: true, userId: user.id }); 
  }

  res.json({ success: true, user });
}));

// --- 2FA ROUTES ---
app.post("/auth/2fa/generate", safeRoute(async (req, res) => {
    const { userId } = req.body;
    const secret = speakeasy.generateSecret({ name: "DaChat App" });
    await supabase.from("users").update({ two_factor_secret: secret.base32 }).eq("id", userId);
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
        res.json({ success: true, secret: secret.base32, qrCode: data_url });
    });
}));

app.post("/auth/2fa/enable", safeRoute(async (req, res) => {
    const { userId, token } = req.body;
    const { data: user } = await supabase.from("users").select("two_factor_secret").eq("id", userId).single();
    
    const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: token
    });

    if (verified) {
        await supabase.from("users").update({ is_2fa_enabled: true }).eq("id", userId);
        io.emit("user_updated", { userId });
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Code" });
    }
}));

app.post("/auth/2fa/login", safeRoute(async (req, res) => {
    const { userId, token } = req.body;
    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
    const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: token
    });
    if (verified) {
        res.json({ success: true, user });
    } else {
        res.json({ success: false, message: "Invalid 2FA Code" });
    }
}));

app.post("/auth/change-password", safeRoute(async (req, res) => {
    const { userId, newPassword, token } = req.body;
    if (!newPassword || newPassword.length < 4) return res.json({ success: false, message: "Password too short" });
    const { data: user } = await supabase.from("users").select("two_factor_secret, is_2fa_enabled").eq("id", userId).single();
    if (!user || !user.is_2fa_enabled) return res.json({ success: false, message: "2FA must be enabled to use this feature." });
    const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: token
    });
    if (!verified) return res.json({ success: false, message: "Invalid Authenticator Code" });
    const { error } = await supabase.from("users").update({ password: newPassword }).eq("id", userId);
    if (error) return res.json({ success: false, message: "Database Update Failed" });
    res.json({ success: true });
}));

// ==============================================================================
// 👥 USER & FRIEND ROUTES
// ==============================================================================

app.get("/users/:id", safeRoute(async (req, res) => {
  const { data } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  res.json({ success: true, user: data });
}));

app.post("/update-profile", safeRoute(async (req, res) => {
  const { userId, username, avatarUrl, bio, notification_settings } = req.body;
  const updateData = { username, avatar_url: avatarUrl, bio };
  if(notification_settings) updateData.notification_settings = notification_settings;

  const { data, error } = await supabase.from("users").update(updateData).eq("id", userId).select().single();
  if(error) return res.json({ success: false, message: error.message });
  io.emit("user_updated", { userId });
  res.json({ success: true, user: data });
}));

app.get("/my-friends/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: friendRows } = await supabase.from("friends").select("friend_id").eq("user_id", userId);
  if (!friendRows || friendRows.length === 0) return res.json([]);
  const friendIds = friendRows.map(row => row.friend_id);
  const { data: friends } = await supabase.from("users").select("*").in("id", friendIds);
  res.json(friends || []);
}));

// --- FRIEND REQUESTS ---
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

app.get("/my-requests/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: requests } = await supabase.from("friend_requests").select("id, sender_id").eq("receiver_id", userId);
  if (!requests || requests.length === 0) return res.json([]);
  const senderIds = requests.map(r => r.sender_id);
  const { data: senders } = await supabase.from("users").select("*").in("id", senderIds);
  res.json(senders || []);
}));

app.post("/accept-request", safeRoute(async (req, res) => {
  const { myId, senderId } = req.body;
  await supabase.from("friends").insert([ { user_id: myId, friend_id: senderId }, { user_id: senderId, friend_id: myId } ]);
  await supabase.from("friend_requests").delete().match({ sender_id: senderId, receiver_id: myId });
  io.to(senderId.toString()).emit("request_accepted");
  res.json({ success: true });
}));

app.post("/decline-request", safeRoute(async (req, res) => {
  const { myId, senderId } = req.body;
  await supabase.from("friend_requests").delete().match({ sender_id: senderId, receiver_id: myId });
  res.json({ success: true });
}));

app.post("/remove-friend", safeRoute(async (req, res) => {
  const { myId, friendId } = req.body;
  const { error } = await supabase.from("friends").delete().or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`);
  if (error) return res.json({ success: false, message: error.message });
  res.json({ success: true });
}));

// ==============================================================================
// 🖥️ SERVER & CHANNEL ROUTES
// ==============================================================================

app.get("/my-servers/:userId", safeRoute(async (req, res) => {
  const { userId } = req.params;
  const { data: members } = await supabase.from("members").select("server_id").eq("user_id", userId);
  if (!members || members.length === 0) return res.json([]);
  const serverIds = members.map(m => m.server_id);
  const { data: servers } = await supabase.from("servers").select("*").in("id", serverIds);
  res.json(servers || []);
}));

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

app.post("/servers/update", safeRoute(async (req, res) => {
  const { serverId, userId, name, imageUrl } = req.body;
  const { data: member } = await supabase.from("members").select("is_admin").eq("server_id", serverId).eq("user_id", userId).single();
  if (!member || !member.is_admin) return res.json({ success: false, message: "No permission" });

  const { data } = await supabase.from("servers").update({ name, image_url: imageUrl }).eq("id", serverId).select().single();
  io.emit("server_updated", { serverId });
  res.json({ success: true, server: data });
}));

app.post("/servers/promote", safeRoute(async (req, res) => {
  const { serverId, ownerId, targetUserId } = req.body;
  const { data: server } = await supabase.from("servers").select("owner_id").eq("id", serverId).single();
  if (server.owner_id !== ownerId) return res.json({ success: false, message: "Only Owner can promote" });

  const { data: target } = await supabase.from("members").select("is_admin").eq("server_id", serverId).eq("user_id", targetUserId).single();
  await supabase.from("members").update({ is_admin: !target.is_admin }).eq("server_id", serverId).eq("user_id", targetUserId);
  io.emit("server_updated", { serverId });
  res.json({ success: true });
}));

app.post("/servers/invite", safeRoute(async (req, res) => {
  const { serverId, userString } = req.body; 
  const { data: user } = await supabase.from("users").select("*").eq("username", userString).maybeSingle();
  if (!user) return res.json({ success: false, message: "User not found" });

  const { data: exists } = await supabase.from("members").select("*").eq("server_id", serverId).eq("user_id", user.id).maybeSingle();
  if (exists) return res.json({ success: false, message: "Already a member" });

  await supabase.from("members").insert([{ server_id: serverId, user_id: user.id }]);
  io.emit("new_server_invite", { userId: user.id, serverId });
  io.emit("server_updated", { serverId });
  res.json({ success: true });
}));

app.post("/servers/leave", safeRoute(async (req, res) => {
  const { serverId, userId } = req.body;
  const { data: server } = await supabase.from("servers").select("owner_id").eq("id", serverId).single();
  
  if (server.owner_id === userId) {
      await supabase.from("servers").delete().eq("id", serverId);
  } else {
      await supabase.from("members").delete().eq("server_id", serverId).eq("user_id", userId);
  }
  io.emit("server_updated", { serverId });
  res.json({ success: true });
}));

// --- CHANNEL ROUTES ---
app.post("/create-channel", safeRoute(async (req, res) => {
  const { serverId, userId, name, type } = req.body;
  const { data: member } = await supabase.from("members").select("is_admin").eq("server_id", serverId).eq("user_id", userId).single();
  if (!member || !member.is_admin) return res.json({ success: false, message: "No permission" });

  const { data } = await supabase.from("channels").insert([{ server_id: serverId, name, type }]).select().single();
  io.emit("server_updated", { serverId });
  res.json({ success: true, channel: data });
}));

app.post("/delete-channel", safeRoute(async (req, res) => {
  const { serverId, userId, channelId } = req.body;
  const { data: member } = await supabase.from("members").select("is_admin").eq("server_id", serverId).eq("user_id", userId).single();
  if (!member || !member.is_admin) return res.json({ success: false, message: "No permission" });

  await supabase.from("channels").delete().eq("id", channelId);
  io.emit("server_updated", { serverId });
  res.json({ success: true });
}));

app.get("/servers/:id/channels", safeRoute(async (req, res) => {
  const { data } = await supabase.from("channels").select("*").eq("server_id", req.params.id).order("created_at", { ascending: true });
  res.json(data || []);
}));

app.get("/servers/:id/members", safeRoute(async (req, res) => {
  const { data: members } = await supabase.from("members").select("is_admin, users(*)").eq("server_id", req.params.id);
  const formatted = members.map(m => ({ ...m.users, is_admin: m.is_admin }));
  res.json(formatted || []);
}));

// ==============================================================================
// 🎵 AUDIO & INTEGRATIONS
// ==============================================================================

// Room Audio State with Queue & Timing
let roomAudioState = {};

app.post("/channels/play", safeRoute(async (req, res) => {
  const { channelId, query, action } = req.body;
  const roomKey = channelId.toString();

  if (!roomAudioState[roomKey]) {
      roomAudioState[roomKey] = {
          current: null,
          queue: [],
          startTime: null,
          elapsed: 0,
          isPaused: false
      };
  }

  const state = roomAudioState[roomKey];

  if (action === 'queue') {
      const r = await yts(query);
      const video = r.videos[0];
      if (!video) return res.json({ success: false, message: "No results" });

      const track = {
          videoId: video.videoId,
          title: video.title,
          image: video.thumbnail,
          duration: video.seconds
      };

      if (!state.current) {
          state.current = track;
          state.startTime = Date.now();
          state.elapsed = 0;
          state.isPaused = false;
      } else {
          state.queue.push(track);
      }
  }

  else if (action === 'pause') {
      if (state.current && !state.isPaused) {
          state.elapsed += Date.now() - state.startTime;
          state.startTime = null;
          state.isPaused = true;
      }
  }

  else if (action === 'resume') {
      if (state.current && state.isPaused) {
          state.startTime = Date.now();
          state.isPaused = false;
      }
  }

  else if (action === 'skip') {
      if (state.queue.length > 0) {
          state.current = state.queue.shift(); 
          state.startTime = Date.now();
          state.elapsed = 0;
          state.isPaused = false;
      } else {
          state.current = null; 
          state.startTime = null;
      }
  }

  else if (action === 'stop') {
      delete roomAudioState[roomKey];
      io.to(roomKey).emit("audio_state_clear");
      return res.json({ success: true });
  }

  io.to(roomKey).emit("audio_state_update", state);
  res.json({ success: true, state });
}));

// 🐛 BUG REPORT ROUTE
app.post("/report-bug", upload.single("screenshot"), safeRoute(async (req, res) => {
  const { description, userId } = req.body;
  if (!description) return res.status(400).json({ success: false, message: "Description required" });

  let screenshotUrl = null;
  if (req.file) {
      const fileName = `bugs/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
      if (!uploadError) {
          const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);
          screenshotUrl = data.publicUrl;
      }
  }

  const { error } = await supabase.from("bug_reports").insert([{
      user_id: userId,
      description: description,
      screenshot_url: screenshotUrl
  }]);

  if (error) {
      console.error("Bug Report DB Error:", error);
      return res.status(500).json({ success: false, message: "Failed to save report" });
  }
  res.json({ success: true, message: "Bug reported successfully!" });
}));

// --- UPLOAD ---
app.post("/upload", upload.single("file"), safeRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  
  const { error } = await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
  if (error) {
    console.error("Supabase Storage Error:", error);
    return res.json({ success: false, message: "Upload failed" });
  }
  
  const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(fileName);
  res.json({ success: true, fileUrl: publicData.publicUrl });
}));

// 1. Link Steam ID to User
app.post("/users/link-steam", safeRoute(async (req, res) => {
    const { userId, steamId } = req.body;
    if (!steamId || steamId.length !== 17) return res.json({ success: false, message: "Invalid Steam ID64" });

    const { data, error } = await supabase.from("users").update({ steam_id: steamId }).eq("id", userId).select().single();
    if (error) return res.json({ success: false, message: error.message });
    
    io.emit("user_updated", { userId });
    res.json({ success: true, user: data });
}));

// 2. Get Steam Status (Rich Presence)
app.post("/users/steam-status", safeRoute(async (req, res) => {
    const { steamIds } = req.body; 
    if (!steamIds || steamIds.length === 0) return res.json({ success: true, players: [] });

    const idsString = steamIds.join(',');
    const steamUrl = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${idsString}`;

    const response = await fetch(steamUrl);
    const data = await response.json();
    
    const players = data.response.players || [];
    res.json({ success: true, players });
}));

// ⚡️ LIVEKIT TOKEN GENERATION
app.get("/livekit/token", safeRoute(async (req, res) => {
    const { roomName, participantName, avatarUrl } = req.query;

    if (!roomName || !participantName) {
        return res.status(400).json({ error: "Missing roomName or participantName" });
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
        console.error("❌ MISSING LIVEKIT KEYS ON SERVER");
        return res.status(500).json({ error: "Server missing LiveKit Keys" });
    }

    try {
        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: participantName,
                ttl: 600, 
                metadata: JSON.stringify({ avatarUrl: avatarUrl || "" }) 
            }
        );

        at.addGrant({ 
            roomJoin: true, 
            room: roomName, 
            canPublish: true, 
            canSubscribe: true 
        });

        const token = await at.toJwt();
        res.json({ token });
    } catch (err) {
        console.error("Token Gen Error:", err);
        res.status(500).json({ error: "Failed to generate token" });
    }
}));

// ==============================================================================
// 🔥 SOCKET.IO LOGIC
// ==============================================================================

const onlineUsers = new Map(); 
let voiceRooms = {};           
let socketToUser = {};         

// ✅ HELPER: Clean up user from voice rooms properly
const cleanupVoiceUser = (socket, io) => {
    const info = socketToUser[socket.id];
    if (info) {
        const { roomId, userData } = info;
        if (voiceRooms[roomId]) {
            // Remove user from the room list
            voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.userData.id !== userData.id);
            
            // Broadcast updated sidebar to everyone else
            const userIds = voiceRooms[roomId].map(u => u.userData.id);
            io.emit("voice_state_update", { channelId: roomId, users: userIds });
            
            // Cleanup empty rooms
            if (voiceRooms[roomId].length === 0) delete voiceRooms[roomId];
        }
        socket.leave(roomId);
    }
    delete socketToUser[socket.id];
};

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // --- 1. SETUP & ONLINE STATUS ---
  socket.on("setup", (userId) => {
    socket.userData = { id: userId };
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    
    // ✅ CRITICAL FIX: Join user's personal room for notifications
    socket.join(userId.toString());
    
    socket.emit("connected");
    io.emit("user_connected", userId);
  });

  socket.on("get_online_users", () => {
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit("online_users", onlineIds);
  });

  // ✅ New Listener for sidebar avatars
  socket.on("get_voice_states", () => {
      const states = {};
      for(const [roomId, users] of Object.entries(voiceRooms)) {
          states[roomId] = users.map(u => u.userData.id);
      }
      socket.emit("voice_states", states);
  });

  // --- 2. CHAT & ROOMS ---
  socket.on("join_room", async ({ roomId }) => {
    socket.join(roomId);
    try {
      // ✅ Fetch messages AND their reactions using Supabase relationship
      const selectQuery = "*, reactions:message_reactions(*)"; 

      if (roomId.toString().startsWith("dm-")) {
          const parts = roomId.split("-");
          if(parts.length >= 3) {
              const u1 = parts[1];
              const u2 = parts[2];
              const { data } = await supabase
                  .from("messages")
                  .select(selectQuery)
                  .or(`and(sender_id.eq.${u1},recipient_id.eq.${u2}),and(sender_id.eq.${u2},recipient_id.eq.${u1})`)
                  .order("created_at", { ascending: true });
              socket.emit("load_messages", data || []);
          }
      } else {
          const { data } = await supabase
              .from("messages")
              .select(selectQuery) 
              .eq("channel_id", roomId)
              .order("created_at", { ascending: true });
          socket.emit("load_messages", data || []);
      }
    } catch (err) { console.error("Message Fetch Error:", err); }
  });

  // FEATURE: Send Message (With Reply)
  socket.on("send_message", async (data) => {
    const { content, senderId, senderName, fileUrl, channelId, recipientId, avatar_url, replyToId } = data;
    let room = channelId ? channelId.toString() : recipientId ? `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}` : null;
    
    // 1. Prepare the payload (includes reply logic)
    const messagePayload = { 
        ...data, 
        id: data.id || Date.now(), 
        created_at: new Date().toISOString(),
        reply_to_id: replyToId
    };
    
    // 2. Broadcast the message to the room
    if (room) io.to(room).emit("receive_message", messagePayload);

    // 3. Handle Notifications for DM recipients
    if (recipientId) {
        try {
            const { data: recipient } = await supabase
                .from("users")
                .select("notification_settings")
                .eq("id", recipientId)
                .single();

            // ✅ FIX: Check settings safely. Default to TRUE if undefined/null.
            const settings = recipient?.notification_settings || {};
            const showNotif = settings.desktop_notifications !== false; // Only hide if explicitly FALSE

            if (showNotif) {
                io.to(recipientId.toString()).emit("push_notification", {
                    title: `New message from ${senderName}`,
                    body: content || "Sent an attachment",
                    icon: avatar_url || "/logo.png"
                });
            }
        } catch (err) {
            console.error("Notification Error:", err);
        }
    }

    // 4. Save to Database
    try {
        await supabase.from("messages").insert([{
            id: messagePayload.id,
            content,
            sender_id: senderId,
            sender_name: senderName,
            file_url: fileUrl,
            avatar_url: avatar_url,
            channel_id: channelId || null,
            recipient_id: recipientId || null,
            reply_to_id: replyToId || null
        }]);
    } catch (err) { 
        console.error("DB Save Error:", err); 
    }
  });

  // ⚡️ FEATURE: Edit Message
  socket.on("edit_message", async ({ messageId, newContent, roomId }) => {
      const { error } = await supabase.from("messages").update({ content: newContent, is_edited: true }).eq("id", messageId);
      if (!error && roomId) {
          io.to(roomId.toString()).emit("message_updated", { id: messageId, content: newContent, is_edited: true });
      }
  });

  // ⚡️ FEATURE: Toggle Reaction (NEW)
  socket.on("toggle_reaction", async ({ messageId, userId, emoji, roomId, messageOwnerId }) => {
      // Check if reaction exists
      const { data: existing } = await supabase
          .from("message_reactions")
          .select("id")
          .eq("message_id", messageId)
          .eq("user_id", userId)
          .eq("emoji", emoji)
          .maybeSingle();

      if (existing) {
          // REMOVE reaction
          await supabase.from("message_reactions").delete().eq("id", existing.id);
          io.to(roomId).emit("reaction_updated", { messageId, userId, emoji, action: "remove" });
      } else {
          // ADD reaction
          await supabase.from("message_reactions").insert([{ message_id: messageId, user_id: userId, emoji }]);
          io.to(roomId).emit("reaction_updated", { messageId, userId, emoji, action: "add" });

          // 🔔 NOTIFICATION LOGIC
          if (messageOwnerId && messageOwnerId !== userId) {
             const { data: owner } = await supabase.from("users").select("notification_settings").eq("id", messageOwnerId).single();
             const settings = owner?.notification_settings || {};
             
             if (settings.reaction_notifications === "all" && settings.desktop_notifications !== false) {
                 io.to(messageOwnerId.toString()).emit("push_notification", {
                     title: "New Reaction",
                     body: `Someone reacted ${emoji} to your message`,
                     icon: "/logo.png"
                 });
             }
          }
      }
  });

  socket.on("delete_message", async ({ messageId, roomId }) => {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (!error) io.to(roomId).emit("message_deleted", messageId);
  });

  // ⚡️ FEATURE: Soundboard Trigger
  socket.on("play_sound", ({ roomId, soundId }) => {
      io.to(roomId).emit("trigger_sound", { soundId });
  });

  // --- 3. CALLS ---
  socket.on("start_call", ({ senderId, recipientId, roomId, senderName, avatarUrl }) => {
    io.to(recipientId.toString()).emit("incoming_call", { senderId, senderName, avatarUrl, roomId });
  });

  socket.on("reject_call", ({ callerId }) => {
      io.to(callerId.toString()).emit("call_rejected");
  });

  // --- 4. VOICE ROOM HANDLING ---
  socket.on("join_voice", ({ roomId, userData }) => {
    const rId = roomId.toString();
    socket.join(rId); 

    if (roomAudioState[rId]) {
        socket.emit("audio_state_update", roomAudioState[rId]);
    } else {
        socket.emit("audio_state_clear");
    }

    if (!voiceRooms[rId]) voiceRooms[rId] = [];
    voiceRooms[rId] = voiceRooms[rId].filter(u => u.userData.id !== userData.id);
    voiceRooms[rId].push({ socketId: socket.id, userData });
    
    socketToUser[socket.id] = { roomId: rId, userData };

    const userIds = voiceRooms[rId].map(u => u.userData.id);
    io.emit("voice_state_update", { channelId: rId, users: userIds });
  });

  socket.on("leave_voice", () => {
      cleanupVoiceUser(socket, io);
  });

  // --- 5. DISCONNECT ---
  socket.on("disconnect", () => {
    cleanupVoiceUser(socket, io);
    if (socket.userData && socket.userData.id) {
      const userId = socket.userData.id;
      if (onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId);
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("user_disconnected", userId);
        }
      }
    }
    console.log("Disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
});