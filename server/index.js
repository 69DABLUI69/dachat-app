require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const yts = require("yt-search"); 
const STEAM_API_KEY = "CD1B7F0E29E06F43E0F94CF1431C27AE";
const { AccessToken } = require('livekit-server-sdk');

const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

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

// ... [KEEP ALL AUTH, USER, FRIEND, SERVER, CHANNEL ROUTES HERE] ...
// (To save space, assume all your existing app.post('/register'...) routes are here. Do NOT delete them.)
// ... 

// ⚡️ LIVEKIT TOKEN GENERATION (FIXED)
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
                ttl: 600, // ✅ Fixed: Use integer seconds (10 mins)
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

// ... [KEEP MUSIC / UPLOAD / STEAM ROUTES HERE] ...

// ----------------------------------------------------------------------
// 🔥 SOCKET.IO LOGIC
// ----------------------------------------------------------------------

const onlineUsers = new Map(); 
let voiceRooms = {};           
let socketToUser = {};
let roomAudioState = {};       

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // --- 1. SETUP ---
  socket.on("setup", (userId) => {
    socket.userData = { id: userId };
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.join(userId.toString());
    socket.emit("connected");
    io.emit("user_connected", userId);
  });

  socket.on("get_online_users", () => {
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit("online_users", onlineIds);
  });

  // --- 2. CHAT ---
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
    } catch (err) { console.error("Message Fetch Error:", err); }
  });

  // ⚡️ FEATURE: Send Message (With Replies)
  socket.on("send_message", async (data) => {
    const { content, senderId, senderName, fileUrl, channelId, recipientId, avatar_url, replyToId } = data;
    let room = channelId ? channelId.toString() : recipientId ? `dm-${[senderId, recipientId].sort((a,b)=>a-b).join('-')}` : null;
    
    const messagePayload = { ...data, id: data.id || Date.now(), created_at: new Date().toISOString() };
    
    if (room) io.to(room).emit("receive_message", messagePayload);

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
    } catch (err) { console.error("DB Save Error:", err); }
  });

  // ⚡️ FEATURE: Edit Message
  socket.on("edit_message", async ({ messageId, newContent, roomId }) => {
      try {
          const { error } = await supabase.from("messages").update({ content: newContent, is_edited: true }).eq("id", messageId);
          if (!error) {
              io.to(roomId.toString()).emit("message_updated", { id: messageId, content: newContent, is_edited: true });
          }
      } catch (err) { console.error("Edit Error:", err); }
  });

  socket.on("delete_message", async ({ messageId, roomId }) => {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (!error) io.to(roomId).emit("message_deleted", messageId);
  });

  // ⚡️ FEATURE: Soundboard
  socket.on("play_sound", ({ roomId, soundId }) => {
      io.to(roomId).emit("trigger_sound", { soundId });
  });

  // --- 3. CALLS & VOICE ---
  socket.on("start_call", ({ senderId, recipientId, roomId, senderName, avatarUrl }) => {
    io.to(recipientId.toString()).emit("incoming_call", { senderId, senderName, avatarUrl, roomId });
  });

  socket.on("reject_call", ({ callerId }) => {
      io.to(callerId.toString()).emit("call_rejected");
  });

  socket.on("leave_voice", () => { /* Placeholder for future cleanup if needed */ });

  socket.on("disconnect", () => {
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
  });
});

server.listen(PORT, () => {
  console.log(`✅ SERVER RUNNING ON PORT ${PORT}`);
});