"use client";
import { useEffect, useState, useRef, memo, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import EmojiPicker, { Theme } from "emoji-picker-react";

// 🌍 TRANSLATIONS DATABASE
const TRANSLATIONS: any = {
  en: {
    auth_user: "Username", auth_pass: "Password", auth_login: "Log in", auth_register: "Create Account", auth_back: "Back to Login", auth_2fa: "Enter code from Authenticator", auth_verify: "Verify 2FA", auth_remember: "Remember me",
    dock_dm: "Direct Messages", side_req: "Requests", side_friends: "Friends", side_channels: "Channels",
    status_on: "Online", status_off: "Offline", status_playing: "Playing", steam_join: "🚀 Join Lobby", steam_launch: "▶ Launch Game",
    chat_placeholder: "Message...", chat_select: "Select a Channel", call_return: "🔊 Call in Progress — Click to Return",
    btn_accept: "Accept", btn_decline: "Decline", btn_cancel: "Cancel", btn_save: "Save", btn_close: "Close", btn_stop: "Stop",
    set_header: "Settings", set_2fa: "Two-Factor Auth", set_setup_2fa: "Setup 2FA", set_verify: "Verify & Enable", set_scan: "Scan with Google Authenticator",
    set_ringtone: "Incoming Call Ringtone", set_pass_change: "Change Password", set_new_pass: "New Password", set_confirm: "Confirm & Logout",
    set_upload: "Upload Photo", set_gif: "Choose GIF", set_steam: "Link Steam", set_steam_linked: "Steam Linked", set_logout: "Log Out", set_lang: "Language",
    ctx_copy: "Copy Text", ctx_delete: "Delete Message", ctx_profile: "Profile", ctx_call: "Start Call", ctx_id: "Copy ID", ctx_remove: "Remove Friend",
    call_incoming: "Incoming Call...", call_ended: "End Call", call_duration: "Duration", room_idle: "DJ Idle", room_playing: "Now Playing", room_search: "Search YouTube..."
  },
  ro: {
    auth_user: "Nume utilizator", auth_pass: "Parolă", auth_login: "Autentificare", auth_register: "Creează Cont", auth_back: "Înapoi la Login", auth_2fa: "Introdu codul din Authenticator", auth_verify: "Verifică 2FA", auth_remember: "Ține-mă minte",
    dock_dm: "Mesaje Directe", side_req: "Cereri", side_friends: "Prieteni", side_channels: "Canale",
    status_on: "Conectat", status_off: "Deconectat", status_playing: "Se joacă", steam_join: "🚀 Intră în Lobby", steam_launch: "▶ Pornește Jocul",
    chat_placeholder: "Scrie un mesaj...", chat_select: "Selectează un Canal", call_return: "🔊 Apel în Desfășurare — Apasă pentru a reveni",
    btn_accept: "Acceptă", btn_decline: "Refuză", btn_cancel: "Anulează", btn_save: "Salvează", btn_close: "Închide", btn_stop: "Oprește",
    set_header: "Setări", set_2fa: "Autentificare în 2 Pași", set_setup_2fa: "Activează 2FA", set_verify: "Verifică & Activează", set_scan: "Scanează cu Google Authenticator",
    set_ringtone: "Ton de Apel", set_pass_change: "Schimbă Parola", set_new_pass: "Parolă Nouă", set_confirm: "Confirmă & Delogare",
    set_upload: "Încarcă Foto", set_gif: "Alege GIF", set_steam: "Leagă Steam", set_steam_linked: "Steam Legat", set_logout: "Delogare", set_lang: "Limbă",
    ctx_copy: "Copiază Text", ctx_delete: "Șterge Mesaj", ctx_profile: "Profil", ctx_call: "Începe Apel", ctx_id: "Copiază ID", ctx_remove: "Șterge Prieten",
    call_incoming: "Apel de intrare...", call_ended: "Încheie Apel", call_duration: "Durată", room_idle: "DJ Inactiv", room_playing: "Acum Redă", room_search: "Caută pe YouTube..."
  },
  // ... Add other languages here if needed
};

const TAGLINES = [ "Tel Aviv group trip 2026 ?", "Debis", "Endorsed by the Netanyahu cousins", "Also try DABROWSER", "Noua aplicatie suvenirista", "No Basinosu allowed", "Nu stati singuri cu bibi pe VC", "E buna Purcela", "I AM OBEZ DELUXE 2026 ?", "500 pe seara", "Sure buddy", "Mor vecinii", "Aplicatie de jocuri dusmanoasa", "Aplicatie de jocuri patriotica", "Aplicatie de jocuri prietenoasa", "Sanatate curata ma", "Garju 8-bit", "Five Nights at Valeriu (rip)", "Micu Vesel group trip 202(si ceva) ?" ];
const APP_VERSION = "1.3.5"; 
const WHATS_NEW = [ "🎵 Advanced Music Player Controls", "⏭️ Queue System Added", "📞 Fixed Audio Grid Layout" ];
const RINGTONES = [ { name: "Default (Classic)", url: "/ringtones/classic.mp3" }, { name: "Cosmic Flow", url: "/ringtones/cosmic.mp3" }, { name: "Retro Beep", url: "/ringtones/beep.mp3" }, { name: "Soft Chime", url: "/ringtones/chime.mp3" } ];

if (typeof window !== 'undefined') { 
    (window as any).global = window; 
    (window as any).process = { env: { DEBUG: undefined }, }; 
    (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; 
}

const BACKEND_URL = "https://dachat-app.onrender.com"; 
const KLIPY_API_KEY = "bfofoQzlu5Uu8tpvTAnOn0ZC64MyxoVBAgJv52RbIRqKnjidRZ6IPbQqnULhIIi9"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";
const PEER_CONFIG = { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" } ] };
const socket: Socket = io(BACKEND_URL, { autoConnect: false, transports: ["websocket", "polling"] });

const GlassPanel = ({ children, className, onClick, style }: any) => ( <div onClick={onClick} style={style} className={`backdrop-blur-xl bg-gray-900/80 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 ${className}`}> {children} </div> );

const UserAvatar = memo(({ src, alt, className, fallbackClass, onClick }: any) => { return src ? ( <img key={src} onClick={onClick} src={src} alt={alt || "User"} className={`${className} bg-black/20 object-cover cursor-pointer transition-transform duration-300 ease-out hover:scale-110 active:scale-95`} loading="lazy" /> ) : ( <div onClick={onClick} className={`${className} ${fallbackClass || "bg-white/5"} flex items-center justify-center backdrop-blur-md border border-white/10 cursor-pointer transition-transform duration-300 ease-out hover:scale-110 active:scale-95`}> <span className="text-[10px] text-white/40 font-bold">?</span> </div> ); });
UserAvatar.displayName = "UserAvatar";

const GifPicker = ({ onSelect, onClose, className }: any) => { const [gifs, setGifs] = useState<any[]>([]); const [search, setSearch] = useState(""); useEffect(() => { fetch(`${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`).then(r => r.json()).then(d => setGifs(d.results || [])); }, []); const searchGifs = async (q: string) => { if(!q) return; const res = await fetch(`${KLIPY_BASE_URL}/search?q=${q}&key=${KLIPY_API_KEY}&limit=20`); const data = await res.json(); setGifs(data.results || []); }; return ( <GlassPanel className={className || "absolute bottom-24 left-4 w-[90%] max-w-90 h-120 rounded-4xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 shadow-2xl ring-1 ring-white/10"}> <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-3xl flex gap-3 items-center"> <input className="w-full bg-black/40 text-white px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5 placeholder-white/30 transition-all" placeholder="Search GIFs..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchGifs(search)} autoFocus /> <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors active:scale-90">✕</button> </div> <div className="flex-1 overflow-y-auto p-4 custom-scrollbar"> <div className="columns-2 gap-3 space-y-3"> {gifs.map((g) => ( <div key={g.id} className="relative group overflow-hidden rounded-2xl cursor-pointer transition-all hover:scale-[1.02] hover:ring-2 ring-blue-500/50" onClick={() => onSelect(g?.media_formats?.gif?.url)}> <img src={g?.media_formats?.tinygif?.url} className="w-full h-auto object-cover rounded-xl" /> </div> ))} </div> </div> </GlassPanel> ); };
const DaChatLogo = ({ className = "w-12 h-12" }: { className?: string }) => ( <img src="/logo.png" alt="DaChat Logo" className={`${className} object-contain rounded-xl transition-transform hover:scale-110 duration-300`} /> );

export default function DaChat() {
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [lang, setLang] = useState("en");

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
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [setupStep, setSetupStep] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [emojiBtnIcon, setEmojiBtnIcon] = useState("😀");
  const RANDOM_EMOJIS = ["😀", "😂", "😍", "😎", "🤔", "😜", "🥳", "🤩", "🤯", "🥶", "👾", "👽", "👻", "🤖", "🤠"];
  const [rememberMe, setRememberMe] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'message' | 'user' | null; data: any | null; }>({ visible: false, x: 0, y: 0, type: null, data: null });

  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [steamStatuses, setSteamStatuses] = useState<Record<string, any>>({});

  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isCallExpanded, setIsCallExpanded] = useState(false); 
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [callEndedData, setCallEndedData] = useState<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  
  const [selectedRingtone, setSelectedRingtone] = useState(RINGTONES[0].url);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const t = (key: string) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;

  // GRID CALCULATION
  const totalParticipants = 1 + peers.length + (activeVoiceChannelId ? 1 : 0);
  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-1 md:grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 9) return "grid-cols-2 md:grid-cols-3";
    return "grid-cols-2 md:grid-cols-4";
  };

  const formatMessage = (content: string) => {
    if (!content) return null;
    if (content.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|bmp)$/i)) {
        return <img src={content} className="max-w-[200px] md:max-w-[250px] rounded-lg transition-transform hover:scale-105" alt="attachment" />;
    }
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
        }
        return <span key={i} className="break-words">{part}</span>;
    });
  };

  const onEmojiClick = (emojiData: any) => setMessage((prev) => prev + emojiData.emoji);

  useEffect(() => { if (isScreenSharing) setFocusedPeerId('local'); else if (focusedPeerId === 'local') setFocusedPeerId(null); }, [isScreenSharing]);
  const handleRemoteVideo = useCallback((peerId: string, hasVideo: boolean) => { if (hasVideo) setFocusedPeerId(peerId); else if (focusedPeerId === peerId) setFocusedPeerId(null); }, [focusedPeerId]);
  useEffect(() => { setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]); }, []);
  
  useEffect(() => { 
      if (typeof window !== 'undefined') { 
          joinSoundRef.current = new Audio('/join.mp3'); leaveSoundRef.current = new Audio('/leave.mp3'); 
          joinSoundRef.current.load(); leaveSoundRef.current.load();
          const savedRingtone = localStorage.getItem("dachat_ringtone");
          if (savedRingtone) setSelectedRingtone(savedRingtone);
          const savedLang = localStorage.getItem("dachat_lang");
          if (savedLang) setLang(savedLang);
          const storedVersion = localStorage.getItem("dachat_version");
          if (storedVersion !== APP_VERSION) setShowChangelog(true);
      } 
  }, []);

  const closeChangelog = () => { localStorage.setItem("dachat_version", APP_VERSION); setShowChangelog(false); };
  useEffect(() => { ringtoneAudioRef.current = new Audio(selectedRingtone); ringtoneAudioRef.current.loop = true; }, [selectedRingtone]);
  useEffect(() => { if (incomingCall) { ringtoneAudioRef.current?.play().catch(e => console.error(e)); } else { ringtoneAudioRef.current?.pause(); if (ringtoneAudioRef.current) ringtoneAudioRef.current.currentTime = 0; } }, [incomingCall]);
  useEffect(() => { const handleClick = () => setContextMenu({ ...contextMenu, visible: false }); window.addEventListener("click", handleClick); return () => window.removeEventListener("click", handleClick); }, [contextMenu]);
  
  useEffect(() => {
      const fetchSteam = async () => {
          if (!user) return;
          const allUsers = [...friends, ...serverMembers];
          const steamIds = allUsers.map((u: any) => u.steam_id).filter((id) => id);
          if (steamIds.length === 0) return;
          const uniqueIds = Array.from(new Set(steamIds));
          const res = await fetch(`${BACKEND_URL}/users/steam-status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steamIds: uniqueIds }) });
          const data = await res.json();
          if (data.success) { const statusMap: Record<string, any> = {}; data.players.forEach((p: any) => { statusMap[p.steamid] = p; }); setSteamStatuses(statusMap); }
      };
      fetchSteam(); 
      const interval = setInterval(fetchSteam, 60000); 
      return () => clearInterval(interval);
  }, [friends, serverMembers, user]);

  useEffect(() => { const savedUser = localStorage.getItem("dachat_user"); if (savedUser) setUser(JSON.parse(savedUser)); }, []);

  const saveSteamId = async () => { const id = prompt("Enter your Steam ID64 (looks like 765611980...):"); if(!id) return; await fetch(`${BACKEND_URL}/users/link-steam`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, steamId: id }) }); setUser({...user, steam_id: id}); };

  useEffect(() => { 
      socket.connect(); 
      const handleConnect = () => { if (user) { socket.emit("setup", user.id); socket.emit("get_online_users"); } };
      socket.on("connect", handleConnect);
      if (socket.connected && user) { socket.emit("setup", user.id); socket.emit("get_online_users"); }
      return () => { socket.off("connect", handleConnect); socket.disconnect(); }; 
  }, [user]); 

  useEffect(() => { 
      socket.on("receive_message", (msg) => { const normalized = { ...msg, sender_id: msg.sender_id || msg.senderId, sender_name: msg.sender_name || msg.senderName, file_url: msg.file_url || msg.fileUrl }; if (user && normalized.sender_id === user.id) return; setChatHistory(prev => [...prev, normalized]); });
      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      socket.on("message_deleted", (messageId) => { setChatHistory(prev => prev.filter(msg => msg.id !== messageId)); });
      socket.on("audio_state_update", (track) => setCurrentTrack(track));
      socket.on("audio_state_clear", () => setCurrentTrack(null));
      socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); });
      socket.on("user_connected", (userId: number) => { setOnlineUsers(prev => new Set(prev).add(userId)); if (user) fetchFriends(user.id); });
      socket.on("user_disconnected", (userId: number) => { setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next; }); });
      socket.on("online_users", (users: number[]) => { setOnlineUsers(new Set(users)); });
      socket.on("user_updated", ({ userId }) => { if (viewingProfile && viewingProfile.id === userId) viewUserProfile(userId); if (active.server && user) fetchServers(user.id); if (user) fetchFriends(user.id); if (user && user.id === userId) { fetch(`${BACKEND_URL}/users/${userId}`).then(res => res.json()).then(data => { if (data.success) { setUser((prev: any) => ({ ...prev, ...data.user })); localStorage.setItem("dachat_user", JSON.stringify(data.user)); } }); } });
      socket.on("request_accepted", () => { if (user) { fetchFriends(user.id); fetchRequests(user.id); } });
      socket.on("friend_removed", () => { if (user) { fetchFriends(user.id); } });
      socket.on("new_friend_request", () => { if(user) fetchRequests(user.id); });
      socket.on("new_server_invite", () => { if(user) fetchServers(user.id); });
      socket.on("server_updated", ({ serverId }) => { if (active.server?.id === serverId && user) { fetchServers(user.id); selectServer({ id: serverId }); } });
      socket.on("incoming_call", (data) => { if (user && data.senderId === user.id) return; setIncomingCall(data); });
      socket.on("call_ended", () => { endCallSession(); });
      socket.on("call_rejected", () => { alert("Call declined by user"); leaveCall(); });

      return () => { socket.off("receive_message"); socket.off("load_messages"); socket.off("voice_state_update"); socket.off("user_updated"); socket.off("new_friend_request"); socket.off("incoming_call"); socket.off("server_updated"); socket.off("new_server_invite"); socket.off("call_ended"); socket.off("user_connected"); socket.off("user_disconnected"); socket.off("online_users"); socket.off("request_accepted"); socket.off("friend_removed"); socket.off("message_deleted"); socket.off("audio_state_update"); socket.off("audio_state_clear"); socket.off("call_rejected"); }; 
  }, [user, viewingProfile, active.server, inCall]);

  useEffect(() => { if (myVideoRef.current && screenStream) myVideoRef.current.srcObject = screenStream; }, [screenStream, isScreenSharing]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, active.channel, active.friend]);
  useEffect(() => { if (user) { fetchServers(user.id); fetchFriends(user.id); fetchRequests(user.id); } }, [user]);

  const handleAuth = async () => { if (is2FALogin) { const res = await fetch(`${BACKEND_URL}/auth/2fa/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: tempUserId, token: twoFACode }) }); const data = await res.json(); if (data.success) { if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user)); setUser(data.user); } else { setError(data.message || "Invalid Code"); } return; } if (!authForm.username.trim() || !authForm.password.trim()) { setError("Enter credentials"); return; } const endpoint = isRegistering ? "register" : "login"; try { const res = await fetch(`${BACKEND_URL}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) }); const data = await res.json(); if (data.requires2FA) { setTempUserId(data.userId); setIs2FALogin(true); setError(""); return; } if (data.success) { if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user)); setUser(data.user); } else setError(data.message || "Auth failed"); } catch { setError("Connection failed"); } };
  const handleLogout = () => { if(confirm("Are you sure you want to log out?")) { localStorage.removeItem("dachat_user"); window.location.reload(); } };
  const fetchServers = async (id: number) => { const res = await fetch(`${BACKEND_URL}/my-servers/${id}`); setServers(await res.json()); };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());
  const fetchRequests = async (id: number) => setRequests(await (await fetch(`${BACKEND_URL}/my-requests/${id}`)).json());

  const selectServer = async (server: any) => { setView("servers"); setActive((prev:any) => ({ ...prev, server, friend: null, pendingRequest: null })); setIsCallExpanded(false); const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`); const chData = await res.json(); setChannels(chData); if(!active.channel && chData.length > 0) { const firstText = chData.find((c:any) => c.type === 'text'); if (firstText) joinChannel(firstText); } const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`); setServerMembers(await memRes.json()); };
  const joinChannel = (channel: any) => { if (channel.type === 'voice') { if (inCall && activeVoiceChannelId === channel.id.toString()) setIsCallExpanded(true); else if (channel.id) joinVoiceRoom(channel.id.toString()); } else { setActive((prev: any) => ({ ...prev, channel, friend: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() }); } };
  const selectFriend = (friend: any) => { setActive((prev: any) => ({ ...prev, friend, channel: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); const ids = [user.id, friend.id].sort((a, b) => a - b); socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` }); };
  const selectRequest = (requestUser: any) => { setActive((prev: any) => ({ ...prev, pendingRequest: requestUser, friend: null, channel: null })); setIsCallExpanded(false); setShowMobileChat(true); };

  const sendFriendRequest = async () => { const usernameToAdd = prompt("Enter username to request:"); if (!usernameToAdd) return; await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); };
  const handleAcceptRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/accept-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchFriends(user.id); fetchRequests(user.id); selectFriend(active.pendingRequest); };
  const handleDeclineRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/decline-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchRequests(user.id); setActive({...active, pendingRequest: null}); };
  const handleRemoveFriend = async (targetId: number | null = null) => { const idToRemove = targetId || viewingProfile?.id; if (!idToRemove) return; if (!confirm("Are you sure you want to remove this friend?")) return; await fetch(`${BACKEND_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendId: idToRemove }) }); fetchFriends(user.id); if (viewingProfile?.id === idToRemove) setViewingProfile(null); if (active.friend?.id === idToRemove) setActive({ ...active, friend: null }); };

  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { const content = textMsg || (fileUrl ? "Sent an image" : ""); const payload: any = { content, senderId: user.id, senderName: user.username, fileUrl, avatar_url: user.avatar_url, id: Date.now(), created_at: new Date().toISOString() }; setChatHistory(prev => [...prev, { ...payload, sender_id: user.id, sender_name: user.username, file_url: fileUrl, avatar_url: user.avatar_url }]); if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } setMessage(""); };
  const deleteMessage = (msgId: number) => { const roomId = active.channel ? active.channel.id.toString() : `dm-${[user.id, active.friend.id].sort((a,b)=>a-b).join('-')}`; socket.emit("delete_message", { messageId: msgId, roomId }); setChatHistory(prev => prev.filter(m => m.id !== msgId)); };
  
  // ✅ UPDATED PLAY MUSIC FUNCTION
  const playMusic = async (payload: any) => { 
      if (!activeVoiceChannelId) return; 
      // Handle both old string calls and new object calls
      const body = typeof payload === 'string' 
          ? { channelId: activeVoiceChannelId, query: payload, action: 'queue' }
          : { channelId: activeVoiceChannelId, ...payload };

      await fetch(`${BACKEND_URL}/channels/play`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(body) 
      }); 
  };
  const stopMusic = async () => { if (!activeVoiceChannelId) return; await fetch(`${BACKEND_URL}/channels/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: activeVoiceChannelId, action: 'stop' }) }); };

  const handleContextMenu = (e: React.MouseEvent, type: 'message' | 'user', data: any) => { e.preventDefault(); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, type, data }); };
  const copyText = (text: string) => { navigator.clipboard.writeText(text); setContextMenu({ ...contextMenu, visible: false }); };
  const handleFileUpload = async (e: any) => { const file = e.target.files[0]; if(!file) return; const formData = new FormData(); formData.append("file", file); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if(data.success) sendMessage(null, data.fileUrl); };
  const viewUserProfile = async (userId: number) => { const res = await fetch(`${BACKEND_URL}/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };

  const openSettings = () => { setEditForm({ username: user.username, bio: user.bio || "", avatarUrl: user.avatar_url }); setShowSettings(true); };
  const saveProfile = async () => { let finalAvatarUrl = editForm.avatarUrl; if (newAvatarFile) { const formData = new FormData(); formData.append("file", newAvatarFile); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.success) finalAvatarUrl = data.fileUrl; } const res = await fetch(`${BACKEND_URL}/update-profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, username: editForm.username, bio: editForm.bio, avatarUrl: finalAvatarUrl }) }); const data = await res.json(); if (data.success) { const updatedUser = { ...user, username: editForm.username, bio: editForm.bio, avatar_url: finalAvatarUrl }; setUser(updatedUser); localStorage.setItem("dachat_user", JSON.stringify(updatedUser)); setShowSettings(false); setNewAvatarFile(null); } else { alert("Failed to update profile."); } };
  const handleChangePassword = async () => { if (!passChangeForm.newPassword || !passChangeForm.code) { alert("Please fill in both fields"); return; } const res = await fetch(`${BACKEND_URL}/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, newPassword: passChangeForm.newPassword, token: passChangeForm.code }) }); const data = await res.json(); if (data.success) { alert("Password Changed Successfully! Logging you out..."); localStorage.removeItem("dachat_user"); window.location.reload(); } else { alert(data.message || "Failed to change password"); } };
  const start2FASetup = async () => { const res = await fetch(`${BACKEND_URL}/auth/2fa/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) }); const data = await res.json(); if (data.success) { setQrCodeUrl(data.qrCode); setSetupStep(1); } };
  const verify2FASetup = async () => { const res = await fetch(`${BACKEND_URL}/auth/2fa/enable`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, token: twoFACode }) }); const data = await res.json(); if (data.success) { setSetupStep(2); setUser((prev: any) => { const updated = { ...prev, is_2fa_enabled: true }; localStorage.setItem("dachat_user", JSON.stringify(updated)); return updated; }); alert("2FA Enabled!"); } else { alert("Invalid Code"); } };
  
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

  const startDMCall = (targetUser: any = active.friend) => { if (!targetUser) return; const ids = [user.id, targetUser.id].sort((a, b) => a - b); const roomId = `dm-call-${ids[0]}-${ids[1]}`; joinVoiceRoom(roomId); socket.emit("start_call", { senderId: user.id, recipientId: targetUser.id, senderName: user.username, avatarUrl: user.avatar_url, roomId: roomId }); };
  const answerCall = () => { if (incomingCall) { joinVoiceRoom(incomingCall.roomId); setIncomingCall(null); } };
  const rejectCall = () => { if (!incomingCall) return; socket.emit("reject_call", { callerId: incomingCall.senderId }); setIncomingCall(null); };
  const removePeer = (peerID: string) => { const peerIdx = peersRef.current.findIndex(p => p.peerID === peerID); if (peerIdx > -1) { peersRef.current[peerIdx].peer.destroy(); peersRef.current.splice(peerIdx, 1); } setPeers(prev => prev.filter(p => p.peerID !== peerID)); setFocusedPeerId(current => (current === peerID ? null : current)); };
  
  const joinVoiceRoom = useCallback((roomId: string) => { if (!user) return; callStartTimeRef.current = Date.now(); setActiveVoiceChannelId(roomId); setIsCallExpanded(true); socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal"); navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => { setInCall(true); setMyStream(stream); socket.emit("join_voice", { roomId, userData: user }); socket.on("all_users", (users) => { const peersArr: any[] = []; users.forEach((u: any) => { const peer = createPeer(u.socketId, socket.id as string, stream, u.userData); peersRef.current.push({ peerID: u.socketId, peer, info: u.userData }); peersArr.push({ peerID: u.socketId, peer, info: u.userData }); }); setPeers(peersArr); }); socket.on("user_joined", (payload) => { const item = peersRef.current.find(p => p.peerID === payload.callerID); if (item) { item.peer.signal(payload.signal); return; } const peer = addPeer(payload.signal, payload.callerID, stream); peersRef.current.push({ peerID: payload.callerID, peer, info: payload.userData }); setPeers(users => [...users, { peerID: payload.callerID, peer, info: payload.userData }]); }); socket.on("receiving_returned_signal", (payload) => { const item = peersRef.current.find(p => p.peerID === payload.id); if (item) item.peer.signal(payload.signal); }); }).catch(err => { console.error("Mic Error:", err); alert(`Mic Error: ${err.message}`); }); }, [user]);
  const createPeer = (userToSignal: string, callerID: string, stream: MediaStream, userData: any) => { const peer = new Peer({ initiator: true, trickle: false, stream, config: PEER_CONFIG }); peer.on("signal", (signal: any) => { socket.emit("sending_signal", { userToSignal, callerID, signal, userData: user }); }); peer.on("close", () => removePeer(userToSignal)); peer.on("error", () => removePeer(userToSignal)); return peer; };
  const addPeer = (incomingSignal: any, callerID: string, stream: MediaStream) => { const peer = new Peer({ initiator: false, trickle: false, stream, config: PEER_CONFIG }); peer.on("signal", (signal: any) => { socket.emit("returning_signal", { signal, callerID }); }); peer.on("close", () => removePeer(callerID)); peer.on("error", () => removePeer(callerID)); peer.signal(incomingSignal); return peer; };
  const startScreenShare = async () => { try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); setScreenStream(stream); setIsScreenSharing(true); const screenTrack = stream.getVideoTracks()[0]; if (myVideoRef.current) myVideoRef.current.srcObject = stream; peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if (pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if (sender) sender.replaceTrack(screenTrack); else peerObj.peer.addTrack(screenTrack, myStream); } }); screenTrack.onended = () => stopScreenShare(); } catch(e) { console.error("Screen Share Error:", e); } };
  const stopScreenShare = () => { screenStream?.getTracks().forEach(t => t.stop()); setScreenStream(null); setIsScreenSharing(false); if (focusedPeerId === 'local') setFocusedPeerId(null); if(myStream) { const webcamTrack = myStream.getVideoTracks()[0]; if(webcamTrack) { peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if(pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if(sender) sender.replaceTrack(webcamTrack); } }); } } };
  const getCallDuration = () => { if (!callStartTimeRef.current) return "00:00"; const diff = Math.floor((Date.now() - callStartTimeRef.current) / 1000); const m = Math.floor(diff / 60).toString().padStart(2, '0'); const s = (diff % 60).toString().padStart(2, '0'); return `${m}:${s}`; };
  const endCallSession = () => { if (inCall && callStartTimeRef.current) { const duration = getCallDuration(); setCallEndedData(duration); } if(isScreenSharing) stopScreenShare(); setInCall(false); setIncomingCall(null); setFocusedPeerId(null); setActiveVoiceChannelId(null); setIsCallExpanded(false); if(myStream) { myStream.getTracks().forEach(t => t.stop()); setMyStream(null); } setPeers([]); peersRef.current.forEach(p => { try { p.peer.destroy(); } catch(e){} }); peersRef.current = []; callStartTimeRef.current = null; };
  const leaveCall = () => { endCallSession(); socket.emit("leave_voice"); };

  // ... (Render Logic Same as Before)

  if (!user) return (
    // ... [Auth UI - Unchanged] ...
    <div className="flex h-screen items-center justify-center bg-black relative overflow-hidden p-0 md:p-4">
      <div className="absolute inset-0 bg-linear-to-br from-indigo-900 via-purple-900 to-black opacity-40 animate-pulse-slow"></div>
      <GlassPanel className="p-10 w-full h-full md:h-auto md:max-w-100 rounded-none md:rounded-[40px] text-center relative z-10 flex flex-col justify-center gap-6 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-500">
         {/* ... Auth UI Content ... */}
         <div className="space-y-3">
             <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t('auth_user')} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
             <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50" type="password" placeholder={t('auth_pass')} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
         </div>
         <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all">{isRegistering ? t('auth_register') : t('auth_login')}</button>
         <p className="text-xs text-white/40 cursor-pointer" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? t('auth_back') : t('auth_register')}</p>
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
            {servers.map(s => ( <div key={s.id} onClick={() => selectServer(s)} className="group relative w-12 h-12 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"> <UserAvatar src={s.image_url} className="w-12 h-12 rounded-3xl group-hover:rounded-2xl" /> </div> ))}
            <div onClick={createServer} className="w-12 h-12 rounded-3xl border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white text-white/40 hover:text-green-400 transition-all">+</div>
        </div>
        <UserAvatar onClick={openSettings} src={user.avatar_url} className="w-12 h-12 rounded-full cursor-pointer hover:ring-white/50 ring-2 ring-transparent transition-all" />
      </div>

      {/* 2. SIDEBAR */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} relative z-10 h-screen bg-black/20 backdrop-blur-md border-r border-white/5 flex-col md:w-65 md:ml-22.5 w-[calc(100vw-90px)] ml-22.5 animate-in fade-in duration-500`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 font-bold tracking-wide">
            <span className="truncate">{active.server ? active.server.name : t('dock_dm')}</span>
            {active.server && isMod && <button onClick={openServerSettings} className="text-xs text-white/50 hover:text-white">⚙️</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {view === "servers" && active.server ? (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>{t('side_channels')}</span> {isMod && <button onClick={createChannel} className="text-lg hover:text-white">+</button>} </div>
                    {channels.map(ch => ( <div key={ch.id} onClick={() => joinChannel(ch)} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${active.channel?.id === ch.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}> <div className="flex items-center gap-2 truncate"> <span className="opacity-50">{ch.type==='voice'?'🔊':'#'}</span> <span>{ch.name}</span> </div> {isMod && <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-xs text-red-400">✕</button>} </div> ))}
                    <div className="mt-6 px-2 space-y-2">
                        <button onClick={inviteUser} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/30">Invite</button>
                        <button onClick={leaveServer} className="w-full py-2 bg-red-600/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/20">Leave</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>{t('side_req')}</span> <button onClick={sendFriendRequest} className="text-lg hover:text-white">+</button> </div>
                    {requests.map(req => ( <div key={req.id} onClick={() => selectRequest(req)} className="p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5"> <UserAvatar src={req.avatar_url} className="w-8 h-8 rounded-full" /> <div className="text-xs font-bold">{req.username}</div> </div> ))}
                    <div className="mt-4 px-2 text-[10px] font-bold text-white/40 uppercase">{t('side_friends')}</div>
                    {friends.map(f => ( <div key={f.id} onClick={()=>selectFriend(f)} onContextMenu={(e) => handleContextMenu(e, 'user', f)} className="p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5"> <div className="relative"> <UserAvatar src={f.avatar_url} className="w-8 h-8 rounded-full" /> {onlineUsers.has(f.id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>} </div> <div className="text-xs font-bold">{f.username}</div> </div> ))}
                </>
            )}
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className={`${showMobileChat ? 'flex animate-in slide-in-from-right-full duration-300' : 'hidden md:flex'} flex-1 flex-col relative z-10 min-w-0 bg-transparent`}>
         <div className="absolute inset-0 flex flex-col z-0">
             {(active.channel || active.friend) ? (
                 <>
                    <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md"> 
                        <div className="flex items-center gap-3 font-bold text-lg overflow-hidden"> <button className="md:hidden mr-2 text-white/50" onClick={() => setShowMobileChat(false)}>←</button> <span>{active.channel ? active.channel.name : active.friend?.username}</span> </div> 
                        {!active.channel && <button onClick={() => startDMCall()} className="bg-green-600 p-2 rounded-full hover:bg-green-500 transition-transform hover:scale-110">📞</button>} 
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {chatHistory.map((msg, i) => ( <div key={msg.id || i} className={`flex gap-3 ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`} onContextMenu={(e) => handleContextMenu(e, 'message', msg)}> <UserAvatar src={msg.avatar_url} className="w-10 h-10 rounded-xl" /> <div className={`group px-4 py-2 rounded-2xl text-sm shadow-md ${msg.sender_id===user.id?"bg-blue-600":"bg-white/10"}`}> {formatMessage(msg.content)} </div> </div> ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 relative">
                        <div className="bg-white/5 border border-white/10 rounded-full p-2 flex items-center gap-2"> <button onClick={()=>fileInputRef.current?.click()} className="w-10 h-10 rounded-full hover:bg-white/10 text-white/50">📎</button> <input className="flex-1 bg-transparent outline-none px-2" placeholder={t('chat_placeholder')} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage(message)} /> <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> </div>
                    </div>
                 </>
             ) : <div className="flex-1 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest animate-pulse">{t('chat_select')}</div>}
         </div>

         {/* CALL UI */}
         {inCall && (
             <div className={`${isCallExpanded ? "absolute inset-0 z-20 bg-black animate-in zoom-in-95 duration-300" : "hidden"} flex flex-col`}>
                 <div className="flex-1 p-4 overflow-y-auto">
                    <div className={`grid ${getGridClass()} gap-4 w-full max-w-7xl mx-auto h-full content-center`}>
                        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center w-full h-full min-h-0 group">
                            {isScreenSharing ? <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" /> : <div className="flex flex-col items-center"><UserAvatar src={user.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/5 mb-3" /></div>}
                            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-white backdrop-blur-md">You</div>
                        </div>
                        {/* Music Player in Grid */}
                        {activeVoiceChannelId && (
                             <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 flex flex-col w-full h-full min-h-0 group shadow-lg shadow-indigo-500/10">
                                 <RoomPlayer track={currentTrack} onSearch={playMusic} onClose={stopMusic} t={t} />
                             </div>
                        )}
                        {peers.map(p => ( <div key={p.peerID} className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 w-full h-full min-h-0 group"><MediaPlayer peer={p.peer} userInfo={p.info} /></div> ))}
                    </div>
                 </div>
                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                    <button onClick={leaveCall} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105">{t('call_ended')}</button>
                    <button onClick={() => setIsCallExpanded(false)} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-transform hover:scale-110">📉</button>
                 </div>
             </div>
         )}
      </div>

      {/* MODALS (Settings, Context Menu, etc - kept concise) */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <GlassPanel className="w-full max-w-3xl p-8 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-2">{t('set_header')}</h2>
                  <div>
                      <h3 className="text-xs font-bold text-white/40 uppercase mb-4 tracking-wider">User Profile</h3>
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                               <UserAvatar src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} className="w-24 h-24 rounded-full border-4 border-white/5 hover:scale-105 cursor-pointer" onClick={()=>(document.getElementById('pUpload') as any).click()} />
                               <input id="pUpload" type="file" className="hidden" onChange={e=>e.target.files && setNewAvatarFile(e.target.files[0])} />
                          </div>
                          <div className="flex-1 w-full flex flex-col gap-4">
                              <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Username</label> <input className="w-full bg-white/5 p-3 rounded-xl text-white focus:outline-none border border-white/5" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})} /> </div>
                              <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Bio</label> <textarea className="w-full bg-white/5 p-3 rounded-xl text-white h-24 resize-none focus:outline-none border border-white/5" value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} /> </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2"> 
                      <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-xs font-bold px-2">{t('set_logout')}</button> 
                      <div className="flex gap-3"> <button onClick={()=>setShowSettings(false)} className="text-white/50 px-4 py-2 hover:text-white text-sm">{t('btn_cancel')}</button> <button onClick={saveProfile} className="bg-white text-black px-8 py-2 rounded-xl font-bold hover:scale-105 shadow-lg text-sm">{t('btn_save')}</button> </div> 
                  </div>
              </GlassPanel>
          </div>
      )}
      {/* ... [Other modals like context menu, incoming call etc would be here] ... */}
    </div>
  );
}

// ✅ UPDATED MUSIC PLAYER COMPONENT
const RoomPlayer = memo(({ track, onClose, onSearch, t }: any) => {
    const [search, setSearch] = useState("");
    const [showQueue, setShowQueue] = useState(false);

    const iframeSrc = useMemo(() => {
        if (!track?.current || track.isPaused) return "";
        const startSeconds = Math.floor((track.elapsed + (Date.now() - track.startTime)) / 1000);
        return `https://www.youtube.com/embed/${track.current.videoId}?autoplay=1&controls=0&start=${startSeconds}`;
    }, [track?.current?.videoId, track?.startTime, track?.isPaused]);

    return (
        <div className="relative w-full h-full bg-zinc-950 flex flex-col group overflow-hidden">
            {track?.current?.image && ( <div className="absolute inset-0 z-0 opacity-20 blur-3xl"> <img src={track.current.image} className="w-full h-full object-cover" /> </div> )}
            <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4 min-h-0">
                {track?.current ? (
                    <>
                        <div className="relative w-32 h-32 md:w-40 md:h-40 shadow-2xl rounded-xl overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform duration-500 shrink-0">
                            <img src={track.current.image} className="w-full h-full object-cover" />
                            {!track.isPaused && <iframe className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" src={iframeSrc} allow="autoplay"/>}
                        </div>
                        <h3 className="text-white font-bold text-center line-clamp-1 px-2 text-sm md:text-base w-full">{track.current.title}</h3>
                        <p className="text-indigo-400 text-xs mt-1 font-bold uppercase tracking-widest mb-4"> {track.isPaused ? "⏸ PAUSED" : t('room_playing')} </p>
                        <div className="flex items-center gap-4 mb-2">
                             <button onClick={() => onSearch({ action: track.isPaused ? 'resume' : 'pause' })} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center text-xl hover:scale-110 active:scale-95"> {track.isPaused ? "▶" : "⏸"} </button>
                             <button onClick={() => onSearch({ action: 'skip' })} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-95"> ⏭ </button>
                        </div>
                        {track.queue && track.queue.length > 0 && ( <button onClick={() => setShowQueue(!showQueue)} className="text-[10px] text-white/50 hover:text-white mt-1"> {showQueue ? "Hide Queue" : `Next: ${track.queue.length} songs`} </button> )}
                    </>
                ) : ( <div className="flex flex-col items-center justify-center h-full text-white/20"> <div className="text-6xl mb-4">💿</div> <p className="text-sm font-bold uppercase tracking-widest">{t('room_idle')}</p> </div> )}
            </div>
            {showQueue && track?.queue?.length > 0 && (
                <div className="absolute inset-0 z-30 bg-black/90 p-4 overflow-y-auto animate-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center mb-2"> <span className="text-xs font-bold text-white/50 uppercase">Up Next</span> <button onClick={() => setShowQueue(false)} className="text-white text-lg">✕</button> </div>
                    <div className="space-y-2"> {track.queue.map((q: any, i: number) => ( <div key={i} className="flex gap-3 items-center bg-white/5 p-2 rounded-lg"> <img src={q.image} className="w-8 h-8 rounded object-cover"/> <div className="flex-1 min-w-0"> <div className="text-xs text-white truncate">{q.title}</div> </div> </div> ))} </div>
                </div>
            )}
            <div className="relative z-20 p-3 bg-black/40 backdrop-blur-md border-t border-white/5">
                <div className="relative flex gap-2">
                    <input className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-all" placeholder={t('room_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) { onSearch({ action: 'queue', query: search }); setSearch(""); } }} />
                    {track?.current && ( <button onClick={() => onSearch({ action: 'stop' })} className="px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">■</button> )}
                </div>
            </div>
        </div>
    );
});
RoomPlayer.displayName = "RoomPlayer";

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
                    if (isVideoActive !== hasVideo) { setHasVideo(isVideoActive); if (onVideoChange) onVideoChange(isVideoActive); }
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
        <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden animate-in fade-in group">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full ${isMini ? "object-cover" : "object-contain"} ${hasVideo ? "block" : "hidden"}`} />
            {!hasVideo && ( <div className="flex flex-col items-center animate-in zoom-in-95"> <UserAvatar src={userInfo?.avatar_url} className={`${isMini ? "w-10 h-10" : "w-24 h-24"} rounded-full border-4 border-white/5 mb-3 group-hover:scale-110 transition-transform duration-300`} /> </div> )}
            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-white backdrop-blur-md pointer-events-none border border-white/5">{userInfo?.username}</div>
        </div>
    );
};