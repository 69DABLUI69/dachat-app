require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const yts = require("yt-search"); // ⚠️ MAKE SURE TO INSTALL THIS: npm install yt-search
const STEAM_API_KEY = "CD1B7F0E29E06F43E0F94CF1431C27AE";

const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3001;

// 1. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 2. SUPABASE CONFIG
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ MISSING .ENV VARIABLES");
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 3. SOCKET SERVER SETUP
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from anywhere (App/Web)
    methods: ["GET", "POST"]
  }
});

// 4. FILE UPLOAD CONFIG (5MB limit)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

const safeRoute = (handler) => async (req, res, next) => {
  try { await handler(req, res, next); } 
  catch (err) { console.error("🔥 Route Error:", err.message); res.status(500).json({ success: false }); }
};

// --- AUTH ROUTES ---
app.post("/register", safeRoute(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "Missing fields" });
  
  const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const { data, error } = await supabase.from("users").insert([{ username, password, discriminator: Math.floor(1000 + Math.random() * 9000), avatar_url }]).select().single();

  if (error) return res.json({ success: false, message: error.message });
  res.json({ success: true, user: data });
}));

app.post("/login", safeRoute(async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle(); 

  if (error || !user) return res.json({ success: false, message: "Invalid credentials" });
  if (user.is_2fa_enabled) return res.json({ success: false, requires2FA: true, userId: user.id }); 

  res.json({ success: true, user });
}));

// --- 2FA ROUTES ---
app.post("/auth/2fa/generate", safeRoute(async (req, res) => {
    const { userId } = req.body;
    const secret = speakeasy.generateSecret({ name: "DaChat App" });
    await supabase.from("users").update({ two_factor_secret: secret.base32 }).eq("id", userId);
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => res.json({ success: true, qrCode: data_url }));
}));

app.post("/auth/2fa/enable", safeRoute(async (req, res) => {
    const { userId, token } = req.body;
    const { data: user } = await supabase.from("users").select("two_factor_secret").eq("id", userId).single();
    const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: "base32", token: token });

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
    const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: "base32", token: token });
    if (verified) res.json({ success: true, user });
    else res.json({ success: false, message: "Invalid 2FA Code" });
}));

app.post("/auth/change-password", safeRoute(async (req, res) => {
    const { userId, newPassword, token } = req.body;
    const { data: user } = await supabase.from("users").select("two_factor_secret").eq("id", userId).single();
    const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: "base32", token: token });
    
    if (verified) {
        await supabase.from("users").update({ password: newPassword }).eq("id", userId);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Code" });
    }
}));

// --- USER & FRIEND ROUTES ---
app.get("/users/:id", safeRoute(async (req, res) => {
  const { data } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  res.json({ success: true, user: data });
}));

app.post("/update-profile", safeRoute(async (req, res) => {
  const { userId, username, avatarUrl, bio } = req.body;
  const { data } = await supabase.from("users").update({ username, avatar_url: avatarUrl, bio }).eq("id", userId).select().single();
  io.emit("user_updated", { userId });
  res.json({ success: true, user: data });
}));

app.get("/my-friends/:userId", safeRoute(async (req, res) => {
  const { data: rows } = await supabase.from("friends").select("friend_id").eq("user_id", req.params.userId);
  if (!rows?.length) return res.json([]);
  const { data: friends } = await supabase.from("users").select("*").in("id", rows.map(r => r.friend_id));
  res.json(friends || []);
}));

// --- FRIEND REQUESTS ---
app.post("/send-request", safeRoute(async (req, res) => {
  const { myId, usernameToAdd } = req.body;
  const { data: target } = await supabase.from("users").select("*").eq("username", usernameToAdd).maybeSingle();
  if (!target) return res.json({ success: false, message: "User not found" });

  const { data: existing } = await supabase.from("friend_requests").select("*").eq("sender_id", myId).eq("receiver_id", target.id).maybeSingle();
  if (existing) return res.json({ success: false, message: "Already sent" });

  await supabase.from("friend_requests").insert([{ sender_id: myId, receiver_id: target.id }]);
  io.emit("new_friend_request", { toUserId: target.id });
  res.json({ success: true });
}));

