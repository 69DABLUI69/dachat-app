"use client";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import EmojiPicker, { Theme } from "emoji-picker-react";

const TAGLINES = [
  "Tel Aviv group trip 2026 ?", "Debis", "Endorsed by the Netanyahu cousins", "Also try DABROWSER",
  "Noua aplicatie suvenirista", "No Basinosu allowed", "Nu stati singuri cu bibi pe VC", "E buna Purcela",
  "I AM OBEZ DELUXE 2026 ?", "500 pe seara", "Sure buddy", "Mor vecinii", "Aplicatie de jocuri dusmanoasa",
  "Aplicatie de jocuri patriotica", "Aplicatie de jocuri prietenoasa", "Sanatate curata ma", "Garju 8-bit",
  "Five Nights at Valeriu (rip)", "Micu Vesel group trip 202(si ceva) ?"
];

// ⚠️ POLYFILL FOR SIMPLE-PEER
if (typeof window !== 'undefined') { 
    (window as any).global = window; 
    (window as any).process = { env: { DEBUG: undefined }, }; 
    (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; 
}

// 🌐 CONFIG
const BACKEND_URL = "https://dachat-app.onrender.com"; 
const KLIPY_API_KEY = "bfofoQzlu5Uu8tpvTAnOn0ZC64MyxoVBAgJv52RbIRqKnjidRZ6IPbQqnULhIIi9"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";

const PEER_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ]
};

// 🔌 SOCKET SINGLETON
const socket: Socket = io(BACKEND_URL, { 
    autoConnect: false,
    transports: ["websocket", "polling"]
});

// 🎨 CUSTOM COMPONENTS
const GlassPanel = ({ children, className, onClick, style }: any) => (
  <div onClick={onClick} style={style} className={`backdrop-blur-xl bg-gray-900/80 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 ${className}`}>
    {children}
  </div>
);

const UserAvatar = memo(({ src, alt, className, fallbackClass, onClick }: any) => {
  return src ? (
    <img key={src} onClick={onClick} src={src} alt={alt || "User"} className={`${className} bg-black/20 object-cover cursor-pointer transition-transform duration-300 ease-out hover:scale-110 active:scale-95`} loading="lazy" />
  ) : (
    <div onClick={onClick} className={`${className} ${fallbackClass || "bg-white/5"} flex items-center justify-center backdrop-blur-md border border-white/10 cursor-pointer transition-transform duration-300 ease-out hover:scale-110 active:scale-95`}>
       <span className="text-[10px] text-white/40 font-bold">?</span>
    </div>
  );
});
UserAvatar.displayName = "UserAvatar";

const GifPicker = ({ onSelect, onClose, className }: any) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { fetch(`${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`).then(r => r.json()).then(d => setGifs(d.results || [])); }, []);
  const searchGifs = async (q: string) => { if(!q) return; const res = await fetch(`${KLIPY_BASE_URL}/search?q=${q}&key=${KLIPY_API_KEY}&limit=20`); const data = await res.json(); setGifs(data.results || []); };
  return (
    <GlassPanel className={className || "absolute bottom-24 left-4 w-[90%] max-w-90 h-120 rounded-4xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 shadow-2xl ring-1 ring-white/10"}>
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-3xl flex gap-3 items-center">
        <input className="w-full bg-black/40 text-white px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5 placeholder-white/30 transition-all" placeholder="Search GIFs..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchGifs(search)} autoFocus />
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors active:scale-90">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="columns-2 gap-3 space-y-3">
          {gifs.map((g) => ( <div key={g.id} className="relative group overflow-hidden rounded-2xl cursor-pointer transition-all hover:scale-[1.02] hover:ring-2 ring-blue-500/50" onClick={() => onSelect(g?.media_formats?.gif?.url)}> <img src={g?.media_formats?.tinygif?.url} className="w-full h-auto object-cover rounded-xl" /> </div> ))}
        </div>
      </div>
    </GlassPanel>
  );
};

const DaChatLogo = ({ className = "w-12 h-12" }: { className?: string }) => ( <img src="/logo.png" alt="DaChat Logo" className={`${className} object-contain rounded-xl transition-transform hover:scale-110 duration-300`} /> );

