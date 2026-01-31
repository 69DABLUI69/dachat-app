"use client";
import { useEffect, useState, useRef, memo, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import EmojiPicker, { Theme } from "emoji-picker-react";
import LiveKitVoiceRoom from "./LiveKitVoiceRoom"; 

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
    ctx_copy: "Copy Text", ctx_delete: "Delete Message", ctx_profile: "Profile", ctx_call: "Start Call", ctx_id: "Copy ID", ctx_remove: "Remove Friend", ctx_add: "Add Friend",
    ctx_edit: "Edit Message", ctx_reply: "Reply", chat_editing: "Editing...", chat_replying: "Replying to",
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
    ctx_copy: "Copiază Text", ctx_delete: "Șterge Mesaj", ctx_profile: "Profil", ctx_call: "Începe Apel", ctx_id: "Copiază ID", ctx_remove: "Șterge Prieten", ctx_add: "Adaugă Prieten",
    ctx_edit: "Editează", ctx_reply: "Răspunde", chat_editing: "Editare...", chat_replying: "Răspuns către",
    call_incoming: "Apel de intrare...", call_ended: "Încheie Apel", call_duration: "Durată", room_idle: "DJ Inactiv", room_playing: "Acum Redă", room_search: "Caută pe YouTube..."
  }
};

// 🔊 SOUNDBOARD SOUNDS
const SOUNDS = [
    { id: "vine", emoji: "💥", file: "/sounds/vine.mp3" },
    { id: "bruh", emoji: "🗿", file: "/sounds/bruh.mp3" },
    { id: "airhorn", emoji: "📣", file: "/sounds/airhorn.mp3" },
    { id: "cricket", emoji: "🦗", file: "/sounds/cricket.mp3" }
];

const TAGLINES = ["Tel Aviv group trip 2026 ?", "Debis", "Endorsed by the Netanyahu cousins", "Also try DABROWSER", "Noua aplicatie suvenirista", "No Basinosu allowed", "Nu stati singuri cu bibi pe VC", "E buna Purcela", "I AM OBEZ DELUXE 2026 ?", "500 pe seara", "Sure buddy", "Mor vecinii", "Aplicatie de jocuri dusmanoasa", "Aplicatie de jocuri patriotica", "Aplicatie de jocuri prietenoasa", "Sanatate curata ma", "Garju 8-bit", "Five Nights at Valeriu (rip)", "Micu Vesel group trip 202(si ceva) ?"];
const APP_VERSION = "1.4.0"; 
const WHATS_NEW = ["📝 Message Editing & Replies", "🎭 Voice Soundboard", "📂 Server Categories", "✨ Markdown Support"];
const RINGTONES = [{ name: "Default (Classic)", url: "/ringtones/classic.mp3" }, { name: "Cosmic Flow", url: "/ringtones/cosmic.mp3" }, { name: "Retro Beep", url: "/ringtones/beep.mp3" }, { name: "Soft Chime", url: "/ringtones/chime.mp3" }];

if (typeof window !== 'undefined') { (window as any).global = window; (window as any).process = { env: { DEBUG: undefined }, }; (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; }

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dachat-app.onrender.com"; 
const KLIPY_API_KEY = "bfofoQzlu5Uu8tpvTAnOn0ZC64MyxoVBAgJv52RbIRqKnjidRZ6IPbQqnULhIIi9"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";

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
  const [voiceStates, setVoiceStates] = useState<Record<string, number[]>>({});
  
  const [selectedRingtone, setSelectedRingtone] = useState(RINGTONES[0].url);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  // NEW FEATURE STATES
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSoundboard, setShowSoundboard] = useState(false);

  // BUG REPORTING VARIABLES
  const [showReportBug, setShowReportBug] = useState(false);
  const [bugDesc, setBugDesc] = useState("");
  const [bugFile, setBugFile] = useState<File | null>(null);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const t = (key: string) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;

  // FEATURE: MARKDOWN PARSER
  const formatMessage = (content: string) => {
    if (!content) return null;
    if (content.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|bmp)$/i)) {
        return <img src={content} className="max-w-[200px] md:max-w-[250px] rounded-lg transition-transform hover:scale-105" alt="attachment" />;
    }
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <b key={i} className="font-bold text-yellow-200">{part.slice(2, -2)}</b>;
        if (part.startsWith('*') && part.endsWith('*')) return <i key={i} className="italic text-blue-200">{part.slice(1, -1)}</i>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-black/30 px-1 rounded font-mono text-xs text-red-200">{part.slice(1, -1)}</code>;
        if (part.match(/https?:\/\/[^\s]+/)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
        return <span key={i} className="break-words">{part}</span>;
    });
  };

  useEffect(() => { setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]); }, []);
  
  useEffect(() => { 
      if (typeof window !== 'undefined') { 
          joinSoundRef.current = new Audio('/join.mp3'); 
          leaveSoundRef.current = new Audio('/leave.mp3'); 
          joinSoundRef.current.load(); 
          leaveSoundRef.current.load();
          const savedRingtone = localStorage.getItem("dachat_ringtone");
          if (savedRingtone) setSelectedRingtone(savedRingtone);
          
          const savedLang = localStorage.getItem("dachat_lang");
          if (savedLang) setLang(savedLang);

          const storedVersion = localStorage.getItem("dachat_version");
          if (storedVersion !== APP_VERSION) setShowChangelog(true);
      } 
  }, []);

  const closeChangelog = () => { localStorage.setItem("dachat_version", APP_VERSION); setShowChangelog(false); };

// NEW IMPROVED CODE
useEffect(() => {
    // Initialize the audio object and set volume
    ringtoneAudioRef.current = new Audio(selectedRingtone);
    ringtoneAudioRef.current.loop = true;
    ringtoneAudioRef.current.volume = 0.5; // Ensure it's audible
    ringtoneAudioRef.current.load();

    return () => {
        if (ringtoneAudioRef.current) {
            ringtoneAudioRef.current.pause();
            ringtoneAudioRef.current = null;
        }
    };
}, [selectedRingtone]);

useEffect(() => {
    const playRingtone = async () => {
        if (incomingCall && ringtoneAudioRef.current) {
            try {
                ringtoneAudioRef.current.currentTime = 0;
                await ringtoneAudioRef.current.play();
            } catch (error) {
                console.error("Autoplay blocked. User must click the page first.", error);
            }
        } else if (!incomingCall && ringtoneAudioRef.current) {
            ringtoneAudioRef.current.pause();
            ringtoneAudioRef.current.currentTime = 0;
        }
    };
    playRingtone();
}, [incomingCall]);