app.get("/my-requests/:userId", safeRoute(async (req, res) => {
  const { data: reqs } = await supabase.from("friend_requests").select("sender_id").eq("receiver_id", req.params.userId);
  if (!reqs?.length) return res.json([]);
  const { data: senders } = await supabase.from("users").select("*").in("id", reqs.map(r => r.sender_id));
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
  await supabase.from("friends").delete().or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`);
  io.emit("friend_removed", { friendId });
  res.json({ success: true });
}));

// --- SERVER ROUTES ---
app.get("/my-servers/:userId", safeRoute(async (req, res) => {
  const { data: mems } = await supabase.from("members").select("server_id").eq("user_id", req.params.userId);
  if (!mems?.length) return res.json([]);
  const { data: servers } = await supabase.from("servers").select("*").in("id", mems.map(m => m.server_id));
  res.json(servers || []);
}));

app.post("/create-server", safeRoute(async (req, res) => {
  const { name, ownerId } = req.body;
  const { data: server } = await supabase.from("servers").insert([{ name, owner_id: ownerId }]).select().single();
  await supabase.from("members").insert([{ user_id: ownerId, server_id: server.id, is_admin: true }]);
  await supabase.from("channels").insert([{ server_id: server.id, name: "general", type: "text" }, { server_id: server.id, name: "voice", type: "voice" }]);
  res.json({ success: true, server });
}));

app.post("/servers/invite", safeRoute(async (req, res) => {
  const { serverId, userString } = req.body;
  const { data: user } = await supabase.from("users").select("*").eq("username", userString).single();
  if (!user) return res.json({ success: false, message: "User not found" });
  
  await supabase.from("members").insert([{ server_id: serverId, user_id: user.id }]);
  io.emit("new_server_invite", { userId: user.id });
  res.json({ success: true });
}));

app.post("/servers/leave", safeRoute(async (req, res) => {
  const { serverId, userId } = req.body;
  await supabase.from("members").delete().eq("server_id", serverId).eq("user_id", userId);
  io.emit("server_updated", { serverId });
  res.json({ success: true });
}));

app.get("/servers/:id/channels", safeRoute(async (req, res) => {
  const { data } = await supabase.from("channels").select("*").eq("server_id", req.params.id).order("created_at");
  res.json(data || []);
}));

app.get("/servers/:id/members", safeRoute(async (req, res) => {
  const { data } = await supabase.from("members").select("is_admin, users(*)").eq("server_id", req.params.id);
  res.json(data.map(m => ({ ...m.users, is_admin: m.is_admin })) || []);
}));

// --- 🎵 MUSIC PLAYER STATE ---
let roomAudioState = {};

app.post("/channels/play", safeRoute(async (req, res) => {
  const { channelId, query, action } = req.body;
  const roomKey = channelId.toString();

  // Init state if empty
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
      try {
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
      } catch (e) {
          console.error("YTS Error:", e);
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

// --- UPLOAD ---
app.post("/upload", upload.single("file"), safeRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { data } = await supabase.storage.from("uploads").upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(fileName);
    res.json({ success: true, fileUrl: publicData.publicUrl });
}));

// --- STEAM ---
app.post("/users/link-steam", safeRoute(async (req, res) => {
    const { userId, steamId } = req.body;
    await supabase.from("users").update({ steam_id: steamId }).eq("id", userId);
    io.emit("user_updated", { userId });
    res.json({ success: true });
}));

app.post("/users/steam-status", safeRoute(async (req, res) => {
    const { steamIds } = req.body;
    if (!steamIds?.length) return res.json({ success: true, players: [] });
    const steamRes = await fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamIds.join(',')}`);
    const data = await steamRes.json();
    res.json({ success: true, players: data.response.players || [] });
}));