export default function DaChat() {
  // --- STATE ---
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const [servers, setServers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [serverMembers, setServerMembers] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  const [view, setView] = useState("dms");
  const [active, setActive] = useState<any>({ server: null, channel: null, friend: null, pendingRequest: null });
  
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [is2FALogin, setIs2FALogin] = useState(false); 
  const [twoFACode, setTwoFACode] = useState("");
  const [tempUserId, setTempUserId] = useState<number | null>(null);

  const [showPassChange, setShowPassChange] = useState(false);
  const [passChangeForm, setPassChangeForm] = useState({ newPassword: "", code: "" });

  // For Setup Settings
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [setupStep, setSetupStep] = useState(0);

  const [showPassword, setShowPassword] = useState(false); // For Login
  const [showNewPassword, setShowNewPassword] = useState(false); // For Settings

  const [emojiBtnIcon, setEmojiBtnIcon] = useState("😀");
  const RANDOM_EMOJIS = ["😀", "😂", "😍", "😎", "🤔", "😜", "🥳", "🤩", "🤯", "🥶", "👾", "👽", "👻", "🤖", "🤠"];
  const [rememberMe, setRememberMe] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
      message: any | null;
  }>({ visible: false, x: 0, y: 0, message: null });

  // 🎵 MUSIC STATE
  const [currentTrack, setCurrentTrack] = useState<any>(null);

  // 🎮 STEAM STATE
  const [steamStatuses, setSteamStatuses] = useState<Record<string, any>>({});

  // Voice & Video State
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isCallExpanded, setIsCallExpanded] = useState(false); 
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [callEndedData, setCallEndedData] = useState<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [voiceStates, setVoiceStates] = useState<Record<string, number[]>>({});
  
  const peersRef = useRef<any[]>([]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const joinSoundRef = useRef<HTMLAudioElement | null>(null);
  const leaveSoundRef = useRef<HTMLAudioElement | null>(null);
  
  // 👇 1. ADDED REF FOR AUTO SCROLL
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsGifPicker, setShowSettingsGifPicker] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", bio: "", avatarUrl: "" });
  const [serverEditForm, setServerEditForm] = useState({ name: "", imageUrl: "" });
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newServerFile, setNewServerFile] = useState<File | null>(null);

  const [tagline, setTagline] = useState("Next Gen Communication");
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  useEffect(() => { if (isScreenSharing) setFocusedPeerId('local'); else if (focusedPeerId === 'local') setFocusedPeerId(null); }, [isScreenSharing]);
  const handleRemoteVideo = useCallback((peerId: string, hasVideo: boolean) => { if (hasVideo) setFocusedPeerId(peerId); else if (focusedPeerId === peerId) setFocusedPeerId(null); }, [focusedPeerId]);
  useEffect(() => { setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]); }, []);
  useEffect(() => { if (typeof window !== 'undefined') { joinSoundRef.current = new Audio('/join.mp3'); leaveSoundRef.current = new Audio('/leave.mp3'); joinSoundRef.current.load(); leaveSoundRef.current.load(); } }, []);

  useEffect(() => {
      const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  // 🎮 STEAM POLLING
  useEffect(() => {
      const fetchSteam = async () => {
          if (!user) return;
          const allUsers = [...friends, ...serverMembers];
          // Collect Steam IDs from friends and server members
          const steamIds = allUsers.map((u: any) => u.steam_id).filter((id) => id);
          if (steamIds.length === 0) return;

          const uniqueIds = Array.from(new Set(steamIds));
          const res = await fetch(`${BACKEND_URL}/users/steam-status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ steamIds: uniqueIds })
          });
          const data = await res.json();
          
          if (data.success) {
              const statusMap: Record<string, any> = {};
              data.players.forEach((p: any) => { statusMap[p.steamid] = p; });
              setSteamStatuses(statusMap);
          }
      };
      
      fetchSteam(); // Initial fetch
      const interval = setInterval(fetchSteam, 60000); // Poll every minute
      return () => clearInterval(interval);
  }, [friends, serverMembers, user]);

  useEffect(() => {
      const savedUser = localStorage.getItem("dachat_user");
      if (savedUser) {
          setUser(JSON.parse(savedUser));
      }
  }, []);

  const saveSteamId = async () => {
      const id = prompt("Enter your Steam ID64 (looks like 765611980...):");
      if(!id) return;
      await fetch(`${BACKEND_URL}/users/link-steam`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, steamId: id })
      });
      setUser({...user, steam_id: id});
  };

  // --- 1. INIT & RECONNECTION LOGIC ---
  useEffect(() => { 
      socket.connect(); 
      const handleConnect = () => { if (user) { socket.emit("setup", user.id); socket.emit("get_online_users"); } };
      socket.on("connect", handleConnect);
      socket.on("connect_error", (err) => console.error("Connection Error:", err));
      if (socket.connected && user) { socket.emit("setup", user.id); socket.emit("get_online_users"); }
      return () => { socket.off("connect", handleConnect); socket.disconnect(); }; 
  }, [user]); 

  // --- 2. GLOBAL EVENT LISTENERS ---
  useEffect(() => { 
      // ✅ BUG FIX: Normalize and check sender
      socket.on("receive_message", (msg) => { 
          const normalized = {
              ...msg,
              sender_id: msg.sender_id || msg.senderId, 
              sender_name: msg.sender_name || msg.senderName,
              file_url: msg.file_url || msg.fileUrl
          };
          if (user && normalized.sender_id === user.id) return; 
          setChatHistory(prev => [...prev, normalized]); 
      });

      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      socket.on("message_deleted", (messageId) => { setChatHistory(prev => prev.filter(msg => msg.id !== messageId)); });
      
      // 🎵 MUSIC LISTENERS
      socket.on("audio_state_update", (track) => setCurrentTrack(track));
      socket.on("audio_state_clear", () => setCurrentTrack(null));

      socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); });
      socket.on("user_connected", (userId: number) => { setOnlineUsers(prev => new Set(prev).add(userId)); if (user) fetchFriends(user.id); });
      socket.on("user_disconnected", (userId: number) => { setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next; }); });
      socket.on("online_users", (users: number[]) => { setOnlineUsers(new Set(users)); });
      socket.on("user_updated", ({ userId }) => { if (viewingProfile && viewingProfile.id === userId) viewUserProfile(userId); if (active.server && user) fetchServers(user.id); if (user) fetchFriends(user.id); });
      socket.on("request_accepted", () => { if (user) { fetchFriends(user.id); fetchRequests(user.id); } });
      socket.on("friend_removed", () => { if (user) { fetchFriends(user.id); } });
      socket.on("new_friend_request", () => { if(user) fetchRequests(user.id); });
      socket.on("new_server_invite", () => { if(user) fetchServers(user.id); });
      socket.on("server_updated", ({ serverId }) => { if (active.server?.id === serverId && user) { fetchServers(user.id); selectServer({ id: serverId }); } });
      socket.on("incoming_call", (data) => { if (user && data.senderId === user.id) return; setIncomingCall(data); });
      socket.on("call_ended", () => { endCallSession(); });
      return () => { 
          socket.off("receive_message"); socket.off("load_messages"); socket.off("voice_state_update"); 
          socket.off("user_updated"); socket.off("new_friend_request"); socket.off("incoming_call"); 
          socket.off("server_updated"); socket.off("new_server_invite"); socket.off("call_ended");
          socket.off("user_connected"); socket.off("user_disconnected"); socket.off("online_users");
          socket.off("request_accepted"); socket.off("friend_removed"); socket.off("message_deleted");
          socket.off("audio_state_update"); socket.off("audio_state_clear");
      }; 
  }, [user, viewingProfile, active.server, inCall]);

  useEffect(() => { if (myVideoRef.current && screenStream) myVideoRef.current.srcObject = screenStream; }, [screenStream, isScreenSharing]);
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, active.channel, active.friend]);


  // --- AUTH ---
  const handleAuth = async () => {
    if (is2FALogin) {
        // Handle 2FA Verification
        const res = await fetch(`${BACKEND_URL}/auth/2fa/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: tempUserId, token: twoFACode })
        });
        const data = await res.json();
        if (data.success) {
            if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user));
            setUser(data.user); fetchServers(data.user.id); fetchFriends(data.user.id); fetchRequests(data.user.id); socket.emit("setup", data.user.id);
        } else {
            setError(data.message || "Invalid Code");
        }
        return;
    }

    // Normal Login
    if (!authForm.username.trim() || !authForm.password.trim()) { setError("Enter credentials"); return; }
    const endpoint = isRegistering ? "register" : "login";
    
    try {
      const res = await fetch(`${BACKEND_URL}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) });
      const data = await res.json();

      if (data.requires2FA) {
          setTempUserId(data.userId);
          setIs2FALogin(true);
          setError("");
          return;
      }

      if (data.success) {
        if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user));
        setUser(data.user); fetchServers(data.user.id); fetchFriends(data.user.id); fetchRequests(data.user.id); socket.emit("setup", data.user.id);
      } else setError(data.message || "Auth failed");
    } catch { setError("Connection failed"); }
  };

  // 👇 ADDED: LOGOUT FUNCTION
  const handleLogout = () => {
      if(confirm("Are you sure you want to log out?")) {
          localStorage.removeItem("dachat_user");
          window.location.reload();
      }
  };

  const fetchServers = async (id: number) => { const res = await fetch(`${BACKEND_URL}/my-servers/${id}`); setServers(await res.json()); };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());
  const fetchRequests = async (id: number) => setRequests(await (await fetch(`${BACKEND_URL}/my-requests/${id}`)).json());

  const selectServer = async (server: any) => {
    setView("servers"); setActive((prev:any) => ({ ...prev, server, friend: null, pendingRequest: null })); setIsCallExpanded(false); 
    const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`); const chData = await res.json(); setChannels(chData);
    if(!active.channel && chData.length > 0) { const firstText = chData.find((c:any) => c.type === 'text'); if (firstText) joinChannel(firstText); }
    const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`); setServerMembers(await memRes.json());
  };

  const joinChannel = (channel: any) => {
    if (channel.type === 'voice') { if (inCall && activeVoiceChannelId === channel.id.toString()) setIsCallExpanded(true); else if (channel.id) joinVoiceRoom(channel.id.toString()); }
    else { setActive((prev: any) => ({ ...prev, channel, friend: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() }); }
  };

  const selectFriend = (friend: any) => { setActive((prev: any) => ({ ...prev, friend, channel: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); const ids = [user.id, friend.id].sort((a, b) => a - b); socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` }); };
  const selectRequest = (requestUser: any) => { setActive((prev: any) => ({ ...prev, pendingRequest: requestUser, friend: null, channel: null })); setIsCallExpanded(false); setShowMobileChat(true); };

  const sendFriendRequest = async () => { const usernameToAdd = prompt("Enter username to request:"); if (!usernameToAdd) return; await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); };
  const handleAcceptRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/accept-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchFriends(user.id); fetchRequests(user.id); selectFriend(active.pendingRequest); };
  const handleDeclineRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/decline-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchRequests(user.id); setActive({...active, pendingRequest: null}); };
  const handleRemoveFriend = async () => { if (!viewingProfile) return; if (!confirm(`Are you sure you want to remove ${viewingProfile.username} from your friends?`)) return; await fetch(`${BACKEND_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendId: viewingProfile.id }) }); fetchFriends(user.id); setViewingProfile(null); };

  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { 
      const content = textMsg || (fileUrl ? "Sent an image" : ""); 
      const payload: any = { content, senderId: user.id, senderName: user.username, fileUrl, avatar_url: user.avatar_url, id: Date.now(), created_at: new Date().toISOString() }; 
      setChatHistory(prev => [...prev, { ...payload, sender_id: user.id, sender_name: user.username, file_url: fileUrl, avatar_url: user.avatar_url }]);
      if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } 
      setMessage(""); 
  };

  const deleteMessage = (msgId: number) => {
      const roomId = active.channel ? active.channel.id.toString() : `dm-${[user.id, active.friend.id].sort((a,b)=>a-b).join('-')}`;
      socket.emit("delete_message", { messageId: msgId, roomId });
      setChatHistory(prev => prev.filter(m => m.id !== msgId));
  };

  // 🎵 MUSIC HELPERS (Strictly tied to activeVoiceChannelId)
  const playMusic = async (query: string) => {
      if (!activeVoiceChannelId) return; // ✅ Must be in voice
      await fetch(`${BACKEND_URL}/channels/play`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeVoiceChannelId, query, action: 'play' })
      });
  };

  const stopMusic = async () => {
      if (!activeVoiceChannelId) return; // ✅ Must be in voice
      await fetch(`${BACKEND_URL}/channels/play`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeVoiceChannelId, action: 'stop' })
      });
  };

  const handleContextMenu = (e: React.MouseEvent, msg: any) => {
      e.preventDefault(); 
      setContextMenu({ visible: true, x: e.pageX, y: e.pageY, message: msg });
  };

  const copyText = (text: string) => {
      navigator.clipboard.writeText(text);
      setContextMenu({ ...contextMenu, visible: false });
  };

  const handleFileUpload = async (e: any) => { const file = e.target.files[0]; if(!file) return; const formData = new FormData(); formData.append("file", file); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if(data.success) sendMessage(null, data.fileUrl); };
  const viewUserProfile = async (userId: number) => { const res = await fetch(`${BACKEND_URL}/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };

  const openSettings = () => { setEditForm({ username: user.username, bio: user.bio || "", avatarUrl: user.avatar_url }); setShowSettings(true); };
  const saveProfile = async () => { let finalAvatarUrl = editForm.avatarUrl; if (newAvatarFile) { const formData = new FormData(); formData.append("file", newAvatarFile); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.success) finalAvatarUrl = data.fileUrl; } await fetch(`${BACKEND_URL}/update-profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, username: editForm.username, bio: editForm.bio, avatarUrl: finalAvatarUrl }) }); setUser((prev:any) => ({...prev, username: editForm.username, bio: editForm.bio, avatar_url: finalAvatarUrl})); setShowSettings(false); };
  const handleChangePassword = async () => {
      if (!passChangeForm.newPassword || !passChangeForm.code) {
          alert("Please fill in both fields");
          return;
      }

      const res = await fetch(`${BACKEND_URL}/auth/change-password`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
              userId: user.id, 
              newPassword: passChangeForm.newPassword, 
              token: passChangeForm.code 
          })
      });

      const data = await res.json();

      if (data.success) {
          alert("Password Changed Successfully! Logging you out...");
          // Logout Logic
          localStorage.removeItem("dachat_user");
          window.location.reload(); // Reloads the page to force logout state
      } else {
          alert(data.message || "Failed to change password");
      }
  };

  // 🔐 2FA HELPER FUNCTIONS (Moved from JSX)
  const start2FASetup = async () => {
      const res = await fetch(`${BACKEND_URL}/auth/2fa/generate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
          setQrCodeUrl(data.qrCode);
          setSetupStep(1);
      }
  };

  const verify2FASetup = async () => {
      const res = await fetch(`${BACKEND_URL}/auth/2fa/enable`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, token: twoFACode })
      });
      const data = await res.json();
      if (data.success) {
          setSetupStep(2);
          alert("2FA Enabled!");
      } else {
          alert("Invalid Code");
      }
  };

  const createServer = async () => { const name = prompt("Server Name"); if(name) { await fetch(`${BACKEND_URL}/create-server`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId: user.id }) }); fetchServers(user.id); } };
  const createChannel = async () => { const name = prompt("Name"); const type = confirm("Voice?") ? "voice" : "text"; if(name) { await fetch(`${BACKEND_URL}/create-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, name, type }) }); selectServer(active.server); } };
  const deleteChannel = async (channelId: number) => { if(!confirm("Delete channel?")) return; await fetch(`${BACKEND_URL}/delete-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, channelId }) }); selectServer(active.server); };
  const inviteUser = async () => { const userString = prompt("Username to invite:"); if(!userString) return; const res = await fetch(`${BACKEND_URL}/servers/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userString }) }); alert((await res.json()).message || "Invited!"); };
  const leaveServer = async () => { if(!confirm("Leave server?")) return; await fetch(`${BACKEND_URL}/servers/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id }) }); setView("dms"); setActive({server:null}); fetchServers(user.id); };
  const openServerSettings = () => { setServerEditForm({ name: active.server.name, imageUrl: active.server.image_url || "" }); setShowServerSettings(true); };
  const saveServerSettings = async () => { let finalImg = serverEditForm.imageUrl; if (newServerFile) { const formData = new FormData(); formData.append("file", newServerFile); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); finalImg = (await res.json()).fileUrl; } await fetch(`${BACKEND_URL}/servers/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, name: serverEditForm.name, imageUrl: finalImg }) }); setShowServerSettings(false); };
  const promoteMember = async (targetId: number) => { if(!confirm("Toggle Moderator Status?")) return; await fetch(`${BACKEND_URL}/servers/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, ownerId: user.id, targetUserId: targetId }) }); };
  const getRole = () => user ? serverMembers.find(m => m.id === user.id) : null;
  const isMod = getRole()?.is_admin;
  const isOwner = user && active.server?.owner_id === user.id;

  const playSound = (type: 'join' | 'leave') => { const audio = type === 'join' ? joinSoundRef.current : leaveSoundRef.current; if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(e => console.error(e)); } };

  const startDMCall = () => { if (!active.friend) return; const ids = [user.id, active.friend.id].sort((a, b) => a - b); const roomId = `dm-call-${ids[0]}-${ids[1]}`; joinVoiceRoom(roomId); socket.emit("start_call", { senderId: user.id, recipientId: active.friend.id, senderName: user.username, avatarUrl: user.avatar_url, roomId: roomId }); };
  const answerCall = () => { if (incomingCall) { joinVoiceRoom(incomingCall.roomId); setIncomingCall(null); } };
  const removePeer = (peerID: string) => { playSound('leave'); const peerIdx = peersRef.current.findIndex(p => p.peerID === peerID); if (peerIdx > -1) { peersRef.current[peerIdx].peer.destroy(); peersRef.current.splice(peerIdx, 1); } setPeers(prev => prev.filter(p => p.peerID !== peerID)); setFocusedPeerId(current => (current === peerID ? null : current)); };
  
  const joinVoiceRoom = useCallback((roomId: string) => { if (!user) return; callStartTimeRef.current = Date.now(); setActiveVoiceChannelId(roomId); setIsCallExpanded(true); socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal"); navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => { setInCall(true); setMyStream(stream); socket.emit("join_voice", { roomId, userData: user }); socket.on("all_users", (users) => { const peersArr: any[] = []; users.forEach((u: any) => { const peer = createPeer(u.socketId, socket.id as string, stream, u.userData); peersRef.current.push({ peerID: u.socketId, peer, info: u.userData }); peersArr.push({ peerID: u.socketId, peer, info: u.userData }); }); setPeers(peersArr); }); socket.on("user_joined", (payload) => { playSound('join'); const item = peersRef.current.find(p => p.peerID === payload.callerID); if (item) { item.peer.signal(payload.signal); return; } const peer = addPeer(payload.signal, payload.callerID, stream); peersRef.current.push({ peerID: payload.callerID, peer, info: payload.userData }); setPeers(users => [...users, { peerID: payload.callerID, peer, info: payload.userData }]); }); socket.on("receiving_returned_signal", (payload) => { const item = peersRef.current.find(p => p.peerID === payload.id); if (item) item.peer.signal(payload.signal); }); }).catch(err => { 
      console.error("Mic Error:", err); 
      // 🔥 BETTER ERROR HANDLING FOR MOBILE
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert("Microphone requires HTTPS! Please use a secure connection or localhost.");
      } else {
        alert(`Mic Error: ${err.name} - ${err.message}`); 
      }
  }); }, [user]);

  const createPeer = (userToSignal: string, callerID: string, stream: MediaStream, userData: any) => { const peer = new Peer({ initiator: true, trickle: false, stream, config: PEER_CONFIG }); peer.on("signal", (signal: any) => { socket.emit("sending_signal", { userToSignal, callerID, signal, userData: user }); }); peer.on("close", () => removePeer(userToSignal)); peer.on("error", () => removePeer(userToSignal)); return peer; };
  const addPeer = (incomingSignal: any, callerID: string, stream: MediaStream) => { const peer = new Peer({ initiator: false, trickle: false, stream, config: PEER_CONFIG }); peer.on("signal", (signal: any) => { socket.emit("returning_signal", { signal, callerID }); }); peer.on("close", () => removePeer(callerID)); peer.on("error", () => removePeer(callerID)); peer.signal(incomingSignal); return peer; };
  const startScreenShare = async () => { try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); setScreenStream(stream); setIsScreenSharing(true); const screenTrack = stream.getVideoTracks()[0]; if (myVideoRef.current) myVideoRef.current.srcObject = stream; peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if (pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if (sender) sender.replaceTrack(screenTrack); else peerObj.peer.addTrack(screenTrack, myStream); } }); screenTrack.onended = () => stopScreenShare(); } catch(e) { console.error("Screen Share Error:", e); } };
  const stopScreenShare = () => { screenStream?.getTracks().forEach(t => t.stop()); setScreenStream(null); setIsScreenSharing(false); if (focusedPeerId === 'local') setFocusedPeerId(null); if(myStream) { const webcamTrack = myStream.getVideoTracks()[0]; if(webcamTrack) { peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if(pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if(sender) sender.replaceTrack(webcamTrack); } }); } } };
  const getCallDuration = () => { if (!callStartTimeRef.current) return "00:00"; const diff = Math.floor((Date.now() - callStartTimeRef.current) / 1000); const m = Math.floor(diff / 60).toString().padStart(2, '0'); const s = (diff % 60).toString().padStart(2, '0'); return `${m}:${s}`; };
  const endCallSession = () => { if (inCall && callStartTimeRef.current) { const duration = getCallDuration(); setCallEndedData(duration); } if(isScreenSharing) stopScreenShare(); setInCall(false); setIncomingCall(null); setFocusedPeerId(null); setActiveVoiceChannelId(null); setIsCallExpanded(false); if(myStream) { myStream.getTracks().forEach(t => t.stop()); setMyStream(null); } setPeers([]); peersRef.current.forEach(p => { try { p.peer.destroy(); } catch(e){} }); peersRef.current = []; callStartTimeRef.current = null; };
  const leaveCall = () => { endCallSession(); socket.emit("leave_voice"); };

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-black relative overflow-hidden p-0 md:p-4">
      <div className="absolute inset-0 bg-linear-to-br from-indigo-900 via-purple-900 to-black opacity-40 animate-pulse-slow"></div>
      <div className="absolute top-[-20%] left-[-10%] w-150 h-150 bg-blue-600/20 rounded-full blur-[120px] animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-150 h-150 bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
      
      <GlassPanel className="p-10 w-full h-full md:h-auto md:max-w-100 rounded-none md:rounded-[40px] text-center relative z-10 flex flex-col justify-center gap-6 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-32 h-32 mx-auto mb-2 flex items-center justify-center relative hover:scale-105 transition-transform duration-500">
            <div className="absolute inset-0 bg-blue-500/20 blur-[30px] rounded-full animate-pulse"></div>
            <img src="/logo.png" alt="DaChat" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(100,100,255,0.5)] rounded-4xl" />
        </div>
        <div> <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-white to-white/60">DaChat</h1> <p className="text-white/40 text-sm mt-2">{tagline}</p> </div>
        {error && <div className="bg-red-500/20 text-red-200 text-xs py-3 rounded-xl border border-red-500/20 animate-in slide-in-from-top-2">{error}</div>}
        
        {/* LOGIN FORM */}
        <div className="space-y-3">
            {!is2FALogin ? (
                <>
                    <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20 hover:bg-black/40" placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
                    
                    {/* 👇 UPDATED PASSWORD INPUT WITH TOGGLE */}
                    <div className="relative">
                        <input 
                            className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20 hover:bg-black/40 pr-12" 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Password" 
                            onChange={e => setAuthForm({ ...authForm, password: e.target.value })} 
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xl"
                        >
                            {showPassword ? "🙈" : "👁️"}
                        </button>
                    </div>

                    {!isRegistering && (
                        <div className="flex items-center gap-2 px-2">
                             <input 
                                type="checkbox" 
                                id="remember" 
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-blue-600"
                            />
                            <label htmlFor="remember" className="text-xs text-white/50 cursor-pointer select-none hover:text-white transition-colors">
                                Remember me
                            </label>
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4">
                    <div className="text-center text-white/50 mb-2 text-xs">Enter code from Authenticator</div>
                    <input 
                        className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                        placeholder="000 000" 
                        maxLength={6}
                        onChange={e => setTwoFACode(e.target.value)} 
                    />
                    <button onClick={() => setIs2FALogin(false)} className="w-full text-xs text-white/30 mt-2 hover:text-white">Back to Login</button>
                </div>
            )}
        </div>
        
        <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-2xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-[1.02] transition-all active:scale-95 duration-200">
            {is2FALogin ? "Verify 2FA" : (isRegistering ? "Create Account" : "Log in")}
        </button>

        {!is2FALogin && (
            <p className="text-xs text-white/40 cursor-pointer hover:text-white transition-colors" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? "Back to Login" : "Create an Account"}
            </p>
        )}
      </GlassPanel>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-linear-to-br from-indigo-900/40 via-black to-black z-0"></div>
      
      {/* 1. DOCK */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} z-30 w-22.5 h-full flex-col items-center py-8 gap-4 fixed left-0 top-0 border-r border-white/5 bg-black/40 backdrop-blur-xl animate-in fade-in slide-in-from-left-4 duration-500`}>
        <div onClick={() => { setView("dms"); setActive({server:null}); setIsCallExpanded(false); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${view === 'dms' ? "bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "hover:bg-white/5"}`}>
          <DaChatLogo className="w-7 h-7" />
        </div>
        <div className="w-8 h-px bg-white/10" />
        <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto no-scrollbar pt-2">
            {servers.map(s => ( 
                <div key={s.id} onClick={() => selectServer(s)} className="group relative w-12 h-12 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"> 
                    {active.server?.id === s.id && <div className="absolute -left-3 top-2 h-8 w-1 bg-white rounded-r-full animate-in fade-in slide-in-from-left-1" />} 
                    <UserAvatar src={s.image_url} alt={s.name} className={`w-12 h-12 object-cover transition-all duration-300 ${active.server?.id === s.id ? "rounded-2xl" : "rounded-3xl group-hover:rounded-2xl"}`} /> 
                </div> 
            ))}
            <div onClick={createServer} className="w-12 h-12 rounded-3xl border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white hover:text-green-400 text-white/40 transition-all duration-300 hover:scale-105 hover:bg-white/5"> + </div>
        </div>
        <UserAvatar onClick={openSettings} src={user.avatar_url} className="w-12 h-12 rounded-full cursor-pointer ring-2 ring-transparent hover:ring-white/50 transition-all duration-300 hover:scale-105" />
      </div>

      {/* 2. SIDEBAR */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} relative z-10 h-screen bg-black/20 backdrop-blur-md border-r border-white/5 flex-col md:w-65 md:ml-22.5 w-[calc(100vw-90px)] ml-22.5 animate-in fade-in duration-500`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 font-bold tracking-wide">
            <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">{active.server ? active.server.name : "Direct Messages"}</span>
            {active.server && isMod && <button onClick={openServerSettings} className="text-xs text-white/50 hover:text-white transition-colors duration-200 hover:rotate-90">⚙️</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {view === "servers" && active.server ? (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>Channels</span> {isMod && <button onClick={createChannel} className="text-lg hover:text-white transition-transform hover:scale-110">+</button>} </div>
                    {channels.map(ch => {
                        const currentUsers = voiceStates[ch.id.toString()] || [];
                        const activeMembers = serverMembers.filter(m => currentUsers.includes(m.id));
                        return ( 
                            <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200 ${active.channel?.id === ch.id ? "bg-white/10 text-white scale-[1.02]" : "text-white/50 hover:bg-white/5 hover:text-white hover:translate-x-1"}`}>
                                <div className="flex items-center gap-2 truncate flex-1 min-w-0" onClick={() => joinChannel(ch)}> 
                                    <span className="opacity-50 shrink-0">{ch.type==='voice'?'🔊':'#'}</span> 
                                    <span className="truncate">{ch.name}</span>
                                    {ch.type === 'voice' && activeMembers.length > 0 && (
                                        <div className="flex -space-x-1 ml-auto mr-2 shrink-0 animate-in fade-in">
                                            {activeMembers.slice(0, 3).map(m => ( <UserAvatar key={m.id} src={m.avatar_url} className="w-5 h-5 rounded-full border border-black/50" /> ))}
                                            {activeMembers.length > 3 && ( <div className="w-5 h-5 rounded-full bg-zinc-800 border border-black/50 flex items-center justify-center text-[8px] font-bold text-white">+{activeMembers.length - 3}</div> )}
                                        </div>
                                    )}
                                </div>
                                {isMod && <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-xs text-red-400 shrink-0 hover:text-red-300 transition-colors">✕</button>}
                            </div>
                        );
                    })}
                    <div className="mt-6 px-2 space-y-2">
                        <button onClick={inviteUser} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/30 transition-all hover:scale-[1.02] active:scale-95">Invite People</button>
                        <button onClick={leaveServer} className="w-full py-2 bg-red-600/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/20 transition-all hover:scale-[1.02] active:scale-95">Leave Server</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>Requests</span> <button onClick={sendFriendRequest} className="text-lg hover:text-white transition-transform hover:scale-110">+</button> </div>
                    {requests.map(req => ( 
                        <div key={req.id} onClick={() => selectRequest(req)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all duration-200 ${active.pendingRequest?.id===req.id?"bg-white/10 scale-[1.02]":""}`}> 
                            <UserAvatar src={req.avatar_url} className="w-8 h-8 rounded-full" /> 
                            <div><div className="text-xs font-bold">{req.username}</div><div className="text-[9px] text-yellow-400 animate-pulse">Request</div></div> 
                        </div> 
                    ))}
                    <div className="mt-4 px-2 text-[10px] font-bold text-white/40 uppercase">Friends</div>
                    {friends.map(f => {
                        const isOnline = onlineUsers.has(f.id) || (f as any).is_online;
                        // 🎮 STEAM STATUS LOGIC
                        const steamInfo = f.steam_id ? steamStatuses[f.steam_id] : null;
                        const isPlaying = steamInfo?.gameextrainfo;
                        const lobbyId = steamInfo?.lobbysteamid;

                        return (
                            <div key={f.id} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all duration-200 hover:translate-x-1 ${active.friend?.id===f.id?"bg-white/10 scale-[1.02]":""}`}> 
                                <div className="relative">
                                    <UserAvatar onClick={(e:any)=>{e.stopPropagation(); viewUserProfile(f.id)}} src={f.avatar_url} className={`w-8 h-8 rounded-full ${isPlaying ? "ring-2 ring-green-500" : ""}`} /> 
                                    {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>}
                                </div>
                                
                                <div className="flex-1 min-w-0" onClick={()=>selectFriend(f)}>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs font-bold truncate">{f.username}</div>
                                        {isPlaying && <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3 opacity-50" />}
                                    </div>
                                    
                                    {isPlaying ? (
                                        <div className="flex flex-col gap-1 mt-1">
                                            <div className="text-[10px] text-green-400 font-bold truncate">Playing {steamInfo.gameextrainfo}</div>
                                            {/* JOIN BUTTON */}
                                            <a 
                                                href={lobbyId ? `steam://joinlobby/${steamInfo.gameid}/${lobbyId}/${f.steam_id}` : `steam://run/${steamInfo.gameid}`}
                                                className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[9px] font-bold px-2 py-1 rounded border border-green-600/30 text-center transition-colors block"
                                                onClick={(e) => e.stopPropagation()} 
                                            >
                                                {lobbyId ? "🚀 Join Lobby" : "▶ Launch Game"}
                                            </a>
                                        </div>
                                    ) : (
                                        <div className={`text-[9px] transition-colors duration-300 ${isOnline ? "text-green-400/50" : "text-white/30"}`}>
                                            {isOnline ? "Online" : "Offline"}
                                        </div>
                                    )}
                                </div> 
                            </div> 
                        );
                    })}
                </>
            )}
        </div>

        {/* 🔥 NEW: Persistent Music Player in Sidebar (VISIBLE ONLY WHEN IN A CALL) */}
        {inCall && activeVoiceChannelId && (
            <RoomPlayer track={currentTrack} onSearch={playMusic} onClose={stopMusic} />
        )}
      </div>

      {/* 3. MAIN CONTENT */}
      <div className={`${showMobileChat ? 'flex animate-in slide-in-from-right-full duration-300' : 'hidden md:flex'} flex-1 flex-col relative z-10 min-w-0 bg-transparent`}>
         
         {/* LAYER 1: CHAT UI */}
         <div className="absolute inset-0 flex flex-col z-0">
             {(active.channel || active.friend) && (
                 <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md animate-in fade-in slide-in-from-top-2"> 
                    <div className="flex items-center gap-3 font-bold text-lg overflow-hidden"> 
                        <button className="md:hidden mr-2 p-1 text-white/50 hover:text-white transition-transform active:scale-90" onClick={() => setShowMobileChat(false)}>←</button>
                        <span className="text-white/30">@</span> 
                        <span className="truncate">{active.channel ? active.channel.name : active.friend?.username}</span>
                    </div> 
                    {!active.channel && <button onClick={startDMCall} className="bg-green-600 p-2 rounded-full hover:bg-green-500 shrink-0 transition-transform hover:scale-110 active:scale-90">📞</button>} 
                 </div>
             )}
             
             {inCall && !isCallExpanded && (
                 <div onClick={() => setIsCallExpanded(true)} className="bg-green-600/20 text-green-400 p-2 text-center text-xs font-bold cursor-pointer hover:bg-green-600/30 border-b border-green-600/20 transition-all animate-pulse">
                     🔊 Call in Progress — Click to Return
                 </div>
             )}

             {active.pendingRequest ? (
                 <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95">
                     <button className="md:hidden absolute top-4 left-4 text-white/50" onClick={() => setShowMobileChat(false)}>← Back</button>
                     <UserAvatar src={active.pendingRequest.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/10" />
                     <div className="text-xl font-bold">{active.pendingRequest.username}</div>
                     <div className="flex gap-3"> <button onClick={handleAcceptRequest} className="px-6 py-2 bg-green-600 rounded-lg font-bold hover:bg-green-500 transition-all hover:scale-105 active:scale-95">Accept</button> <button onClick={handleDeclineRequest} className="px-6 py-2 bg-red-600/30 text-red-200 rounded-lg font-bold hover:bg-red-600/40 transition-all hover:scale-105 active:scale-95">Decline</button> </div>
                 </div>
             ) : (active.channel || active.friend) ? (
                 <>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {chatHistory.map((msg, i) => ( 
                            <div 
                                key={msg.id || i} 
                                className={`flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`}
                                onContextMenu={(e) => handleContextMenu(e, msg)}
                            > 
                                <UserAvatar onClick={()=>viewUserProfile(msg.sender_id)} src={msg.avatar_url} className="w-10 h-10 rounded-xl hover:scale-105 transition-transform" /> 
                                <div className={`max-w-[85%] md:max-w-[70%] ${msg.sender_id===user.id?"items-end":"items-start"} flex flex-col`}> 
                                    <div className="flex items-center gap-2 mb-1"> 
                                      <span className="text-xs font-bold text-white/50">{msg.sender_name}</span> 
                                    </div> 
                                    
                                    <div className={`group px-4 py-2 rounded-2xl text-sm shadow-md cursor-pointer transition-all hover:scale-[1.01] ${msg.sender_id===user.id?"bg-blue-600":"bg-white/10"}`}> 
                                        {msg.content?.startsWith("http") ? <img src={msg.content} className="max-w-50 md:max-w-62.5 rounded-lg transition-transform hover:scale-105" /> : msg.content} 
                                    </div> 
                                    
                                    {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-62.5 rounded-xl border border-white/10 transition-transform hover:scale-105 cursor-pointer" />} 
                                </div> 
                            </div> 
                        ))}
                        {/* 👇 3. ADDED SCROLL ANCHOR */}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 relative">
                        {showEmojiPicker && (
                            <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-[30px] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
                                <EmojiPicker
                                    theme={Theme.DARK}
                                    onEmojiClick={(e) => setMessage((prev) => prev + e.emoji)}
                                    lazyLoadEmojis={true}
                                />
                            </div>
                        )}

                        {showGifPicker && <div className="absolute bottom-20 left-4 z-50 w-full"><GifPicker onSelect={(u:string)=>{sendMessage(null,u); setShowGifPicker(false)}} onClose={()=>setShowGifPicker(false)} /></div>}
                        
                        <div className="bg-white/5 border border-white/10 rounded-full p-2 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-black/40"> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>fileInputRef.current?.click()}>📎</button> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-[10px] font-bold text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>setShowGifPicker(!showGifPicker)}>GIF</button> 
                            
                            <button 
                                className={`w-10 h-10 rounded-full hover:bg-white/10 text-xl transition-transform hover:scale-110 active:scale-90 ${showEmojiPicker ? "bg-white/10 text-white" : "text-white/50"}`} 
                                onClick={() => {
                                    setShowEmojiPicker(!showEmojiPicker);
                                    setShowGifPicker(false);
                                }}
                                onMouseEnter={() => setEmojiBtnIcon(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)])}
                            >
                                {emojiBtnIcon} 
                            </button>

                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> 
                            <input className="flex-1 bg-transparent outline-none px-2 min-w-0" placeholder="Message..." value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage(message)} /> 
                        </div>
                    </div>
                 </>
             ) : <div className="flex-1 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest animate-pulse">Select a Channel</div>}
         </div>

         {/* LAYER 2: CALL UI */}
         {inCall && (
             <div className={`${isCallExpanded ? "fixed inset-0 z-50 bg-black animate-in zoom-in-95 duration-300" : "hidden"} flex flex-col relative`}>
                 
                 {focusedPeerId ? (
                    <div className="flex-1 flex flex-col relative">
                        <div className="flex-1 relative bg-zinc-950 flex items-center justify-center p-2">
                            {focusedPeerId === 'local' ? (
                                <div className="relative w-full h-full animate-in fade-in">
                                    <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white font-bold">You (Screen)</div>
                                    <button onClick={stopScreenShare} className="absolute bottom-4 right-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105">Stop</button>
                                </div>
                            ) : (
                                (() => {
                                    const p = peers.find(x => x.peerID === focusedPeerId);
                                    return p ? <MediaPlayer peer={p.peer} userInfo={p.info} /> : null;
                                })()
                            )}
                        </div>
                        <div className="h-24 md:h-32 w-full bg-zinc-900/80 backdrop-blur-md flex items-center justify-center gap-4 px-4 overflow-x-auto border-t border-white/10 z-20">
                            <div onClick={() => setFocusedPeerId('local')} className={`w-32 md:w-48 h-16 md:h-24 rounded-xl overflow-hidden cursor-pointer border-2 relative shrink-0 transition-all hover:scale-105 ${focusedPeerId === 'local' ? "border-blue-500 opacity-50" : "border-white/10 hover:border-white/50"}`}>
                                {isScreenSharing ? ( <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><UserAvatar src={user.avatar_url} className="w-8 h-8 rounded-full" /></div> )}
                                <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white shadow-black drop-shadow-md">You</span>
                            </div>
                            {peers.map(p => (
                                <div key={p.peerID} onClick={() => setFocusedPeerId(p.peerID)} className={`w-32 md:w-48 h-16 md:h-24 rounded-xl overflow-hidden cursor-pointer border-2 relative shrink-0 transition-all hover:scale-105 ${focusedPeerId === p.peerID ? "border-blue-500 opacity-50" : "border-white/10 hover:border-white/50"}`}>
                                    <MediaPlayer peer={p.peer} userInfo={p.info} isMini={true} onVideoChange={(v: boolean) => handleRemoteVideo(p.peerID, v)} />
                                </div>
                            ))}
                        </div>
                    </div>
                 ) : (
                     <div className="flex-1 flex items-center justify-center p-4">
                        <div className="grid grid-cols-2 gap-4 w-full h-full max-w-5xl max-h-[80vh] animate-in zoom-in-95 duration-300">
                            <div className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center transition-all hover:border-white/30">
                                {isScreenSharing ? <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : <div className="flex flex-col items-center"><UserAvatar src={user.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/5 mb-3" /><span className="text-xl font-bold">You</span></div>}
                                <button onClick={isScreenSharing ? stopScreenShare : startScreenShare} className={`absolute bottom-4 right-4 p-3 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-90 ${isScreenSharing ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-white/10 hover:bg-white/20"}`}>{isScreenSharing ? "🛑" : "🖥️"}</button>
                            </div>
                            {peers.map(p => (
                                <div key={p.peerID} className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 transition-all hover:border-white/30">
                                    <MediaPlayer peer={p.peer} userInfo={p.info} onVideoChange={(v: boolean) => handleRemoteVideo(p.peerID, v)} />
                                </div>
                            ))}
                        </div>
                     </div>
                 )}
                 
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 z-50 w-full justify-center px-4 animate-in slide-in-from-top-4 duration-300">
                    <button onClick={leaveCall} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95 text-sm whitespace-nowrap">End Call</button>
                    <button onClick={() => setIsCallExpanded(false)} className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-full font-bold shadow-lg transition-all hover:scale-105 active:scale-95 text-sm whitespace-nowrap">📉 Minimize</button>
                    {focusedPeerId && <button onClick={() => setFocusedPeerId(null)} className="hidden md:block px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-full font-bold shadow-lg transition-all hover:scale-105">Show Grid</button>}
                 </div>
             </div>
         )}
      </div>

      {/* 4. MEMBER LIST */}
      {view === "servers" && active.server && (
          <div className="w-60 border-l border-white/5 bg-black/20 backdrop-blur-md p-4 hidden lg:block relative z-20 animate-in slide-in-from-right-4 duration-300">
              <div className="text-[10px] font-bold text-white/30 uppercase mb-4">Members — {serverMembers.length}</div>
              <div className="space-y-1">
                  {serverMembers.map(m => ( 
                    <div key={m.id} onClick={() => viewUserProfile(m.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-all duration-200 hover:translate-x-1"> 
                        <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-full transition-transform group-hover:scale-110" /> 
                        <div className="flex-1 min-w-0"> <div className={`text-sm font-bold truncate ${m.id === active.server.owner_id ? "text-yellow-500" : "text-white/80"}`}>{m.username}</div> </div>
                        {m.id === active.server.owner_id && <span className="animate-pulse">👑</span>}
                        {m.is_admin && m.id !== active.server.owner_id && <span>🛡️</span>}
                    </div> 
                  ))}
              </div>
          </div>
      )}

      {/* MODALS */}
      {viewingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={() => setViewingProfile(null)}>
              <GlassPanel className="w-full max-w-md p-8 flex flex-col items-center relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-300" onClick={(e:any)=>e.stopPropagation()}>
                  <UserAvatar src={viewingProfile.avatar_url} className="w-24 h-24 rounded-full mb-4 border-4 border-white/10 hover:scale-105 transition-transform" />
                  <h2 className="text-2xl font-bold">{viewingProfile.username}</h2>
                  <p className="text-white/50 text-sm mt-2 text-center">{viewingProfile.bio || "No bio set."}</p>
                  {friends.some((f: any) => f.id === viewingProfile.id) && <button onClick={handleRemoveFriend} className="mt-6 w-full py-2 bg-red-500/20 text-red-400 rounded-lg font-bold hover:bg-red-500/30 transition-all hover:scale-105">Remove Friend</button>}
                  {active.server && isOwner && viewingProfile.id !== user.id && serverMembers.some((m:any) => m.id === viewingProfile.id) && (
                      <div className="mt-4 w-full space-y-2 pt-4 border-t border-white/10">
                          <div className="text-[10px] uppercase text-white/30 font-bold text-center mb-2">Owner Actions</div>
                          <button onClick={() => promoteMember(viewingProfile.id)} className="w-full py-2 bg-blue-500/20 text-blue-300 rounded-lg font-bold text-sm hover:bg-blue-500/30 transition-all hover:scale-105">Toggle Moderator</button>
                      </div>
                  )}
              </GlassPanel>
          </div>
      )}

      {showServerSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-md p-8 flex flex-col gap-4 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                  <h2 className="text-xl font-bold">Server Settings</h2>
                  <div className="flex justify-center mb-4 cursor-pointer group" onClick={()=>(document.getElementById('serverImg') as any).click()}>
                      <UserAvatar src={newServerFile ? URL.createObjectURL(newServerFile) : serverEditForm.imageUrl} className="w-20 h-20 rounded-2xl border-2 border-white/20 group-hover:border-white/50 transition-all group-hover:scale-105" />
                      <input id="serverImg" type="file" className="hidden" onChange={(e)=>e.target.files && setNewServerFile(e.target.files[0])} />
                  </div>
                  <input className="bg-white/10 p-3 rounded text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={serverEditForm.name} onChange={e=>setServerEditForm({...serverEditForm, name: e.target.value})} />
                  <div className="flex justify-end gap-2"> <button onClick={()=>setShowServerSettings(false)} className="text-white/50 px-4 hover:text-white transition-colors">Cancel</button> <button onClick={saveServerSettings} className="bg-white text-black px-6 py-2 rounded font-bold hover:scale-105 transition-transform">Save</button> </div>
              </GlassPanel>
          </div>
      )}

      {/* CALL ENDED */}
      {callEndedData && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
              <GlassPanel className="w-80 p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                  <div className="text-4xl mb-4 animate-bounce">📞</div>
                  <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
                  <p className="text-white/50 mb-6">Duration: <span className="text-white font-mono">{callEndedData}</span></p>
                  <button onClick={() => setCallEndedData(null)} className="px-8 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-transform hover:scale-105">Close</button>
              </GlassPanel>
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-md p-8 flex flex-col gap-4 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative">
                  
                  {/* GIF PICKER */}
                  {showSettingsGifPicker && (
                     <div className="absolute inset-0 z-60 bg-[#050505] flex flex-col rounded-4xl overflow-hidden animate-in fade-in duration-200">
                         <GifPicker 
                            className="w-full h-full bg-transparent shadow-none border-none flex flex-col" 
                            onClose={() => setShowSettingsGifPicker(false)}
                            onSelect={(url: string) => {
                                setEditForm({ ...editForm, avatarUrl: url });
                                setNewAvatarFile(null); 
                                setShowSettingsGifPicker(false);
                            }}
                         />
                     </div>
                  )}
                  
                  {/* 2FA SECTION */}
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">Two-Factor Auth</span>
                          <span className={`text-[10px] px-2 py-1 rounded border ${user.is_2fa_enabled ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}`}>
                              {user.is_2fa_enabled ? "ENABLED" : "DISABLED"}
                          </span>
                      </div>

                      {!user.is_2fa_enabled && setupStep === 0 && (
                          <button onClick={start2FASetup} className="w-full py-2 bg-blue-600/20 text-blue-400 text-xs font-bold rounded hover:bg-blue-600/30">Setup 2FA</button>
                      )}

                      {setupStep === 1 && (
                          <div className="flex flex-col items-center gap-3 animate-in fade-in">
                              <img src={qrCodeUrl} className="w-32 h-32 rounded-lg border-4 border-white" />
                              <p className="text-[10px] text-white/50 text-center">Scan with Google Authenticator</p>
                              <input 
                                  className="w-full bg-black/40 p-2 text-center rounded font-mono" 
                                  placeholder="123456" 
                                  maxLength={6}
                                  onChange={(e) => setTwoFACode(e.target.value)}
                              />
                              <button onClick={verify2FASetup} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded">Verify & Enable</button>
                          </div>
                      )}
                  </div>

                  {/* 👇 NEW CHANGE PASSWORD SECTION (Only if 2FA is ON) */}
                  {user.is_2fa_enabled && (
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3 mt-2">
                          <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowPassChange(!showPassChange)}>
                              <span className="font-bold text-sm text-yellow-500">Change Password</span>
                              <span className="text-white/50 text-xs">{showPassChange ? "▼" : "▶"}</span>
                          </div>

                          {showPassChange && (
                              <div className="flex flex-col gap-3 animate-in fade-in pt-2">
                                  {/* 👇 UPDATED NEW PASSWORD INPUT */}
                                  <div className="relative">
                                      <input 
                                          type={showNewPassword ? "text" : "password"}
                                          className="w-full bg-black/40 p-2 rounded text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none pr-10" 
                                          placeholder="New Password"
                                          value={passChangeForm.newPassword}
                                          onChange={(e) => setPassChangeForm({...passChangeForm, newPassword: e.target.value})}
                                      />
                                      <button 
                                          type="button"
                                          onClick={() => setShowNewPassword(!showNewPassword)}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xs"
                                      >
                                          {showNewPassword ? "🙈" : "👁️"}
                                      </button>
                                  </div>

                                  <input 
                                      className="w-full bg-black/40 p-2 text-center rounded font-mono text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none" 
                                      placeholder="Auth Code (000 000)" 
                                      maxLength={6}
                                      value={passChangeForm.code}
                                      onChange={(e) => setPassChangeForm({...passChangeForm, code: e.target.value})}
                                  />
                                  <button onClick={handleChangePassword} className="w-full py-2 bg-yellow-600/20 text-yellow-500 text-xs font-bold rounded hover:bg-yellow-600/30 transition-colors">
                                      Confirm & Logout
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  <div className="flex flex-col items-center mb-4 mt-4">
                      <UserAvatar 
                        src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} 
                        className="w-24 h-24 rounded-full mb-3 hover:scale-105 transition-transform cursor-pointer border-4 border-white/5 hover:border-white/20" 
                        onClick={()=>(document.getElementById('pUpload') as any).click()}
                      />
                      
                      <div className="flex gap-2">
                         <button 
                            onClick={()=>(document.getElementById('pUpload') as any).click()}
                            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors"
                         >
                            Upload Photo
                         </button>
                         <button 
                            onClick={() => setShowSettingsGifPicker(true)}
                            className="text-xs bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-3 py-1 rounded-full transition-all font-bold shadow-lg"
                         >
                            Choose GIF
                         </button>
                         {/* 🎮 NEW: STEAM BUTTON */}
                         <button 
                            onClick={saveSteamId}
                            className="text-xs bg-[#171a21] text-[#c7d5e0] hover:bg-[#2a475e] px-3 py-1 rounded-full transition-all font-bold shadow-lg flex items-center gap-2"
                         >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3" />
                            {user.steam_id ? "Steam Linked" : "Link Steam"}
                         </button>
                      </div>

                      <input id="pUpload" type="file" className="hidden" onChange={e=>e.target.files && setNewAvatarFile(e.target.files[0])} />
                  </div>
                  
                  <input className="bg-white/10 p-3 rounded text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})} />
                  <textarea className="bg-white/10 p-3 rounded text-white h-24 resize-none focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} />
                  
                  <div className="flex justify-between items-center mt-4"> 
                    {/* 👇 ADDED LOGOUT BUTTON HERE */}
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-xs font-bold transition-colors">Log Out</button>
                    
                    <div className="flex gap-2">
                        <button onClick={()=>setShowSettings(false)} className="text-white/50 px-4 hover:text-white transition-colors">Cancel</button> 
                        <button onClick={saveProfile} className="bg-white text-black px-6 py-2 rounded font-bold hover:scale-105 transition-transform">Save</button> 
                    </div>
                  </div>
              </GlassPanel>
          </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
          <div 
            style={{ top: contextMenu.y, left: contextMenu.x }} 
            className="fixed z-50 flex flex-col w-40 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 animate-in zoom-in-95 duration-150 origin-top-left"
            onClick={(e) => e.stopPropagation()} 
          >
              <button 
                onClick={() => copyText(contextMenu.message?.content || "")}
                className="text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
              >
                📋 Copy Text
              </button>
              
              {contextMenu.message?.sender_id === user.id && (
                  <button 
                    onClick={() => {
                        deleteMessage(contextMenu.message.id);
                        setContextMenu({ ...contextMenu, visible: false });
                    }}
                    className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    🗑️ Delete Message
                  </button>
              )}
          </div>
      )}
    </div>
  );
}

// ✅ NEW COMPONENT: Integrated Room Player (Sidebar Widget)
const RoomPlayer = ({ track, onClose, onSearch }: any) => {
    const [search, setSearch] = useState("");

    return (
        <div className="bg-linear-to-b from-indigo-900/50 to-black/50 border-t border-white/10 p-4 flex flex-col gap-3 backdrop-blur-md">
            {/* Player Controls */}
            {track ? (
                <div className="flex gap-3 items-center animate-in slide-in-from-bottom-2">
                    {/* Hidden YouTube Embed */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden relative shrink-0 shadow-lg border border-white/10 group cursor-pointer">
                        <img src={track.image} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="text-[10px] animate-pulse">🎵</span>
                        </div>
                        {/* The Actual Player */}
                        <iframe 
                            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                            src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1&controls=0&start=${Math.floor((Date.now() - track.timestamp)/1000)}`} 
                            allow="autoplay"
                        />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="text-xs font-bold text-white truncate">{track.title}</div>
                        <div className="text-[10px] text-indigo-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> 
                            Playing for everyone
                        </div>
                    </div>

                    <button onClick={onClose} className="text-white/40 hover:text-red-400 transition-colors p-1">■</button>
                </div>
            ) : (
                <div className="text-[10px] text-white/30 text-center uppercase font-bold tracking-widest">Room Audio Idle</div>
            )}

            {/* Search Bar */}
            <div className="relative group">
                <input 
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
                    placeholder="Search YouTube to Play..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && search.trim()) {
                            onSearch(search);
                            setSearch("");
                        }
                    }}
                />
                <div className="absolute right-2 top-1.5 text-[10px] text-white/20">↵</div>
            </div>
        </div>
    );
};

// ... [Keep MediaPlayer Component exactly as it was] ...
const MediaPlayer = ({ peer, userInfo, onVideoChange, isMini }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        const handleStream = (stream: MediaStream) => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
                
                const checkVideo = () => {
                    const tracks = stream.getVideoTracks();
                    const isVideoActive = tracks.length > 0 && tracks[0].readyState === 'live' && tracks[0].enabled;
                    
                    if (isVideoActive !== hasVideo) {
                        setHasVideo(isVideoActive);
                        if (onVideoChange) onVideoChange(isVideoActive);
                    }
                };
                
                checkVideo();
                stream.onaddtrack = checkVideo;
                stream.onremovetrack = () => setTimeout(checkVideo, 100);
                const interval = setInterval(checkVideo, 1000);
                return () => clearInterval(interval);
            }
        };

        peer.on("stream", handleStream);
        if ((peer as any)._remoteStreams?.[0]) handleStream((peer as any)._remoteStreams[0]);

        return () => { peer.off("stream", handleStream); };
    }, [peer, hasVideo, onVideoChange]);

    return (
        <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center overflow-hidden animate-in fade-in">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full ${isMini ? "object-cover" : "object-contain"} ${hasVideo ? "block" : "hidden"}`} 
            />
            
            {!hasVideo && (
                <div className="flex flex-col items-center animate-in zoom-in-95">
                    <UserAvatar src={userInfo?.avatar_url} className={`${isMini ? "w-10 h-10" : "w-24 h-24"} rounded-full border-2 border-white/10 mb-2`} />
                    {!isMini && <span className="font-bold text-white drop-shadow-md">{userInfo?.username}</span>}
                </div>
            )}

            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none">
                {userInfo?.username}
            </div>
        </div>
    );
};