useEffect(() => {
      const unlockAudio = () => {
          if (ringtoneAudioRef.current) {
              ringtoneAudioRef.current.play().then(() => {
                  ringtoneAudioRef.current?.pause();
              }).catch(() => {});
              window.removeEventListener('click', unlockAudio);
          }
      };
      window.addEventListener('click', unlockAudio);
      return () => window.removeEventListener('click', unlockAudio);
  }, []);

  useEffect(() => {
      const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

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

  // UPDATE: SOCKET LISTENERS (With Edit/Reply/Soundboard)
  useEffect(() => { 
      socket.connect(); 
      const handleConnect = () => { if (user) { socket.emit("setup", user.id); socket.emit("get_online_users"); } };
      socket.on("connect", handleConnect);
      if (socket.connected && user) { socket.emit("setup", user.id); socket.emit("get_online_users"); }
      
      socket.on("receive_message", (msg) => { const normalized = { ...msg, sender_id: msg.sender_id || msg.senderId, sender_name: msg.sender_name || msg.senderName, file_url: msg.file_url || msg.fileUrl }; if (user && normalized.sender_id === user.id) return; setChatHistory(prev => [...prev, normalized]); });
      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      socket.on("message_deleted", (messageId) => { setChatHistory(prev => prev.filter(msg => msg.id !== messageId)); });
      
      // NEW: Message Edited
      socket.on("message_updated", (updatedMsg) => {
          setChatHistory(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, content: updatedMsg.content, is_edited: true } : m));
      });

      // NEW: Trigger Soundboard
      socket.on("trigger_sound", ({ soundId }) => {
          const sound = SOUNDS.find(s => s.id === soundId);
          if (sound) {
              const audio = new Audio(sound.file);
              audio.volume = 0.5;
              audio.play().catch(e => console.log("Audio play blocked", e));
          }
      });

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
      socket.on("call_rejected", () => { alert("Call declined by user"); leaveCall(); });
      
      return () => { socket.off("receive_message"); socket.off("load_messages"); socket.off("voice_state_update"); socket.off("user_updated"); socket.off("new_friend_request"); socket.off("incoming_call"); socket.off("server_updated"); socket.off("new_server_invite"); socket.off("user_connected"); socket.off("user_disconnected"); socket.off("online_users"); socket.off("request_accepted"); socket.off("friend_removed"); socket.off("message_deleted"); socket.off("audio_state_update"); socket.off("audio_state_clear"); socket.off("call_rejected"); socket.off("message_updated"); socket.off("trigger_sound"); }; 
  }, [user, viewingProfile, active.server, inCall]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, active.channel, active.friend]);
  useEffect(() => { if (user) { fetchServers(user.id); fetchFriends(user.id); fetchRequests(user.id); } }, [user]);

  const handleAuth = async () => {
    if (is2FALogin) {
        const res = await fetch(`${BACKEND_URL}/auth/2fa/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: tempUserId, token: twoFACode }) });
        const data = await res.json();
        if (data.success) { if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user)); setUser(data.user); } else { setError(data.message || "Invalid Code"); }
        return;
    }
    if (!authForm.username.trim() || !authForm.password.trim()) { setError("Enter credentials"); return; }
    const endpoint = isRegistering ? "register" : "login";
    try {
      const res = await fetch(`${BACKEND_URL}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) });
      const data = await res.json();
      if (data.requires2FA) { setTempUserId(data.userId); setIs2FALogin(true); setError(""); return; }
      if (data.success) { if (rememberMe) localStorage.setItem("dachat_user", JSON.stringify(data.user)); setUser(data.user); } else setError(data.message || "Auth failed");
    } catch { setError("Connection failed"); }
  };

  const handleLogout = () => { if(confirm("Are you sure you want to log out?")) { localStorage.removeItem("dachat_user"); window.location.reload(); } };
  const fetchServers = async (id: number) => { const res = await fetch(`${BACKEND_URL}/my-servers/${id}`); setServers(await res.json()); };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());
  const fetchRequests = async (id: number) => setRequests(await (await fetch(`${BACKEND_URL}/my-requests/${id}`)).json());

  const selectServer = async (server: any) => { setView("servers"); setActive((prev:any) => ({ ...prev, server, friend: null, pendingRequest: null })); setIsCallExpanded(false); const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`); const chData = await res.json(); setChannels(chData); if(!active.channel && chData.length > 0) { const firstText = chData.find((c:any) => c.type === 'text'); if (firstText) joinChannel(firstText); } const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`); setServerMembers(await memRes.json()); };
  const joinChannel = (channel: any) => { if (channel.type === 'voice') { if (inCall && activeVoiceChannelId === channel.id.toString()) setIsCallExpanded(true); else if (channel.id) joinVoiceRoom(channel.id.toString()); } else { setActive((prev: any) => ({ ...prev, channel, friend: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() }); } };
  const selectFriend = (friend: any) => { setActive((prev: any) => ({ ...prev, friend, channel: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); const ids = [user.id, friend.id].sort((a, b) => a - b); socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` }); };
  const selectRequest = (requestUser: any) => { setActive((prev: any) => ({ ...prev, pendingRequest: requestUser, friend: null, channel: null })); setIsCallExpanded(false); setShowMobileChat(true); };

  const sendFriendRequest = async () => { const usernameToAdd = prompt("Enter username to request:"); if (!usernameToAdd) return; await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); };
  const handleAddFriend = async (targetUser: any) => { const res = await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd: targetUser.username }) }); const data = await res.json(); alert(data.message); setContextMenu({ ...contextMenu, visible: false }); };
  const handleAcceptRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/accept-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchFriends(user.id); fetchRequests(user.id); selectFriend(active.pendingRequest); };
  const handleDeclineRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/decline-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchRequests(user.id); setActive({...active, pendingRequest: null}); };
  const handleRemoveFriend = async (targetId: number | null = null) => { const idToRemove = targetId || viewingProfile?.id; if (!idToRemove) return; if (!confirm("Are you sure you want to remove this friend?")) return; await fetch(`${BACKEND_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendId: idToRemove }) }); fetchFriends(user.id); if (viewingProfile?.id === idToRemove) setViewingProfile(null); if (active.friend?.id === idToRemove) setActive({ ...active, friend: null }); };

  // FEATURE: UPDATED SEND MESSAGE (Handles Edit & Reply)
  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { 
      if (editingId) {
          const roomId = active.channel ? active.channel.id.toString() : `dm-${[user.id, active.friend.id].sort((a:any,b:any)=>a-b).join('-')}`;
          socket.emit("edit_message", { messageId: editingId, newContent: textMsg, roomId });
          setChatHistory(prev => prev.map(m => m.id === editingId ? { ...m, content: textMsg, is_edited: true } : m));
          setEditingId(null);
          setMessage("");
          return;
      }
      const content = textMsg || (fileUrl ? "Sent an image" : ""); 
      const payload: any = { 
          content, senderId: user.id, senderName: user.username, fileUrl, avatar_url: user.avatar_url, id: Date.now(), created_at: new Date().toISOString(), 
          replyToId: replyTo ? replyTo.id : null 
      };
      setChatHistory(prev => [...prev, { ...payload, sender_id: user.id, sender_name: user.username, file_url: fileUrl, avatar_url: user.avatar_url, reply_to_id: replyTo ? replyTo.id : null }]);
      if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } 
      setMessage(""); setReplyTo(null); 
  };

  // FUNCTION TO HANDLE BUG REPORTING
  const handleReportBug = async () => {
      if (!bugDesc.trim()) return alert("Please describe the bug.");
      
      setIsSubmittingBug(true);
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("description", bugDesc);
      if (bugFile) formData.append("screenshot", bugFile);

      try {
          const res = await fetch(`${BACKEND_URL}/report-bug`, { method: "POST", body: formData });
          const data = await res.json();
          if (data.success) {
              alert("Thanks! Bug reported.");
              setShowReportBug(false);
              setBugDesc("");
              setBugFile(null);
          } else {
              alert("Failed to report bug: " + data.message);
          }
      } catch (e) {
          alert("Connection error");
      } finally {
          setIsSubmittingBug(false);
      }
  };

  // FEATURE: SOUNDBOARD TRIGGER
  const playSoundEffect = (soundId: string) => { const roomId = activeVoiceChannelId; if (roomId) socket.emit("play_sound", { roomId, soundId }); };

  const deleteMessage = (msgId: number) => { const roomId = active.channel ? active.channel.id.toString() : `dm-${[user.id, active.friend.id].sort((a:any,b:any)=>a-b).join('-')}`; socket.emit("delete_message", { messageId: msgId, roomId }); setChatHistory(prev => prev.filter(m => m.id !== msgId)); };
  
  const playMusic = async (payload: any) => { 
      if (!activeVoiceChannelId) return; 
      const body = typeof payload === 'string' ? { channelId: activeVoiceChannelId, query: payload, action: 'queue' } : { channelId: activeVoiceChannelId, ...payload };
      try { const res = await fetch(`${BACKEND_URL}/channels/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (data.success && data.state) { setCurrentTrack(data.state); } } catch (err) { console.error("Music Error:", err); }
  };

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
  
// UPDATED: Call Join Logic
  const joinVoiceRoom = useCallback((roomId: string) => {
      if (!user) return;
      setActiveVoiceChannelId(roomId);
      setIsCallExpanded(true);
      setInCall(true);
      
      // FIX: Tell server we joined so we get music updates & show up in the list
      socket.emit("join_voice", { roomId, userData: user });

      if (joinSoundRef.current) { 
          joinSoundRef.current.currentTime = 0; 
          joinSoundRef.current.play().catch(() => {}); 
      }
  }, [user]);

  const leaveCall = () => {
      if(leaveSoundRef.current) leaveSoundRef.current.play().catch(()=>{});
      setInCall(false);
      setIncomingCall(null);
      setActiveVoiceChannelId(null);
      setIsCallExpanded(false);
      socket.emit("leave_voice");
  };

  const onTouchStart = (e: any) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: any) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => { if (!touchStart || !touchEnd) return; const distance = touchStart - touchEnd; if (distance > 50) setShowMobileMembers(true); if (distance < -50) setShowMobileMembers(false); };

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-black relative overflow-hidden p-0 md:p-4">
      {/* AUTH SCREEN - SAME AS BEFORE */}
      <div className="absolute inset-0 bg-linear-to-br from-indigo-900 via-purple-900 to-black opacity-40 animate-pulse-slow"></div>
      <GlassPanel className="p-10 w-full h-full md:h-auto md:max-w-100 rounded-none md:rounded-[40px] text-center relative z-10 flex flex-col justify-center gap-6 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-32 h-32 mx-auto mb-2 flex items-center justify-center relative hover:scale-105 transition-transform duration-500">
            <img src="/logo.png" alt="DaChat" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(100,100,255,0.5)] rounded-4xl" />
        </div>
        <div> <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-white to-white/60">DaChat</h1> <p className="text-white/40 text-sm mt-2">{tagline}</p> </div>
        {error && <div className="bg-red-500/20 text-red-200 text-xs py-3 rounded-xl border border-red-500/20 animate-in slide-in-from-top-2">{error}</div>}
        <div className="space-y-3">
            {!is2FALogin ? (
                <>
                    <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20 hover:bg-black/40" placeholder={t('auth_user')} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
                    <div className="relative">
                        <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20 hover:bg-black/40 pr-12" type={showPassword ? "text" : "password"} placeholder={t('auth_pass')} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xl">{showPassword ? "🙈" : "👁️"}</button>
                    </div>
                    {!isRegistering && ( <div className="flex items-center gap-2 px-2"> <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-blue-600"/> <label htmlFor="remember" className="text-xs text-white/50 cursor-pointer select-none hover:text-white transition-colors">{t('auth_remember')}</label> </div> )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4">
                    <div className="text-center text-white/50 mb-2 text-xs">{t('auth_2fa')}</div>
                    <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="000 000" maxLength={6} onChange={e => setTwoFACode(e.target.value)} />
                    <button onClick={() => setIs2FALogin(false)} className="w-full text-xs text-white/30 mt-2 hover:text-white">{t('auth_back')}</button>
                </div>
            )}
        </div>
        <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-2xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-[1.02] transition-all active:scale-95 duration-200"> {is2FALogin ? t('auth_verify') : (isRegistering ? t('auth_register') : t('auth_login'))} </button>
        {!is2FALogin && <p className="text-xs text-white/40 cursor-pointer hover:text-white transition-colors" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? t('auth_back') : t('auth_register')}</p>}
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

      {/* 2. SIDEBAR - FEATURE: CATEGORIES ADDED */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} relative z-10 h-screen bg-black/20 backdrop-blur-md border-r border-white/5 flex-col md:w-65 md:ml-22.5 w-[calc(100vw-90px)] ml-22.5 animate-in fade-in duration-500`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 font-bold tracking-wide">
            <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">{active.server ? active.server.name : t('dock_dm')}</span>
            {active.server && isMod && <button onClick={openServerSettings} className="text-xs text-white/50 hover:text-white transition-colors duration-200 hover:rotate-90">⚙️</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {view === "servers" && active.server ? (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>{t('side_channels')}</span> {isMod && <button onClick={createChannel} className="text-lg hover:text-white transition-transform hover:scale-110">+</button>} </div>
                    {/* Render Text Channels */}
                    {channels.filter(c => c.type === 'text').map(ch => (
                        <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200 ${active.channel?.id === ch.id ? "bg-white/10 text-white scale-[1.02]" : "text-white/50 hover:bg-white/5 hover:text-white hover:translate-x-1"}`}>
                            <div className="flex items-center gap-2 truncate flex-1 min-w-0" onClick={() => joinChannel(ch)}> 
                                <span className="opacity-50 shrink-0">#</span> <span className="truncate">{ch.name}</span>
                            </div>
                            {isMod && <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-xs text-red-400 shrink-0 hover:text-red-300 transition-colors">✕</button>}
                        </div>
                    ))}

                    <div className="mt-4 flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>VOICE CHANNELS</span> </div>
                    {/* Render Voice Channels */}
{channels.filter(c => c.type === 'voice').map(ch => {
                        const currentUsers = voiceStates[ch.id.toString()] || [];
                        const activeMembers = serverMembers.filter(m => currentUsers.includes(m.id));
                        return ( 
                            <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200 ${active.channel?.id === ch.id ? "bg-white/10 text-white scale-[1.02]" : "text-white/50 hover:bg-white/5 hover:text-white hover:translate-x-1"}`}>
                                <div className="flex items-center gap-2 truncate flex-1 min-w-0" onClick={() => joinChannel(ch)}> 
                                    <span className="opacity-50 shrink-0">🔊</span> 
                                    <span className="truncate">{ch.name}</span>
                                    
                                    {/* ✅ FIX: Avatars are now here, with ml-2 (margin-left) instead of ml-auto */}
                                    {activeMembers.length > 0 && (
                                        <div className="flex -space-x-1 ml-2 shrink-0 animate-in fade-in">
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
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>{t('side_req')}</span> <button onClick={sendFriendRequest} className="text-lg hover:text-white transition-transform hover:scale-110">+</button> </div>
                    {requests.map(req => ( 
                        <div key={req.id} onClick={() => selectRequest(req)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all duration-200 ${active.pendingRequest?.id===req.id?"bg-white/10 scale-[1.02]":""}`}> 
                            <UserAvatar src={req.avatar_url} className="w-8 h-8 rounded-full" /> 
                            <div><div className="text-xs font-bold">{req.username}</div><div className="text-[9px] text-yellow-400 animate-pulse">Request</div></div> 
                        </div> 
                    ))}
                    <div className="mt-4 px-2 text-[10px] font-bold text-white/40 uppercase">{t('side_friends')}</div>
                    {friends.map(f => {
                        const isOnline = onlineUsers.has(f.id) || (f as any).is_online;
                        const steamInfo = f.steam_id ? steamStatuses[f.steam_id] : null;
                        const isPlaying = steamInfo?.gameextrainfo;
                        const lobbyId = steamInfo?.lobbysteamid;
                        return (
                            <div key={f.id} onContextMenu={(e) => handleContextMenu(e, 'user', f)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all duration-200 hover:translate-x-1 ${active.friend?.id===f.id?"bg-white/10 scale-[1.02]":""}`} > 
                                <div className="relative"> <UserAvatar onClick={(e:any)=>{e.stopPropagation(); viewUserProfile(f.id)}} src={f.avatar_url} className={`w-8 h-8 rounded-full ${isPlaying ? "ring-2 ring-green-500" : ""}`} /> {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>} </div>
                                <div className="flex-1 min-w-0" onClick={()=>selectFriend(f)}>
                                    <div className="flex justify-between items-center"> <div className="text-xs font-bold truncate">{f.username}</div> {isPlaying && <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3 opacity-50" />} </div>
                                    {isPlaying ? ( <div className="flex flex-col gap-1 mt-1"> <div className="text-[10px] text-green-400 font-bold truncate">{t('status_playing')} {steamInfo.gameextrainfo}</div> <a href={lobbyId ? `steam://joinlobby/${steamInfo.gameid}/${lobbyId}/${f.steam_id}` : `steam://run/${steamInfo.gameid}`} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[9px] font-bold px-2 py-1 rounded border border-green-600/30 text-center transition-colors block" onClick={(e) => e.stopPropagation()}> {lobbyId ? t('steam_join') : t('steam_launch')} </a> </div> ) : ( <div className={`text-[9px] transition-colors duration-300 ${isOnline ? "text-green-400/50" : "text-white/30"}`}> {isOnline ? t('status_on') : t('status_off')} </div> )}
                                </div> 
                            </div> 
                        );
                    })}
                </>
            )}
        </div>
      </div>

      {/* 3. MAIN CONTENT (With Swipe Handlers) */}
      <div 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
        className={`${showMobileChat ? 'flex animate-in slide-in-from-right-full duration-300' : 'hidden md:flex'} flex-1 flex-col relative z-10 min-w-0 bg-transparent`}
      >
         <div className="absolute inset-0 flex flex-col z-0">
             {(active.channel || active.friend) && (
                 <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md animate-in fade-in slide-in-from-top-2"> 
                    <div className="flex items-center gap-3 font-bold text-lg overflow-hidden"> 
                        <button className="md:hidden mr-2 p-1 text-white/50 hover:text-white transition-transform active:scale-90" onClick={() => setShowMobileChat(false)}>←</button>
                        <span className="text-white/30">@</span> 
                        <span className="truncate">{active.channel ? active.channel.name : active.friend?.username}</span>
                    </div> 
                    <div className="flex gap-2">
                        {!active.channel && <button onClick={() => startDMCall()} className="bg-green-600 p-2 rounded-full hover:bg-green-500 shrink-0 transition-transform hover:scale-110 active:scale-90">📞</button>} 
                        {/* Mobile: Toggle Members Button */}
                        {view === "servers" && active.server && (
                           <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setShowMobileMembers(!showMobileMembers)}>👥</button>
                        )}
                    </div>
                 </div>
             )}
             
             {inCall && !isCallExpanded && ( <div onClick={() => setIsCallExpanded(true)} className="bg-green-600/20 text-green-400 p-2 text-center text-xs font-bold cursor-pointer hover:bg-green-600/30 border-b border-green-600/20 transition-all animate-pulse">{t('call_return')}</div> )}

             {active.pendingRequest ? (
                 <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95">
                     <button className="md:hidden absolute top-4 left-4 text-white/50" onClick={() => setShowMobileChat(false)}>← Back</button>
                     <UserAvatar src={active.pendingRequest.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/10" />
                     <div className="text-xl font-bold">{active.pendingRequest.username}</div>
                     <div className="flex gap-3"> <button onClick={handleAcceptRequest} className="px-6 py-2 bg-green-600 rounded-lg font-bold hover:bg-green-500 transition-all hover:scale-105 active:scale-95">{t('btn_accept')}</button> <button onClick={handleDeclineRequest} className="px-6 py-2 bg-red-600/30 text-red-200 rounded-lg font-bold hover:bg-red-600/40 transition-all hover:scale-105 active:scale-95">{t('btn_decline')}</button> </div>
                 </div>
             ) : (active.channel || active.friend) ? (
                 <>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {chatHistory.map((msg, i) => ( 
                            <div key={msg.id || i} className={`flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`} onContextMenu={(e) => handleContextMenu(e, 'message', msg)}> 
                                <UserAvatar onClick={()=>viewUserProfile(msg.sender_id)} src={msg.avatar_url} className="w-10 h-10 rounded-xl hover:scale-105 transition-transform" /> 
                                <div className={`max-w-[85%] md:max-w-[70%] ${msg.sender_id===user.id?"items-end":"items-start"} flex flex-col`}> 
                                    <div className="flex items-center gap-2 mb-1"> 
                                        <span className="text-xs font-bold text-white/50">{msg.sender_name}</span> 
                                        {msg.is_edited && <span className="text-[9px] text-white/30">(edited)</span>}
                                    </div> 
                                    
                                    {/* ⚡️ FEATURE: REPLY RENDER */}
                                    {msg.reply_to_id && (
                                        <div className="mb-1 text-[10px] text-white/40 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border-l-2 border-indigo-500">
                                            <span>⤴️ {t('chat_replying')}</span>
                                        </div>
                                    )}

                                    <div className={`group px-4 py-2 rounded-2xl text-sm shadow-md cursor-pointer transition-all hover:scale-[1.01] ${msg.sender_id===user.id?"bg-blue-600":"bg-white/10"}`}> 
                                        {formatMessage(msg.content)} 
                                    </div> 
                                    {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-62.5 rounded-xl border border-white/10 transition-transform hover:scale-105 cursor-pointer" />} 
                                </div> 
                            </div> 
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* FEATURE: EDIT / REPLY BANNER */}
                    {replyTo && (
                        <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex justify-between items-center animate-in slide-in-from-bottom-2">
                            <div className="text-xs text-white/60"> {t('chat_replying')} <span className="font-bold text-white">{replyTo.sender_name}</span> </div>
                            <button onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white">✕</button>
                        </div>
                    )}
                    {editingId && (
                        <div className="px-4 py-2 bg-yellow-900/20 border-t border-yellow-500/20 flex justify-between items-center animate-in slide-in-from-bottom-2">
                            <div className="text-xs text-yellow-200"> {t('chat_editing')} </div>
                            <button onClick={() => { setEditingId(null); setMessage(""); }} className="text-yellow-200/50 hover:text-yellow-200">✕</button>
                        </div>
                    )}

                    <div className="p-4 relative">
                        {showEmojiPicker && <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-[30px] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"><EmojiPicker theme={Theme.DARK} onEmojiClick={(e) => setMessage((prev) => prev + e.emoji)} lazyLoadEmojis={true}/></div>}
                        {showGifPicker && <div className="absolute bottom-20 left-4 z-50 w-full"><GifPicker onSelect={(u:string)=>{sendMessage(null,u); setShowGifPicker(false)}} onClose={()=>setShowGifPicker(false)} /></div>}
                        <div className="bg-white/5 border border-white/10 rounded-full p-2 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-black/40"> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>fileInputRef.current?.click()}>📎</button> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-[10px] font-bold text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>setShowGifPicker(!showGifPicker)}>GIF</button> 
                            <button className={`w-10 h-10 rounded-full hover:bg-white/10 text-xl transition-transform hover:scale-110 active:scale-90 ${showEmojiPicker ? "bg-white/10 text-white" : "text-white/50"}`} onClick={() => {setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false);}} onMouseEnter={() => setEmojiBtnIcon(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)])}>{emojiBtnIcon}</button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> 
                            <input className="flex-1 bg-transparent outline-none px-2 min-w-0" placeholder={t('chat_placeholder')} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage(message)} /> 
                        </div>
                    </div>
                 </>
             ) : <div className="flex-1 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest animate-pulse">{t('chat_select')}</div>}
         </div>

{/* LAYER 2: CALL UI */}
         {inCall && (
             <div className={`${isCallExpanded ? "absolute inset-0 z-50 bg-black animate-in zoom-in-95 duration-300" : "hidden"} flex flex-col`}>
                 
                 {/* Top Header Controls */}
                 <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-start z-[60] pointer-events-none">
                     <div /> {/* Spacer */}
                     <div className="flex gap-2 pointer-events-auto">
                         <button onClick={() => setShowSoundboard(!showSoundboard)} className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold backdrop-blur-md transition-all shadow-lg flex items-center gap-2"> 
                            <span>🎭</span> Sounds
                         </button>
                         <button onClick={() => setIsCallExpanded(false)} className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold backdrop-blur-md transition-all shadow-lg flex items-center gap-2"> 
                            <span></span> Minimize 
                         </button>
                     </div>
                 </div>

                 {/* Main Content Area */}
                 <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden h-full relative pt-16">
                    
                    {/* Soundboard Popup */}
                    {showSoundboard && (
                        <div className="absolute top-14 right-4 z-[70] bg-black/90 border border-white/20 rounded-2xl p-4 w-64 animate-in zoom-in-95 shadow-2xl">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Soundboard</span>
                                <button onClick={() => setShowSoundboard(false)}>✕</button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {SOUNDS.map(s => (
                                    <button key={s.id} onClick={() => playSoundEffect(s.id)} className="aspect-square bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-2xl transition-all active:scale-90 border border-white/5">
                                        {s.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 1. MUSIC PLAYER (Synced) */}
                    <div className="w-full md:w-1/2 h-1/2 md:h-full bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative">
                        {/* ✅ FIX: Pass 'onSearch' correctly so buttons sync */}
                        <RoomPlayer track={currentTrack} onSearch={playMusic} t={t} />
                    </div>

                    {/* 2. LIVEKIT VOICE ROOM */}
                    <div className="w-full md:w-1/2 h-1/2 md:h-full bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 relative shadow-lg">
                        <LiveKitVoiceRoom 
                           room={activeVoiceChannelId} 
                           user={user} 
                           onLeave={() => {
                               setInCall(false);
                               setActiveVoiceChannelId(null);
                               setIsCallExpanded(false);
                               // ✅ FIX: Emit leave event so avatar is removed from list
                               socket.emit("leave_voice");
                           }} 
                        />
                    </div>
                 </div>
             </div>
         )}
      </div>

      {/* 4. MEMBER LIST (UPDATED FOR MOBILE SWIPE) */}
      {view === "servers" && active.server && (
          <div 
             onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
             className={`
                fixed inset-y-0 right-0 z-50 w-64 bg-black/95 backdrop-blur-2xl border-l border-white/10 p-4 transition-transform duration-300 ease-in-out shadow-2xl
                lg:relative lg:translate-x-0 lg:bg-black/20 lg:z-20 lg:w-60 lg:shadow-none lg:block
                ${showMobileMembers ? "translate-x-0" : "translate-x-full"}
             `}
          >
              <div className="flex justify-between items-center mb-4">
                  <div className="text-[10px] font-bold text-white/30 uppercase">Members — {serverMembers.length}</div>
                  <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setShowMobileMembers(false)}>✕</button>
              </div>
              <div className="space-y-1 overflow-y-auto h-full pb-20">
                  {serverMembers.map(m => ( <div key={m.id} onContextMenu={(e) => handleContextMenu(e, 'user', m)} onClick={() => viewUserProfile(m.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-all duration-200 hover:translate-x-1"> <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-full transition-transform group-hover:scale-110" /> <div className="flex-1 min-w-0"> <div className={`text-sm font-bold truncate ${m.id === active.server.owner_id ? "text-yellow-500" : "text-white/80"}`}>{m.username}</div> </div> {m.id === active.server.owner_id && <span className="animate-pulse">👑</span>} {m.is_admin && m.id !== active.server.owner_id && <span>🛡️</span>} </div> ))}
              </div>
          </div>
      )}

      {/* ... [KEEP MODALS, SETTINGS, AND MUSIC PLAYER COMPONENTS EXACTLY AS THEY ARE] ... */}
      {/* (Omitted for brevity - keep your existing code for modals and RoomPlayer) */}
      
      {incomingCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-300">
              <div className="relative flex flex-col items-center gap-8 animate-in slide-in-from-bottom-12 duration-500">
                  <div className="relative"> <div className="absolute inset-0 bg-blue-500/30 blur-[60px] rounded-full animate-pulse-slow"></div> <UserAvatar src={incomingCall.avatarUrl} className="w-40 h-40 rounded-full border-4 border-white/20 shadow-2xl relative z-10 animate-bounce-slow" /> </div>
                  <div className="text-center z-10"> <h2 className="text-3xl font-bold text-white mb-2">{incomingCall.senderName}</h2> <p className="text-white/50 text-lg animate-pulse">{t('call_incoming')}</p> </div>
                  <div className="flex gap-8 z-10"> <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-transform hover:scale-110 shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95"> <span className="text-2xl">📞</span> </button> <button onClick={answerCall} className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-transform hover:scale-110 shadow-[0_0_30px_rgba(22,163,74,0.4)] active:scale-95 animate-wiggle"> <span className="text-2xl">📞</span> </button> </div>
              </div>
          </div>
      )}

      {viewingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={() => setViewingProfile(null)}>
              <GlassPanel className="w-full max-w-md p-8 flex flex-col items-center relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-300" onClick={(e:any)=>e.stopPropagation()}>
                  <UserAvatar src={viewingProfile.avatar_url} className="w-24 h-24 rounded-full mb-4 border-4 border-white/10 hover:scale-105 transition-transform" />
                  <h2 className="text-2xl font-bold">{viewingProfile.username}</h2>
                  <p className="text-white/50 text-sm mt-2 text-center">{viewingProfile.bio || "No bio set."}</p>
                  {friends.some((f: any) => f.id === viewingProfile.id) && <button onClick={() => handleRemoveFriend(viewingProfile.id)} className="mt-6 w-full py-2 bg-red-500/20 text-red-400 rounded-lg font-bold hover:bg-red-500/30 transition-all hover:scale-105">{t('ctx_remove')}</button>}
                  {active.server && isOwner && viewingProfile.id !== user.id && serverMembers.some((m:any) => m.id === viewingProfile.id) && ( <div className="mt-4 w-full space-y-2 pt-4 border-t border-white/10"> <div className="text-[10px] uppercase text-white/30 font-bold text-center mb-2">Owner Actions</div> <button onClick={() => promoteMember(viewingProfile.id)} className="w-full py-2 bg-blue-500/20 text-blue-300 rounded-lg font-bold text-sm hover:bg-blue-500/30 transition-all hover:scale-105">Toggle Moderator</button> </div> )}
              </GlassPanel>
          </div>
      )}

      {showChangelog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-500">
              <GlassPanel className="w-full max-w-sm p-8 flex flex-col items-center text-center border-2 border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.3)]">
                  <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-lg animate-bounce"> 🚀 </div>
                  <h2 className="text-2xl font-bold text-white mb-1">Update Available!</h2>
                  <p className="text-indigo-300 text-sm font-mono mb-6">v{APP_VERSION}</p>
                  <div className="w-full bg-white/5 rounded-xl p-4 text-left space-y-3 mb-6 border border-white/5"> {WHATS_NEW.map((item, i) => ( <div key={i} className="flex gap-3 text-sm text-white/80"> <span className="text-indigo-400">➤</span> {item} </div> ))} </div>
                  <button onClick={closeChangelog} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg"> Awesome, Let's Go! </button>
              </GlassPanel>
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-3xl p-8 flex flex-col gap-6 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative max-h-[90vh] overflow-y-auto">
                  {showSettingsGifPicker && ( <div className="absolute inset-0 z-60 bg-[#050505] flex flex-col rounded-4xl overflow-hidden animate-in fade-in duration-200"> <GifPicker className="w-full h-full bg-transparent shadow-none border-none flex flex-col" onClose={() => setShowSettingsGifPicker(false)} onSelect={(url: string) => { setEditForm({ ...editForm, avatarUrl: url }); setNewAvatarFile(null); setShowSettingsGifPicker(false);}}/> </div> )}
                  <h2 className="text-2xl font-bold mb-2">{t('set_header')}</h2>
                  <div> <h3 className="text-xs font-bold text-white/40 uppercase mb-4 tracking-wider">User Profile</h3> <div className="flex flex-col md:flex-row gap-6 items-start"> <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0"> <UserAvatar src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} className="w-24 h-24 rounded-full border-4 border-white/5 hover:border-white/20 transition-all hover:scale-105 cursor-pointer" onClick={()=>(document.getElementById('pUpload') as any).click()} /> <div className="flex flex-col gap-2 w-full"><button 
    onClick={() => setShowReportBug(true)} 
    className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 mt-4"
>
     Report a Bug
</button> <button onClick={()=>(document.getElementById('pUpload') as any).click()} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors w-full text-center">{t('set_upload')}</button> <button onClick={() => setShowSettingsGifPicker(true)} className="text-xs bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-3 py-2 rounded-lg transition-all font-bold shadow-lg w-full text-center">{t('set_gif')}</button> <button onClick={saveSteamId} className="text-xs bg-[#171a21] text-[#c7d5e0] hover:bg-[#2a475e] px-3 py-2 rounded-lg transition-all font-bold shadow-lg flex items-center justify-center gap-2 w-full"><img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3" />{user.steam_id ? "Linked" : "Link Steam"}</button> </div> <input id="pUpload" type="file" className="hidden" onChange={e=>e.target.files && setNewAvatarFile(e.target.files[0])} /> </div> <div className="flex-1 w-full flex flex-col gap-4"> <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Username</label> <input className="w-full bg-white/5 p-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all border border-white/5 focus:bg-black/20" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})} /> </div> <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Bio</label> <textarea className="w-full bg-white/5 p-3 rounded-xl text-white h-24 resize-none focus:ring-2 focus:ring-blue-500/50 outline-none transition-all border border-white/5 focus:bg-black/20" value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} /> </div> </div> </div> </div>
                  <div className="h-px bg-white/10 w-full" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4"> <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">App Preferences</h3> <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4"> <div className="space-y-1"> <label className="text-xs text-indigo-400 font-bold ml-1">{t('set_lang')}</label> <select className="w-full bg-black/40 p-2 rounded-lg text-sm text-white border border-white/10 focus:border-indigo-500/50 outline-none appearance-none" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem("dachat_lang", e.target.value); }} > <option value="en">English (Default)</option> <option value="ro">Română (Romanian)</option> <option value="de">Deutsch (German)</option> <option value="pl">Polski (Polish)</option> <option value="it">Italiano (Italian)</option> <option value="es">Español (Spanish)</option> <option value="pt">Português (Portuguese)</option> <option value="sv">Svenska (Swedish)</option> <option value="bg">Български (Bulgarian)</option> <option value="jp">日本語 (Japanese)</option> <option value="zh">中文 (Chinese)</option> </select> </div> <div className="space-y-1"> <label className="text-xs text-indigo-400 font-bold ml-1">{t('set_ringtone')}</label> <select className="w-full bg-black/40 p-2 rounded-lg text-sm text-white border border-white/10 focus:border-indigo-500/50 outline-none appearance-none" value={selectedRingtone} onChange={(e) => { const newTone = e.target.value; setSelectedRingtone(newTone); localStorage.setItem("dachat_ringtone", newTone); const audio = new Audio(newTone); audio.volume = 0.5; audio.play(); }}> {RINGTONES.map(r => ( <option key={r.url} value={r.url}>{r.name}</option> ))} </select> </div> </div> </div>
                      <div className="space-y-4"> <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Security</h3> <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4"> <div className="flex justify-between items-center"> <span className="font-bold text-sm">{t('set_2fa')}</span> <span className={`text-[10px] px-2 py-1 rounded border ${user.is_2fa_enabled ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}`}> {user.is_2fa_enabled ? "ENABLED" : "DISABLED"} </span> </div> {!user.is_2fa_enabled && setupStep === 0 && <button onClick={start2FASetup} className="w-full py-2 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-600/30 transition-colors">{t('set_setup_2fa')}</button>} {setupStep === 1 && ( <div className="flex flex-col items-center gap-3 animate-in fade-in"> <img src={qrCodeUrl} className="w-24 h-24 rounded-lg border-2 border-white" /> <input className="w-full bg-black/40 p-2 text-center rounded font-mono text-sm" placeholder="123456" maxLength={6} onChange={(e) => setTwoFACode(e.target.value)}/> <button onClick={verify2FASetup} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded">{t('set_verify')}</button> </div> )} {user.is_2fa_enabled && ( <div className="pt-2 border-t border-white/10"> <div className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => setShowPassChange(!showPassChange)}> <span className="font-bold text-sm text-yellow-500">{t('set_pass_change')}</span> <span className="text-white/50 text-xs">{showPassChange ? "▼" : "▶"}</span> </div> {showPassChange && ( <div className="flex flex-col gap-3 animate-in fade-in pt-3"> <div className="relative"> <input type={showNewPassword ? "text" : "password"} className="w-full bg-black/40 p-2 rounded text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none pr-10" placeholder={t('set_new_pass')} value={passChangeForm.newPassword} onChange={(e) => setPassChangeForm({...passChangeForm, newPassword: e.target.value})} /> <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xs">{showNewPassword ? "🙈" : "👁️"}</button> </div> <input className="w-full bg-black/40 p-2 text-center rounded font-mono text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none" placeholder="Auth Code" maxLength={6} value={passChangeForm.code} onChange={(e) => setPassChangeForm({...passChangeForm, code: e.target.value})}/> <button onClick={handleChangePassword} className="w-full py-2 bg-yellow-600/20 text-yellow-500 text-xs font-bold rounded hover:bg-yellow-600/30 transition-colors">{t('set_confirm')}</button> </div> )} </div> )} </div> </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2"> <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-xs font-bold transition-colors px-2">{t('set_logout')}</button> <div className="flex gap-3"> <button onClick={()=>setShowSettings(false)} className="text-white/50 px-4 py-2 hover:text-white transition-colors text-sm">{t('btn_cancel')}</button> <button onClick={saveProfile} className="bg-white text-black px-8 py-2 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg shadow-white/10 text-sm">{t('btn_save')}</button> </div> </div>
              </GlassPanel>
          </div>
      )}

      {showServerSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-md p-8 flex flex-col gap-4 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                  <h2 className="text-xl font-bold">Server Settings</h2>
                  <div className="flex justify-center mb-4 cursor-pointer group" onClick={()=>(document.getElementById('serverImg') as any).click()}> <UserAvatar src={newServerFile ? URL.createObjectURL(newServerFile) : serverEditForm.imageUrl} className="w-20 h-20 rounded-2xl border-2 border-white/20 group-hover:border-white/50 transition-all group-hover:scale-105" /> <input id="serverImg" type="file" className="hidden" onChange={(e)=>e.target.files && setNewServerFile(e.target.files[0])} /> </div>
                  <input className="bg-white/10 p-3 rounded text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={serverEditForm.name} onChange={e=>setServerEditForm({...serverEditForm, name: e.target.value})} />
                  <div className="flex justify-end gap-2"> <button onClick={()=>setShowServerSettings(false)} className="text-white/50 px-4 hover:text-white transition-colors">{t('btn_cancel')}</button> <button onClick={saveServerSettings} className="bg-white text-black px-6 py-2 rounded font-bold hover:scale-105 transition-transform">{t('btn_save')}</button> </div>
              </GlassPanel>
          </div>
      )}

      {/* 🐛 BUG REPORT MODAL */}
      {showReportBug && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-md p-6 flex flex-col gap-4 border border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.1)]">
                  <div className="flex justify-between items-center">
                      <h1 className="text-xl font-bold text-white flex items-center gap-2">Report Issue</h1>
                      <button onClick={() => setShowReportBug(false)} className="text-white/50 hover:text-white">✕</button>
                  </div>
                  
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-white/50 uppercase">Description</label>
                      <textarea 
                          className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500/50 outline-none resize-none" 
                          placeholder="What went wrong? Steps to reproduce..."
                          value={bugDesc}
                          onChange={(e) => setBugDesc(e.target.value)}
                      />
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs font-bold text-white/50 uppercase">Screenshot (Optional)</label>
                      <div 
                          className="border-2 border-dashed border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-white/30 hover:bg-white/5 transition-all"
                          onClick={() => (document.getElementById('bugUpload') as any).click()}
                      >
                          {bugFile ? (
                              <div className="text-green-400 text-sm font-bold flex items-center justify-center gap-2">
                                  <span>🖼️</span> {bugFile.name}
                              </div>
                          ) : (
                              <div className="text-white/30 text-sm">Click to attach screenshot</div>
                          )}
                          <input id="bugUpload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setBugFile(e.target.files[0])} />
                      </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                      <button onClick={() => setShowReportBug(false)} className="flex-1 py-3 text-white/50 hover:text-white transition-colors font-bold text-sm">Cancel</button>
                      <button 
                          onClick={handleReportBug} 
                          disabled={isSubmittingBug}
                          className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                          {isSubmittingBug ? "Sending..." : "Submit Report"}
                      </button>
                  </div>
              </GlassPanel>
          </div>
      )}

      {/* CONTEXT MENU (Same as before) */}
      {contextMenu.visible && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 flex flex-col w-48 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 animate-in zoom-in-95 duration-150 origin-top-left overflow-hidden" onClick={(e) => e.stopPropagation()} >
              {contextMenu.type === 'message' && ( <> <button onClick={() => copyText(contextMenu.data?.content || "")} className="text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>📋</span> {t('ctx_copy')} </button> {contextMenu.data?.sender_id === user.id && ( <button onClick={() => { deleteMessage(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>🗑️</span> {t('ctx_delete')} </button> )} </> )}
              {contextMenu.type === 'user' && ( <> <button onClick={() => { viewUserProfile(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>👤</span> {t('ctx_profile')} </button> <button onClick={() => { startDMCall(contextMenu.data); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>📞</span> {t('ctx_call')} </button> <div className="h-px bg-white/10 my-1 mx-2"></div> <button onClick={() => { navigator.clipboard.writeText(contextMenu.data.id.toString()); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>🆔</span> {t('ctx_id')} </button> <div className="h-px bg-white/10 my-1 mx-2"></div> <button onClick={() => { handleRemoveFriend(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>🚫</span> {t('ctx_remove')} </button> </> )}
          </div>
      )}
    </div>
  );
}

// MUSIC PLAYER COMPONENT
const RoomPlayer = memo(({ track, onSearch, t }: any) => {
    const [search, setSearch] = useState("");
    const [showQueue, setShowQueue] = useState(false);

// Helper to send actions to backend
    const handleControl = (action: string) => {
        // Sends command to server via parent playMusic -> fetch API
        onSearch({ action }); 
    };

    const iframeSrc = useMemo(() => {
        if (!track?.current || track.isPaused) return "";
        const totalElapsedMs = track.elapsed + (track.startTime ? (Date.now() - track.startTime) : 0);
        const startSeconds = Math.floor(totalElapsedMs / 1000);
        return `https://www.youtube.com/embed/${track.current.videoId}?autoplay=1&controls=0&start=${startSeconds}&rel=0&origin=${window.location.origin}`;
    }, [track?.current?.videoId, track?.startTime, track?.isPaused]);

    return (
        <div className="relative w-full h-full bg-zinc-950 flex flex-col group overflow-hidden">
            {track?.current?.image && ( <div className="absolute inset-0 z-0 opacity-20 blur-3xl"> <img src={track.current.image} className="w-full h-full object-cover" alt="bg" /> </div> )}
            <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4 min-h-0">
                {track?.current ? (
                    <>
                        <div className="relative w-32 h-32 md:w-40 md:h-40 shadow-2xl rounded-xl overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform duration-500 shrink-0 bg-black">
                            <img src={track.current.image} className="w-full h-full object-cover" alt="thumb" />
                            {!track.isPaused && ( <iframe className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" src={iframeSrc} allow="autoplay" /> )}
                        </div>
                        <h3 className="text-white font-bold text-center line-clamp-1 px-2 text-sm md:text-base w-full">{track.current.title}</h3>
                        <p className="text-indigo-400 text-[10px] mt-1 font-bold uppercase tracking-widest mb-4"> {track.isPaused ? "⏸ PAUSED" : "▶ NOW PLAYING"} </p>
                        <div className="flex items-center gap-4 mb-2">
                             {/* ✅ FIX: Send 'resume' or 'pause' action */}
                             <button onClick={() => handleControl(track.isPaused ? 'resume' : 'pause')} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center text-xl hover:scale-110 transition-transform active:scale-95"> {track.isPaused ? "▶" : "⏸"} </button>
                             {/* ✅ FIX: Send 'skip' action */}
                             <button onClick={() => handleControl('skip')} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all active:scale-95"> ⏭ </button>
                        </div>
                        {track.queue && track.queue.length > 0 && ( <button onClick={() => setShowQueue(!showQueue)} className="text-[10px] text-white/50 hover:text-white mt-1 underline"> {showQueue ? "Hide Queue" : `View Queue (${track.queue.length})`} </button> )}
                    </>
                ) : ( <div className="flex flex-col items-center justify-center h-full text-white/20"> <div className="text-6xl mb-4">💿</div> <p className="text-sm font-bold uppercase tracking-widest">{t('room_idle')}</p> </div> )}
            </div>
            {/* Queue UI */}
            {showQueue && track?.queue && ( <div className="absolute inset-0 z-30 bg-black/95 p-4 overflow-y-auto animate-in slide-in-from-bottom-10"> <div className="flex justify-between items-center mb-4"> <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Up Next</span> <button onClick={() => setShowQueue(false)} className="text-white/50 hover:text-white">✕</button> </div> <div className="space-y-2"> {track.queue.map((q: any, i: number) => ( <div key={i} className="flex gap-3 items-center bg-white/5 p-2 rounded-lg border border-white/5"> <img src={q.image} className="w-10 h-10 rounded object-cover" alt="q-thumb"/> <div className="flex-1 min-w-0"> <div className="text-xs text-white font-bold truncate">{q.title}</div> <div className="text-[10px] text-white/40">In Queue</div> </div> </div> ))} </div> </div> )}
            
            {/* Search Bar */}
            <div className="relative z-20 p-3 bg-black/60 backdrop-blur-md border-t border-white/5"> <div className="flex gap-2"> 
                {/* FIX: Send full query object */}
                <input className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50" placeholder={t('room_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) { onSearch({ query: search, action: 'queue' }); setSearch(""); } }} /> 
                {track?.current && ( <button onClick={() => handleControl('stop')} className="px-3 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">■</button> )} 
            </div> </div>
        </div>
    );
});
RoomPlayer.displayName = "RoomPlayer";