// --- SOCKET.IO ---
const onlineUsers = new Map();
let voiceRooms = {};
let socketToUser = {};

io.on("connection", (socket) => {
    socket.on("setup", (userId) => {
        socket.userData = { id: userId };
        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        onlineUsers.get(userId).add(socket.id);
        socket.join(userId.toString());
        io.emit("user_connected", userId);
    });

    socket.on("get_online_users", () => {
        socket.emit("online_users", Array.from(onlineUsers.keys()));
    });

    socket.on("join_room", async ({ roomId }) => {
        socket.join(roomId);
        if (roomId.startsWith("dm-")) {
            const parts = roomId.split("-");
            if(parts.length >= 3) {
                 const { data } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${parts[1]},recipient_id.eq.${parts[2]}),and(sender_id.eq.${parts[2]},recipient_id.eq.${parts[1]})`).order("created_at");
                 socket.emit("load_messages", data || []);
            }
        } else {
            const { data } = await supabase.from("messages").select("*").eq("channel_id", roomId).order("created_at");
            socket.emit("load_messages", data || []);
        }
    });

    socket.on("send_message", async (data) => {
        const { channelId, recipientId, senderId } = data;
        const room = channelId ? channelId.toString() : `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}`;
        io.to(room).emit("receive_message", { ...data, id: Date.now() });
        await supabase.from("messages").insert([{ ...data, created_at: new Date().toISOString() }]);
    });

    socket.on("delete_message", async ({ messageId, roomId }) => {
        await supabase.from("messages").delete().eq("id", messageId);
        io.to(roomId).emit("message_deleted", messageId);
    });

    // CALLS & VOICE
    socket.on("start_call", ({ recipientId, ...data }) => {
        io.to(recipientId.toString()).emit("incoming_call", data);
    });
    socket.on("reject_call", ({ callerId }) => {
        io.to(callerId.toString()).emit("call_rejected");
    });

    socket.on("join_voice", ({ roomId, userData }) => {
        const rId = roomId.toString();
        if (!voiceRooms[rId]) voiceRooms[rId] = [];
        voiceRooms[rId] = voiceRooms[rId].filter(u => u.socketId !== socket.id);
        voiceRooms[rId].push({ socketId: socket.id, userData });
        socketToUser[socket.id] = { roomId: rId, userData };
        
        socket.join(rId);
        if(roomAudioState[rId]) socket.emit("audio_state_update", roomAudioState[rId]);
        
        socket.emit("all_users", voiceRooms[rId].filter(u => u.socketId !== socket.id));
        io.emit("voice_state_update", { channelId: rId, users: voiceRooms[rId].map(u => u.userData.id) });
    });

    socket.on("sending_signal", (payload) => io.to(payload.userToSignal).emit("user_joined", payload));
    socket.on("returning_signal", (payload) => io.to(payload.callerID).emit("receiving_returned_signal", { signal: payload.signal, id: socket.id }));
    socket.on("leave_voice", () => {
        const info = socketToUser[socket.id];
        if (info) {
            const { roomId } = info;
            if (voiceRooms[roomId]) {
                voiceRooms[roomId] = voiceRooms[roomId].filter(u => u.socketId !== socket.id);
                io.emit("voice_state_update", { channelId: roomId, users: voiceRooms[roomId].map(u => u.userData.id) });
            }
        }
        delete socketToUser[socket.id];
    });

    socket.on("disconnect", () => {
        if (socket.userData) {
            const userId = socket.userData.id;
            if(onlineUsers.has(userId)) {
                onlineUsers.get(userId).delete(socket.id);
                if(onlineUsers.get(userId).size === 0) {
                    onlineUsers.delete(userId);
                    io.emit("user_disconnected", userId);
                }
            }
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));