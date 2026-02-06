"use client";
import { useEffect, useState, useRef, memo, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";
import LiveKitVoiceRoom from "./LiveKitVoiceRoom"; 

// 🌍 TRANSLATIONS DATABASE
const TRANSLATIONS: any = {
  en: {
    auth_user: "Username", auth_pass: "Password", auth_login: "Log in", auth_register: "Create Account", auth_back: "Back to Login", auth_2fa: "Enter code from Authenticator", auth_verify: "Verify 2FA", auth_remember: "Remember me",
    dock_dm: "Direct Messages", side_req: "Requests", side_friends: "Friends", side_channels: "Channels",
    status_on: "Online", status_off: "Offline", status_playing: "Playing", steam_join: "🚀 Join Lobby", steam_launch: "▶ Launch Game",
    chat_placeholder: "Message... @mention", chat_select: "Select a Channel", call_return: "🔊 Call in Progress — Click to Return",
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
    chat_placeholder: "Scrie un mesaj... @mențiune", chat_select: "Selectează un Canal", call_return: "🔊 Apel în Desfășurare — Apasă pentru a reveni",
    btn_accept: "Acceptă", btn_decline: "Refuză", btn_cancel: "Anulează", btn_save: "Salvează", btn_close: "Închide", btn_stop: "Oprește",
    set_header: "Setări", set_2fa: "Autentificare în 2 Pași", set_setup_2fa: "Activează 2FA", set_verify: "Verifică & Activează", set_scan: "Scanează cu Google Authenticator",
    set_ringtone: "Ton de Apel", set_pass_change: "Schimbă Parola", set_new_pass: "Parolă Nouă", set_confirm: "Confirmă & Delogare",
    set_upload: "Încarcă Foto", set_gif: "Alege GIF", set_steam: "Leagă Steam", set_steam_linked: "Steam Legat", set_logout: "Delogare", set_lang: "Limbă",
    ctx_copy: "Copiază Text", ctx_delete: "Șterge Mesaj", ctx_profile: "Profil", ctx_call: "Începe Apel", ctx_id: "Copiază ID", ctx_remove: "Șterge Prieten", ctx_add: "Adaugă Prieten",
    ctx_edit: "Editează", ctx_reply: "Răspunde", chat_editing: "Editare...", chat_replying: "Răspuns către",
    call_incoming: "Apel de intrare...", call_ended: "Încheie Apel", call_duration: "Durată", room_idle: "DJ Inactiv", room_playing: "Acum Redă", room_search: "Caută pe YouTube..."
  }
};

// 🎵 DEFAULT SOUNDS (Immutable Fallback)
const SOUNDS = [
    { id: "vine", emoji: "💥", file: "/sounds/vine.mp3" },
    { id: "bruh", emoji: "🗿", file: "/sounds/bruh.mp3" },
    { id: "airhorn", emoji: "📣", file: "/sounds/airhorn.mp3" },
    { id: "cricket", emoji: "🦗", file: "/sounds/cricket.mp3" }
];

const TAGLINES = ["Tel Aviv group trip 2026 ?", "Debis", "Endorsed by the Netanyahu cousins", "Also try DABROWSER", "Noua aplicatie suvenirista", "No Basinosu allowed", "Nu stati singuri cu bibi pe VC", "E buna Purcela", "I AM OBEZ DELUXE 2026 ?", "500 pe seara", "Sure buddy", "Mor vecinii", "Aplicatie de jocuri dusmanoasa", "Aplicatie de jocuri patriotica", "Aplicatie de jocuri prietenoasa", "Sanatate curata ma", "Garju 8-bit", "Five Nights at Valeriu (rip)", "Micu Vesel group trip 20(si ceva) ?"];
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
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<number | null>(null);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

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
  
  const [unreadMap, setUnreadMap] = useState<Record<number, boolean>>({});

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
  const [serverEditForm, setServerEditForm] = useState({ 
    name: "", 
    imageUrl: "", 
    description: "", 
    bannerUrl: "", 
    isPrivate: false, 
    systemChannelId: "" 
  });
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newServerFile, setNewServerFile] = useState<File | null>(null);

  const [tagline, setTagline] = useState("Next Gen Communication");
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSoundboard, setShowSoundboard] = useState(false);

  const [showReportBug, setShowReportBug] = useState(false);
  const [bugDesc, setBugDesc] = useState("");
  const [bugFile, setBugFile] = useState<File | null>(null);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const [serverSettingsTab, setServerSettingsTab] = useState("overview"); 
  const ringtoneInputRef = useRef<HTMLInputElement>(null);

  // Role Management State
  const [serverRoles, setServerRoles] = useState<any[]>([]);
  const [activeRole, setActiveRole] = useState<any>(null);

  // 🎵 NEW: Soundboard State & Ref
  const [soundboard, setSoundboard] = useState(SOUNDS);
  const soundInputRef = useRef<HTMLInputElement>(null);

  const stickyRoleRef = useRef<any>(null);
  
  // 🎵 NEW: Track Previous Voice State (to detect changes)
  const prevVoiceStates = useRef<Record<string, number[]>>({});

  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { 
      if ((!textMsg || !textMsg.trim()) && !fileUrl) return;

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

  const t = (key: string) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;

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

          // 🎵 LOAD CUSTOM SOUNDS
          const savedSounds = localStorage.getItem("dachat_custom_sounds");
          if (savedSounds) {
              setSoundboard(prev => [...prev, ...JSON.parse(savedSounds)]);
          }
      } 
  }, []);

  const closeChangelog = () => { localStorage.setItem("dachat_version", APP_VERSION); setShowChangelog(false); };

useEffect(() => {
    ringtoneAudioRef.current = new Audio(selectedRingtone);
    ringtoneAudioRef.current.loop = true;
    ringtoneAudioRef.current.volume = 0.5;
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
    const handleGlobalContextMenu = (e: MouseEvent) => {
        e.preventDefault(); 
    };
    document.addEventListener("contextmenu", handleGlobalContextMenu);
    return () => document.removeEventListener("contextmenu", handleGlobalContextMenu);
}, []);

useEffect(() => {
    const handleClick = () => {
        setContextMenu({ ...contextMenu, visible: false });
        setActiveReactionMessageId(null); 
    };
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

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
    }
}, []);

const [notifSettings, setNotifSettings] = useState(user?.notification_settings || {
    desktop_notifications: true,
    streaming_notifications: true,
    voice_join_notifications: true,
    reaction_notifications: "all"
});

const saveNotifSettings = async (newSettings: any) => {
    setNotifSettings(newSettings);
    await fetch(`${BACKEND_URL}/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, notification_settings: newSettings })
    });
};

  useEffect(() => { 
      socket.connect(); 
      const handleConnect = () => { if (user) { socket.emit("setup", user.id); socket.emit("get_online_users"); socket.emit("get_voice_states");} };
      socket.on("connect", handleConnect);
      if (socket.connected && user) { socket.emit("setup", user.id); socket.emit("get_online_users"); socket.emit("get_voice_states");}
      
      socket.on("receive_message", (msg) => { 
          const normalized = { 
              ...msg, 
              sender_id: msg.sender_id || msg.senderId, 
              sender_name: msg.sender_name || msg.senderName, 
              file_url: msg.file_url || msg.fileUrl,
              channel_id: msg.channel_id || msg.channelId 
          }; 
          
          if (user && normalized.sender_id === user.id) return; 
          
          setChatHistory(prev => [...prev, normalized]); 

          if (!normalized.channel_id && normalized.sender_id && normalized.sender_id !== user.id) {
              setFriends(prev => {
                  const index = prev.findIndex(f => f.id === normalized.sender_id);
                  if (index === -1) return prev; 
                  if (index === 0) return prev; 
                  const newArr = [...prev];
                  const [movedFriend] = newArr.splice(index, 1);
                  newArr.unshift(movedFriend);
                  return newArr;
              });

              if (active.friend?.id !== normalized.sender_id) {
                  setUnreadMap(prev => ({ ...prev, [normalized.sender_id]: true }));
              }
          }
      });

      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      
      socket.on("reaction_updated", ({ messageId, userId, emoji, action }) => {
        setChatHistory(prev => prev.map(msg => {
            if (msg.id !== messageId) return msg;
            
            const currentReactions = msg.reactions || [];
            let newReactions;

            if (action === "add") {
                newReactions = [...currentReactions, { user_id: userId, emoji }];
            } else {
                newReactions = currentReactions.filter((r: any) => !(r.user_id === userId && r.emoji === emoji));
            }
            
            return { ...msg, reactions: newReactions };
        }));
      });

      socket.on("push_notification", (data) => {
        const isHidden = document.visibilityState === "hidden";
        const isNotFocused = !document.hasFocus();

        if (isHidden || isNotFocused) {
            const showToast = () => {
                new Notification(data.title, {
                    body: data.body,
                    icon: data.icon || "/logo.png"
                });
            };

            if (Notification.permission === "granted") {
                showToast();
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then((perm) => {
                    if (perm === "granted") showToast();
                });
            }
        }
      });

      socket.on("voice_states", (states) => { setVoiceStates(states); });

      socket.on("message_deleted", (messageId) => { setChatHistory(prev => prev.filter(msg => msg.id !== messageId)); });
      
      socket.on("message_updated", (updatedMsg) => {
          setChatHistory(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, content: updatedMsg.content, is_edited: true } : m));
      });

      // 🎵 UPDATED: Trigger Sound Listener (Handles Custom Sounds)
      socket.on("trigger_sound", ({ soundId }) => {
          // 1. Check Default Sounds
          let foundSound = SOUNDS.find(s => s.id === soundId);
          
          // 2. If not found, check Custom Sounds from LocalStorage
          if (!foundSound) {
              const custom = JSON.parse(localStorage.getItem("dachat_custom_sounds") || "[]");
              foundSound = custom.find((s:any) => s.id === soundId);
          }

          if (foundSound) {
              const audio = new Audio(foundSound.file);
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
      
      // Inside useEffect containing socket logic
socket.on("server_updated", async ({ serverId }) => { 
      if (!user) return;

      // 1. Refresh Server List
      const res = await fetch(`${BACKEND_URL}/my-servers/${user.id}`);
      const serversList = await res.json();
      setServers(serversList);

      // 2. If we are currently looking at this server
      if (active.server && String(active.server.id) === String(serverId)) {
          
          // Refresh Members (Immediate is fine)
          const memRes = await fetch(`${BACKEND_URL}/servers/${serverId}/members`);
          setServerMembers(await memRes.json());
          
          // ✅ CRITICAL FIX: Wait 500ms before fetching roles.
          // This gives the database time to finish saving the new role 
          // before we ask for the list.
          setTimeout(() => {
              fetchRoles(serverId);
          }, 500);
      }
  });

      socket.on("incoming_call", (data) => { if (user && data.senderId === user.id) return; setIncomingCall(data); });
      socket.on("call_rejected", () => { alert("Call declined by user"); leaveCall(); });
      
      return () => { 
          socket.off("receive_message"); 
          socket.off("load_messages"); 
          socket.off("voice_state_update"); 
          socket.off("user_updated"); 
          socket.off("new_friend_request"); 
          socket.off("incoming_call"); 
          socket.off("server_updated"); 
          socket.off("new_server_invite"); 
          socket.off("user_connected"); 
          socket.off("user_disconnected"); 
          socket.off("online_users"); 
          socket.off("request_accepted"); 
          socket.off("friend_removed"); 
          socket.off("message_deleted"); 
          socket.off("audio_state_update"); 
          socket.off("audio_state_clear"); 
          socket.off("call_rejected"); 
          socket.off("message_updated"); 
          socket.off("trigger_sound"); 
          socket.off("reaction_updated"); 
          socket.off("voice_states");
          socket.off("push_notification"); 
      }; 
  }, [user, viewingProfile, active.server, inCall, active.friend]);

  // 🎵 NEW EFFECT: Handle Join/Leave Sounds for OTHER users
  useEffect(() => {
      // If we aren't in a channel or logged in, just sync the state and return
      if (!activeVoiceChannelId || !user) {
          prevVoiceStates.current = voiceStates;
          return;
      }

      // Get lists of who is in the channel now vs. before
      const currentUsers = voiceStates[activeVoiceChannelId] || [];
      const prevUsers = prevVoiceStates.current[activeVoiceChannelId] || [];

      // 1. Detect who JOINED
      const joined = currentUsers.filter(id => !prevUsers.includes(id));
      joined.forEach(id => {
          // Play sound if it's SOMEONE ELSE (we play our own sound immediately on click)
          if (id !== user.id) { 
              // .cloneNode() allows overlapping sounds if multiple people join fast
              (joinSoundRef.current?.cloneNode() as HTMLAudioElement).play().catch(() => {});
          }
      });

      // 2. Detect who LEFT
      const left = prevUsers.filter(id => !currentUsers.includes(id));
      left.forEach(id => {
          if (id !== user.id) {
              (leaveSoundRef.current?.cloneNode() as HTMLAudioElement).play().catch(() => {});
          }
      });

      // Update the ref for the next compare
      prevVoiceStates.current = voiceStates;
  }, [voiceStates, activeVoiceChannelId, user]);

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
  
// ✅ FIX: Fetch with unique timestamp to bypass browser cache
const fetchRoles = async (serverId: number) => {
    try {
        const res = await fetch(`${BACKEND_URL}/servers/${serverId}/roles?_t=${Date.now()}`, { 
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
            // ✅ THE FIX: Merge the sticky role if the server forgot it
            if (stickyRoleRef.current && !data.find((r: any) => r.id === stickyRoleRef.current.id)) {
                console.log("⚠️ Server list was stale. Injecting sticky role locally.");
                data.push(stickyRoleRef.current);
            }
            setServerRoles(data);
        }
    } catch (e) {
        console.error("Failed to fetch roles", e);
    }
  };

const selectServer = async (server: any) => { 
      setView("servers"); 
      setActive((prev:any) => ({ ...prev, server, friend: null, pendingRequest: null })); 
      setIsCallExpanded(false); 
      
      // --- KEEP THIS CHANNEL LOADING CODE ---
      const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`); 
      const chData = await res.json(); 
      setChannels(chData); 
      if(!active.channel && chData.length > 0) { 
          const firstText = chData.find((c:any) => c.type === 'text'); 
          if (firstText) joinChannel(firstText); 
      } 
      // --------------------------------------

      // Fetch Members
      const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`); 
      setServerMembers(await memRes.json());
      
      // ✅ ADD THIS LINE AT THE END:
      fetchRoles(server.id);
  };

  const joinChannel = (channel: any) => { if (channel.type === 'voice') { if (inCall && activeVoiceChannelId === channel.id.toString()) setIsCallExpanded(true); else if (channel.id) joinVoiceRoom(channel.id.toString()); } else { setActive((prev: any) => ({ ...prev, channel, friend: null, pendingRequest: null })); setChatHistory([]); setIsCallExpanded(false); setShowMobileChat(true); if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() }); } };
  
  const selectFriend = (friend: any) => { 
      setActive((prev: any) => ({ ...prev, friend, channel: null, pendingRequest: null })); 
      setChatHistory([]); 
      setIsCallExpanded(false); 
      setShowMobileChat(true); 
      setUnreadMap(prev => ({ ...prev, [friend.id]: false })); 
      const ids = [user.id, friend.id].sort((a, b) => a - b); 
      socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` }); 
  };

  const selectRequest = (requestUser: any) => { setActive((prev: any) => ({ ...prev, pendingRequest: requestUser, friend: null, channel: null })); setIsCallExpanded(false); setShowMobileChat(true); };

  const sendFriendRequest = async () => { const usernameToAdd = prompt("Enter username to request:"); if (!usernameToAdd) return; await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); };
  const handleAddFriend = async (targetUser: any) => { const res = await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd: targetUser.username }) }); const data = await res.json(); alert(data.message); setContextMenu({ ...contextMenu, visible: false }); };
  const handleAcceptRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/accept-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchFriends(user.id); fetchRequests(user.id); selectFriend(active.pendingRequest); };
  const handleDeclineRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/decline-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchRequests(user.id); setActive({...active, pendingRequest: null}); };
  const handleRemoveFriend = async (targetId: number | null = null) => { const idToRemove = targetId || viewingProfile?.id; if (!idToRemove) return; if (!confirm("Are you sure you want to remove this friend?")) return; await fetch(`${BACKEND_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendId: idToRemove }) }); fetchFriends(user.id); if (viewingProfile?.id === idToRemove) setViewingProfile(null); if (active.friend?.id === idToRemove) setActive({ ...active, friend: null }); };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMessage(val);
      const match = val.match(/@(\w*)$/);
      if (match && active.server) {
          setShowMentions(true);
          setMentionQuery(match[1].toLowerCase());
      } else {
          setShowMentions(false);
      }
  };

  const insertMention = (username: string) => {
      const newVal = message.replace(/@(\w*)$/, `@${username} `);
      setMessage(newVal);
      setShowMentions(false);
      if(fileInputRef.current?.nextSibling) {
          (fileInputRef.current.nextSibling as HTMLElement).focus();
      }
  };

  const toggleReaction = (msg: any, emoji: string) => {
    const roomId = active.channel ? active.channel.id.toString() : `dm-${[user.id, active.friend.id].sort((a:any,b:any)=>a-b).join('-')}`;
    socket.emit("toggle_reaction", { 
        messageId: msg.id, 
        userId: user.id, 
        emoji, 
        roomId,
        messageOwnerId: msg.sender_id 
    });
    setActiveReactionMessageId(null); 
  };

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
  
  // 🎵 UPDATED: Ringtone Preview Logic
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewing(false);
  };

  const playPreview = (url: string) => {
    stopPreview();
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.onended = () => setIsPreviewing(false);
    previewAudioRef.current = audio;
    audio.play().catch(console.error);
    setIsPreviewing(true);
  };

  const handleRingtoneUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
        alert("Please upload an audio file (MP3, WAV, etc.)");
        return;
    }

    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData });
        const data = await res.json();

        if (data.success) {
            const newRingtoneUrl = data.fileUrl;
            setSelectedRingtone(newRingtoneUrl);
            localStorage.setItem("dachat_ringtone", newRingtoneUrl);
            
            // Auto-play the new ringtone for preview
            playPreview(newRingtoneUrl);
            
            alert("Custom ringtone set!");
        } else {
            alert("Upload failed: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        alert("Error uploading ringtone.");
        console.error(err);
    }
  };

  const resetRingtone = () => {
    const defaultTone = RINGTONES[0].url; 
    setSelectedRingtone(defaultTone);
    localStorage.setItem("dachat_ringtone", defaultTone);
    playPreview(defaultTone);
  };

  // 🎵 NEW: Soundboard Upload Logic
  const handleSoundUpload = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('audio/')) {
          alert("Please upload an audio file (MP3, WAV, etc.)");
          return;
      }

      // Ask for an emoji/name
      const name = prompt("Name this sound (or emoji):", "🔊");
      if (!name) return;

      try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData });
          const data = await res.json();

          if (data.success) {
              const newSound = { 
                  id: `custom_${Date.now()}`, 
                  emoji: name, 
                  file: data.fileUrl,
                  isCustom: true // Flag to allow deletion
              };

              // Update State
              setSoundboard(prev => {
                  const updated = [...prev, newSound];
                  // Save ONLY custom sounds to local storage
                  const customOnly = updated.filter((s:any) => s.isCustom);
                  localStorage.setItem("dachat_custom_sounds", JSON.stringify(customOnly));
                  return updated;
              });
              
              alert("Sound added to soundboard!");
          } else {
              alert("Upload failed.");
          }
      } catch (err) {
          console.error(err);
          alert("Error uploading sound.");
      }
  };

  // 🎵 NEW: Delete Custom Sound Logic
  const deleteCustomSound = (soundId: string) => {
      if(!confirm("Remove this custom sound?")) return;
      
      setSoundboard(prev => {
          const updated = prev.filter(s => s.id !== soundId);
          const customOnly = updated.filter((s:any) => s.isCustom);
          localStorage.setItem("dachat_custom_sounds", JSON.stringify(customOnly));
          return updated;
      });
  };

  // ⬇️ THESE WERE MISSING IN PREVIOUS VERSION
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
  const openServerSettings = () => { 
      setServerEditForm({ 
          name: active.server.name, 
          imageUrl: active.server.image_url || "", 
          description: active.server.description || "",
          bannerUrl: active.server.banner_url || "",
          isPrivate: active.server.is_private || false,
          systemChannelId: active.server.system_channel_id || (channels[0]?.id || null)
      }); 
      setServerSettingsTab("overview"); 
      setShowServerSettings(true); 
  };
  const saveServerSettings = async () => { 
      try {
          let finalImg = serverEditForm.imageUrl; 
          
          if (newServerFile) { 
              const formData = new FormData(); 
              formData.append("file", newServerFile); 
              const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); 
              const data = await res.json();
              if (!data.success) throw new Error("Image upload failed");
              finalImg = data.fileUrl; 
          } 
          
          const res = await fetch(`${BACKEND_URL}/servers/update`, { 
              method: "POST", 
              headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ 
                  serverId: active.server.id, 
                  userId: user.id, 
                  name: serverEditForm.name, 
                  imageUrl: finalImg,
                  description: (serverEditForm as any).description,
                  bannerUrl: (serverEditForm as any).bannerUrl,
                  isPrivate: (serverEditForm as any).isPrivate,
                  systemChannelId: (serverEditForm as any).systemChannelId
              }) 
          }); 
          
          const data = await res.json();
          if (data.success) {
              setShowServerSettings(false); 
              setNewServerFile(null);
          } else {
              alert("Failed to save: " + data.message);
          }
      } catch (err: any) {
          alert("Error: " + err.message);
      }
  };

const createRole = async () => {
      // Safety Check: Ensure we have a valid server ID
      if (!active.server || !active.server.id) {
          console.error("❌ Cannot create role: Active server ID is missing", active);
          alert("Error: Server ID missing. Please refresh the page.");
          return;
      }

      console.log("🚀 Creating role for Server ID:", active.server.id);

      try {
          const res = await fetch(`${BACKEND_URL}/servers/roles/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ serverId: active.server.id, userId: user.id })
          });
          const data = await res.json();
          
          if (data.success) {
              console.log("✅ Role created successfully:", data.role);
              
              // 1. Optimistic Update
              setServerRoles(prev => Array.isArray(prev) ? [...prev, data.role] : [data.role]);
              setActiveRole(data.role);

              // 2. Sticky Ref (Keep this from previous fix)
              stickyRoleRef.current = data.role;
              setTimeout(() => { stickyRoleRef.current = null; }, 5000);
          } else {
              alert("Server Error: " + data.message);
          }
      } catch (err) {
          console.error("Error creating role:", err);
      }
  };

  const updateRole = async () => {
      if (!activeRole) return;
      const res = await fetch(`${BACKEND_URL}/servers/roles/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId: active.server.id, userId: user.id, roleId: activeRole.id, updates: activeRole })
      });
      const data = await res.json();
      if (data.success) {
          setServerRoles(prev => prev.map(r => r.id === activeRole.id ? data.role : r));
          alert("Role Saved!");
      }
  };

  const deleteRole = async () => {
      if (!activeRole || !confirm("Delete this role?")) return;
      const res = await fetch(`${BACKEND_URL}/servers/roles/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId: active.server.id, userId: user.id, roleId: activeRole.id })
      });
      if ((await res.json()).success) {
          setServerRoles(prev => prev.filter(r => r.id !== activeRole.id));
          setActiveRole(null);
      }
  };

  const assignRole = async (targetUserId: number, roleId: number | null) => {
    if (!active.server) return;
    
    const res = await fetch(`${BACKEND_URL}/servers/roles/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            serverId: active.server.id, 
            ownerId: user.id, 
            targetUserId: targetUserId, 
            roleId: roleId 
        })
    });
    
    const data = await res.json();
    if (data.success) {
        alert("Role Updated");
        setContextMenu({ ...contextMenu, visible: false });
        // Manually refresh members to ensure colors update immediately
        const memRes = await fetch(`${BACKEND_URL}/servers/${active.server.id}/members`);
        setServerMembers(await memRes.json());
    } else {
        alert(data.message);
    }
  };
  
  const promoteMember = async (targetId: number) => { if(!confirm("Toggle Moderator Status?")) return; await fetch(`${BACKEND_URL}/servers/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, ownerId: user.id, targetUserId: targetId }) }); };
  const getRole = () => user ? serverMembers.find(m => m.id === user.id) : null;
  const getMyMember = () => user && active.server ? serverMembers.find(m => m.id === user.id) : null;
  
  const can = (permission: string) => {
      const member = getMyMember();
      if (!member) return false;
      
      // 1. Owner & Legacy Admin always have power
      if (active.server.owner_id === user.id || member.is_admin) return true;
      
      // 2. Check Role
      if (!member.role || !member.role.permissions) return false;
      
      // 3. Admin Role overrides all
      if (member.role.permissions.administrator) return true;
      
      // 4. Specific Permission
      return !!member.role.permissions[permission];
  };

  // Replaces "isMod" for simple checks
  const isMod = can('administrator');
  const isOwner = user && active.server?.owner_id === user.id;

  const startDMCall = (targetUser: any = active.friend) => { if (!targetUser) return; const ids = [user.id, targetUser.id].sort((a, b) => a - b); const roomId = `dm-call-${ids[0]}-${ids[1]}`; joinVoiceRoom(roomId); socket.emit("start_call", { senderId: user.id, recipientId: targetUser.id, senderName: user.username, avatarUrl: user.avatar_url, roomId: roomId }); };
  const answerCall = () => { if (incomingCall) { joinVoiceRoom(incomingCall.roomId); setIncomingCall(null); } };
  const rejectCall = () => { if (!incomingCall) return; socket.emit("reject_call", { callerId: incomingCall.senderId }); setIncomingCall(null); };

  const joinVoiceRoom = useCallback((roomId: string) => {
    if (!user) return;
    setActiveVoiceChannelId(roomId);
    setIsCallExpanded(true);
    setInCall(true);
    socket.emit("join_voice", { roomId, userData: user });
    
    // Play sound immediately for yourself
    if (joinSoundRef.current) { 
        (joinSoundRef.current.cloneNode() as HTMLAudioElement).play().catch(() => {}); 
    }
  }, [user]);

  const leaveCall = () => {
    // Play sound immediately for yourself
    if(leaveSoundRef.current) {
        (leaveSoundRef.current.cloneNode() as HTMLAudioElement).play().catch(()=>{});
    }
    
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
    <div className="flex h-screen w-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-blue-500/30 select-none">
      <style>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>

      <div className="absolute inset-0 bg-linear-to-br from-indigo-900/40 via-black to-black z-0"></div>
      
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} z-30 w-22.5 h-full flex-col items-center py-8 gap-4 fixed left-0 top-0 border-r border-white/5 bg-black/40 backdrop-blur-xl animate-in fade-in slide-in-from-left-4 duration-500`}>
        <div onClick={() => { setView("dms"); setActive({server:null}); setIsCallExpanded(false); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${view === 'dms' ? "bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "hover:bg-white/5"}`}>
          <DaChatLogo className="w-7 h-7" />
        </div>
        <div className="w-8 h-px bg-white/10" />
        <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar pt-2">
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

      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} relative z-10 h-screen bg-black/20 backdrop-blur-md border-r border-white/5 flex-col md:w-65 md:ml-22.5 w-[calc(100vw-90px)] ml-22.5 animate-in fade-in duration-500`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 font-bold tracking-wide">
            <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">{active.server ? active.server.name : t('dock_dm')}</span>
            {active.server && can('administrator') && <button onClick={openServerSettings} className="text-xs text-white/50 hover:text-white transition-colors duration-200 hover:rotate-90">⚙️</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {view === "servers" && active.server ? (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>{t('side_channels')}</span> {can('manage_channels') && <button onClick={createChannel} className="text-lg hover:text-white transition-transform hover:scale-110">+</button>} </div>
                    {channels.filter(c => c.type === 'text').map(ch => (
                        <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200 ${active.channel?.id === ch.id ? "bg-white/10 text-white scale-[1.02]" : "text-white/50 hover:bg-white/5 hover:text-white hover:translate-x-1"}`}>
                            <div className="flex items-center gap-2 truncate flex-1 min-w-0" onClick={() => joinChannel(ch)}> 
                                <span className="opacity-50 shrink-0">#</span> <span className="truncate">{ch.name}</span>
                            </div>
                            {can('manage_channels') && <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-xs text-red-400 shrink-0 hover:text-red-300 transition-colors">✕</button>}
                        </div>
                    ))}

                    <div className="mt-4 flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>VOICE CHANNELS</span> </div>
                    {channels.filter(c => c.type === 'voice').map(ch => {
                        const currentUsers = voiceStates[ch.id.toString()] || [];
                        const activeMembers = serverMembers.filter(m => currentUsers.includes(m.id));
                        return ( 
                            <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200 ${active.channel?.id === ch.id ? "bg-white/10 text-white scale-[1.02]" : "text-white/50 hover:bg-white/5 hover:text-white hover:translate-x-1"}`}>
                                <div className="flex items-center gap-2 truncate flex-1 min-w-0" onClick={() => joinChannel(ch)}> 
                                    <span className="opacity-50 shrink-0">🔊</span> 
                                    <span className="truncate">{ch.name}</span>
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
                                    <div className="flex justify-between items-center"> 
                                        <div className="text-xs font-bold truncate">{f.username}</div> 
                                        {/* UNREAD DOT */}
                                        {unreadMap[f.id] && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] animate-pulse ml-2"></div>
                                        )}
                                        {isPlaying && <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3 opacity-50" />} 
                                    </div>
                                    {isPlaying ? ( <div className="flex flex-col gap-1 mt-1"> <div className="text-[10px] text-green-400 font-bold truncate">{t('status_playing')} {steamInfo.gameextrainfo}</div> <a href={lobbyId ? `steam://joinlobby/${steamInfo.gameid}/${lobbyId}/${f.steam_id}` : `steam://run/${steamInfo.gameid}`} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[9px] font-bold px-2 py-1 rounded border border-green-600/30 text-center transition-colors block" onClick={(e) => e.stopPropagation()}> {lobbyId ? t('steam_join') : t('steam_launch')} </a> </div> ) : ( <div className={`text-[9px] transition-colors duration-300 ${isOnline ? "text-green-400/50" : "text-white/30"}`}> {isOnline ? t('status_on') : t('status_off')} </div> )}
                                </div> 
                            </div> 
                        );
                    })}
                </>
            )}
        </div>
      </div>

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
                        {chatHistory.map((msg, i) => {
                            const reactionCounts: Record<string, { count: number, hasReacted: boolean }> = {};
                            (msg.reactions || []).forEach((r: any) => {
                                if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, hasReacted: false };
                                reactionCounts[r.emoji].count++;
                                if (r.user_id === user.id) reactionCounts[r.emoji].hasReacted = true;
                            });

                            return (
                                <div key={msg.id || i} 
                                     className={`flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 group/msg relative ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`} 
                                     onContextMenu={(e) => handleContextMenu(e, 'message', msg)}
                                > 
                                    <UserAvatar onClick={()=>viewUserProfile(msg.sender_id)} src={msg.avatar_url} className="w-10 h-10 rounded-xl hover:scale-105 transition-transform" /> 
                                    
                                    <div className={`max-w-[85%] md:max-w-[70%] ${msg.sender_id===user.id?"items-end":"items-start"} flex flex-col relative`}> 
                                        
                                        <div className="flex items-center gap-2 mb-1"> 
                                            <span className="text-xs font-bold text-white/50">{msg.sender_name}</span> 
                                            {msg.is_edited && <span className="text-[9px] text-white/30">(edited)</span>}
                                        </div> 

                                        {msg.reply_to_id && (
                                            <div className="mb-1 text-[10px] text-white/40 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border-l-2 border-indigo-500">
                                                <span>⤴️ {t('chat_replying')}</span>
                                            </div>
                                        )}

                                        <div className={`relative px-4 py-2 rounded-2xl text-sm shadow-md cursor-pointer transition-all hover:scale-[1.01] select-text ${msg.sender_id===user.id?"bg-blue-600":"bg-white/10"}`}> 
                                            {formatMessage(msg.content)} 
                                            
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id); }}
                                                className={`absolute -top-3 ${msg.sender_id===user.id ? "-left-3" : "-right-3"} w-6 h-6 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover/msg:opacity-100 transition-opacity hover:scale-110 hover:bg-zinc-700 z-10`}
                                            >
                                                🙂
                                            </button>
                                            
                                            {activeReactionMessageId === msg.id && (
                                                <div className={`absolute z-50 top-6 ${msg.sender_id===user.id ? "right-0" : "left-0"}`}>
                                                     <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                                         <EmojiPicker 
                                                             theme={Theme.DARK} 
                                                             emojiStyle={EmojiStyle.NATIVE}
                                                             lazyLoadEmojis={true}
                                                             width={300}
                                                             height={350}
                                                             onEmojiClick={(e) => toggleReaction(msg, e.emoji)}
                                                         />
                                                     </div>
                                                </div>
                                            )}
                                        </div> 

                                        {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-62.5 rounded-xl border border-white/10 transition-transform hover:scale-105 cursor-pointer" alt="attachment" />} 
                                        
                                        {Object.keys(reactionCounts).length > 0 && (
                                            <div className={`flex flex-wrap gap-1 mt-1 ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                                                {Object.entries(reactionCounts).map(([emoji, data]) => (
                                                    <button 
                                                        key={emoji}
                                                        onClick={() => toggleReaction(msg, emoji)}
                                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs border transition-all hover:scale-105 ${data.hasReacted ? "bg-blue-500/20 border-blue-500/50 text-blue-200" : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"}`}
                                                    >
                                                        <span>{emoji}</span>
                                                        <span className="font-bold text-[10px]">{data.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div> 
                                </div> 
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

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
                        
                        {/* Mention List UI */}
                        {showMentions && (
                            <div className="absolute bottom-20 left-4 right-4 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-in slide-in-from-bottom-2 custom-scrollbar">
                                <div className="px-3 py-2 text-[10px] font-bold text-white/40 bg-white/5 border-b border-white/5 uppercase tracking-widest">
                                    Members matching "@ {mentionQuery}"
                                </div>
                                <div className="overflow-y-auto">
                                    {(active.server ? serverMembers : []).filter(m => m.username.toLowerCase().includes(mentionQuery)).map(m => (
                                        <div 
                                            key={m.id} 
                                            onClick={() => insertMention(m.username)}
                                            className="flex items-center gap-3 px-4 py-2 hover:bg-indigo-600/20 hover:text-indigo-200 cursor-pointer transition-colors"
                                        >
                                            <UserAvatar src={m.avatar_url} className="w-6 h-6 rounded-full" />
                                            <span className="text-sm font-bold">{m.username}</span>
                                        </div>
                                    ))}
                                    {(active.server ? serverMembers : []).filter(m => m.username.toLowerCase().includes(mentionQuery)).length === 0 && (
                                        <div className="p-4 text-center text-white/20 text-xs">No matching members found</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-white/5 border border-white/10 rounded-full p-2 flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-black/40"> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>fileInputRef.current?.click()}>📎</button> 
                            <button className="w-10 h-10 rounded-full hover:bg-white/10 text-[10px] font-bold text-white/50 transition-transform hover:scale-110 active:scale-90" onClick={()=>setShowGifPicker(!showGifPicker)}>GIF</button> 
                            <button className={`w-10 h-10 rounded-full hover:bg-white/10 text-xl transition-transform hover:scale-110 active:scale-90 ${showEmojiPicker ? "bg-white/10 text-white" : "text-white/50"}`} onClick={() => {setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false);}} onMouseEnter={() => setEmojiBtnIcon(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)])}>{emojiBtnIcon}</button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> 
                            <input 
                                className="flex-1 bg-transparent outline-none px-2 min-w-0" 
                                placeholder={t('chat_placeholder')} 
                                value={message} 
                                onChange={handleMessageChange} 
                                onKeyDown={e=>e.key==='Enter'&&sendMessage(message)} 
                            /> 
                        </div>
                    </div>
                 </>
             ) : <div className="flex-1 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest animate-pulse">{t('chat_select')}</div>}
         </div>

         {inCall && (
             <div className={`${isCallExpanded ? "absolute inset-0 z-50 bg-[#000000] animate-in zoom-in-95 duration-300" : "hidden"} flex flex-col`}>
                 <div className="absolute top-4 left-4 right-4 z-[60] flex justify-between items-start pointer-events-none">
                     <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs font-bold text-white/80">Voice Connected</span>
                            <span className="text-white/20 mx-1">|</span>
                            <span className="text-xs text-white/50">{active.channel ? active.channel.name : "Direct Call"}</span>
                        </div>
                     </div>

                     <div className="flex gap-2 pointer-events-auto">
                         <button onClick={() => setShowSoundboard(!showSoundboard)} className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-full text-xs font-bold backdrop-blur-md transition-all shadow-lg flex items-center gap-2"> 
                            <span>🎭</span> Sounds
                         </button>
                         <button onClick={() => setIsCallExpanded(false)} className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full text-xs font-bold backdrop-blur-md transition-all shadow-lg flex items-center gap-2"> 
                            <span></span> Minimize 
                         </button>
                     </div>
                 </div>

                 {/* 🎵 UPDATED: Soundboard UI with Upload & Delete */}
                 {showSoundboard && (
                    <div className="absolute top-16 right-4 z-[70] bg-[#1e1f22] border border-white/5 rounded-2xl p-4 w-72 animate-in zoom-in-95 shadow-2xl max-h-[60vh] flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Soundboard</span>
                            <button onClick={() => setShowSoundboard(false)} className="text-white/50 hover:text-white">✕</button>
                        </div>
                        
                        {/* Hidden Input for Upload */}
                        <input 
                            type="file" 
                            ref={soundInputRef} 
                            className="hidden" 
                            accept="audio/*" 
                            onChange={handleSoundUpload} 
                        />

                        <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar pr-1">
                            {/* Render All Sounds */}
                            {soundboard.map(s => (
                                <button 
                                    key={s.id} 
                                    onClick={() => playSoundEffect(s.id)}
                                    onContextMenu={(e) => {
                                        // Right-click to delete custom sounds
                                        if((s as any).isCustom) {
                                            e.preventDefault();
                                            deleteCustomSound(s.id);
                                        }
                                    }} 
                                    className="aspect-square bg-black/40 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 border border-white/5 hover:border-indigo-500/50 group relative"
                                    title={s.emoji + ((s as any).isCustom ? " (Right-click to delete)" : "")}
                                >
                                    <span className="text-2xl">{s.emoji.substring(0, 2)}</span>
                                    {(s as any).isCustom && <span className="text-[8px] text-white/30 absolute bottom-1">★</span>}
                                </button>
                            ))}

                            {/* Add New Button */}
                            <button 
                                onClick={() => soundInputRef.current?.click()}
                                className="aspect-square bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-200 rounded-xl flex items-center justify-center text-2xl transition-all active:scale-90 border border-indigo-500/30 border-dashed"
                                title="Add Custom Sound"
                            >
                                +
                            </button>
                        </div>
                    </div>
                 )}

                 <div className="flex-1 w-full h-full relative z-10">
                    <LiveKitVoiceRoom 
                       room={activeVoiceChannelId} 
                       user={user} 
                       onLeave={() => {
                           setInCall(false);
                           setActiveVoiceChannelId(null);
                           setIsCallExpanded(false);
                           socket.emit("leave_voice");
                       }} 
                    >
                        <RoomPlayer track={currentTrack} onSearch={playMusic} t={t} />
                    </LiveKitVoiceRoom>
                 </div>
             </div>
         )}
      </div>

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
              <div className="space-y-1 overflow-y-auto h-full pb-20 custom-scrollbar">
{/* Find the Member List mapping section in your JSX */}
{serverMembers.map(m => ( 
    <div 
        key={m.id} 
        onContextMenu={(e) => handleContextMenu(e, 'user', m)} 
        onClick={() => viewUserProfile(m.id)} 
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-all duration-200 hover:translate-x-1"
    > 
        <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-full transition-transform group-hover:scale-110" /> 
        <div className="flex-1 min-w-0"> 
            {/* COLOR LOGIC APPLIED HERE */}
            <div 
                className="text-sm font-bold truncate transition-colors duration-300"
                style={{ 
                    color: m.role ? m.role.color : (m.is_admin ? "#eab308" : "rgba(255,255,255,0.7)") 
                }}
            >
                {m.username}
            </div> 
            {/* Show Role Name if exists */}
            {m.role && <div className="text-[10px] opacity-50 font-bold" style={{ color: m.role.color }}>{m.role.name}</div>}
        </div> 
        {m.id === active.server.owner_id && <span title="Owner">👑</span>} 
    </div> 
))}
              </div>
          </div>
      )}

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
              <GlassPanel className="w-full max-w-3xl p-8 flex flex-col gap-6 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                  {showSettingsGifPicker && ( <div className="absolute inset-0 z-60 bg-[#050505] flex flex-col rounded-4xl overflow-hidden animate-in fade-in duration-200"> <GifPicker className="w-full h-full bg-transparent shadow-none border-none flex flex-col" onClose={() => setShowSettingsGifPicker(false)} onSelect={(url: string) => { setEditForm({ ...editForm, avatarUrl: url }); setNewAvatarFile(null); setShowSettingsGifPicker(false);}}/> </div> )}
                  <h2 className="text-2xl font-bold mb-2">{t('set_header')}</h2>
                  
                  <div> 
                    <h3 className="text-xs font-bold text-white/40 uppercase mb-4 tracking-wider">User Profile</h3> 
                    <div className="flex flex-col md:flex-row gap-6 items-start"> 
                      <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0"> 
                        <UserAvatar src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} className="w-24 h-24 rounded-full border-4 border-white/5 hover:border-white/20 transition-all hover:scale-105 cursor-pointer" onClick={()=>(document.getElementById('pUpload') as any).click()} /> 
                        <div className="flex flex-col gap-2 w-full">
                          <button onClick={() => setShowReportBug(true)} className="text-xs w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 mt-4">
                            Report a Bug
                          </button> 
                          <button onClick={()=>(document.getElementById('pUpload') as any).click()} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors w-full text-center">{t('set_upload')}</button> 
                          <button onClick={() => setShowSettingsGifPicker(true)} className="text-xs bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-3 py-2 rounded-lg transition-all font-bold shadow-lg w-full text-center">{t('set_gif')}</button> 
                          <button onClick={saveSteamId} className="text-xs bg-[#171a21] text-[#c7d5e0] hover:bg-[#2a475e] px-3 py-2 rounded-lg transition-all font-bold shadow-lg flex items-center justify-center gap-2 w-full"><img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" className="w-3 h-3" />{user.steam_id ? "Linked" : "Link Steam"}</button> 
                        </div> 
                        <input id="pUpload" type="file" className="hidden" onChange={e=>e.target.files && setNewAvatarFile(e.target.files[0])} /> 
                      </div> 
                      <div className="flex-1 w-full flex flex-col gap-4"> 
                        <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Username</label> <input className="w-full bg-white/5 p-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all border border-white/5 focus:bg-black/20" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})} /> </div> 
                        <div className="space-y-1"> <label className="text-xs text-white/50 ml-1 font-bold uppercase">Bio</label> <textarea className="w-full bg-white/5 p-3 rounded-xl text-white h-24 resize-none focus:ring-2 focus:ring-blue-500/50 outline-none transition-all border border-white/5 focus:bg-black/20" value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} /> </div> 
                      </div> 
                    </div> 
                  </div>

                  <div className="h-px bg-white/10 w-full" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-8"> 
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">App Preferences</h3> 
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4"> 
                                <div className="space-y-1"> 
                                    <label className="text-xs text-indigo-400 font-bold ml-1">{t('set_lang')}</label> 
                                    <select className="w-full bg-black/40 p-2 rounded-lg text-sm text-white border border-white/10 focus:border-indigo-500/50 outline-none appearance-none" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem("dachat_lang", e.target.value); }} > 
                                        <option value="en">English (Default)</option> 
                                        <option value="ro">Română (Romanian)</option> 
                                        <option value="de">Deutsch (German)</option> 
                                        <option value="pl">Polski (Polish)</option> 
                                        <option value="it">Italiano (Italian)</option> 
                                        <option value="es">Español (Spanish)</option> 
                                        <option value="pt">Português (Portuguese)</option> 
                                        <option value="sv">Svenska (Swedish)</option> 
                                        <option value="bg">Български (Bulgarian)</option> 
                                        <option value="jp">日本語 (Japanese)</option> 
                                        <option value="zh">中文 (Chinese)</option> 
                                    </select> 
                                </div> 
                                
                                {/* 🎵 UPDATED RINGTONE UI */}
                                <div className="space-y-2"> 
                                    <label className="text-xs text-indigo-400 font-bold ml-1">{t('set_ringtone')}</label> 
                                    
                                    <div className="flex flex-col gap-2">
                                        {/* Hidden File Input */}
                                        <input 
                                            type="file" 
                                            ref={ringtoneInputRef} 
                                            className="hidden" 
                                            accept="audio/*" 
                                            onChange={handleRingtoneUpload} 
                                        />

                                        {/* Current Ringtone Display */}
                                        <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/10">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                    🎵
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-bold truncate text-white">
                                                        {RINGTONES.find(r => r.url === selectedRingtone)?.name || "Custom Audio File"}
                                                    </span>
                                                    <span className="text-[10px] text-white/40 truncate">
                                                        {RINGTONES.some(r => r.url === selectedRingtone) ? "System Default" : "Uploaded by you"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Play/Preview Button (Small) */}
                                            <button 
                                                onClick={() => isPreviewing ? stopPreview() : playPreview(selectedRingtone)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                                                    isPreviewing 
                                                    ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110" 
                                                    : "hover:bg-white/10 text-white/60 hover:text-white"
                                                }`}
                                                title={isPreviewing ? "Stop Preview" : "Play Preview"}
                                            >
                                                {isPreviewing ? "■" : "▶"}
                                            </button>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 mt-1">
                                            <button 
                                                onClick={() => ringtoneInputRef.current?.click()} 
                                                className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-bold rounded-lg border border-indigo-500/30 transition-all active:scale-95"
                                            >
                                                Upload New
                                            </button>
                                            
                                            {selectedRingtone !== RINGTONES[0].url && (
                                                <button 
                                                    onClick={resetRingtone} 
                                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-all active:scale-95"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Notification Settings</h3>
                              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-6">
                                  <div className="flex justify-between items-center">
                                      <div className="flex flex-col">
                                          <span className="text-sm font-bold">Enable Desktop Notifications</span>
                                          <span className="text-[10px] text-white/40 max-w-[250px]">Get system alerts for new messages even when the app is in the background.</span>
                                      </div>
                                      <button 
                                          onClick={() => {
                                              if ("Notification" in window && Notification.permission !== "granted") {
                                                  Notification.requestPermission();
                                              }
                                              saveNotifSettings({...notifSettings, desktop_notifications: !notifSettings.desktop_notifications})
                                          }}
                                          className={`w-12 h-6 rounded-full transition-colors relative ${notifSettings.desktop_notifications ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                      >
                                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSettings.desktop_notifications ? 'right-1' : 'left-1'}`} />
                                      </button>
                                  </div>

                                  <div className="flex justify-between items-center">
                                      <span className="text-sm">People I know start streaming</span>
                                      <button 
                                          onClick={() => saveNotifSettings({...notifSettings, streaming_notifications: !notifSettings.streaming_notifications})}
                                          className={`w-12 h-6 rounded-full transition-colors relative ${notifSettings.streaming_notifications ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                      >
                                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSettings.streaming_notifications ? 'right-1' : 'left-1'}`} />
                                      </button>
                                  </div>

                                  <div className="space-y-2">
                                      <label className="text-sm">Someone reacts to my messages</label>
                                      <select 
                                          className="w-full bg-black/40 p-2 rounded-lg text-sm border border-white/10 text-white outline-none"
                                          value={notifSettings.reaction_notifications}
                                          onChange={(e) => saveNotifSettings({...notifSettings, reaction_notifications: e.target.value})}
                                      >
                                          <option value="all">All Messages</option>
                                          <option value="mentions">Only Mentions</option>
                                          <option value="none">Nothing</option>
                                      </select>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4"> 
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Security</h3> 
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4"> 
                            <div className="flex justify-between items-center"> 
                                <span className="font-bold text-sm">{t('set_2fa')}</span> 
                                <span className={`text-[10px] px-2 py-1 rounded border ${user.is_2fa_enabled ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}`}> {user.is_2fa_enabled ? "ENABLED" : "DISABLED"} </span> 
                            </div> 
                            {!user.is_2fa_enabled && setupStep === 0 && <button onClick={start2FASetup} className="w-full py-2 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-600/30 transition-colors">{t('set_setup_2fa')}</button>} 
                            {setupStep === 1 && ( 
                                <div className="flex flex-col items-center gap-3 animate-in fade-in"> 
                                    <img src={qrCodeUrl} className="w-24 h-24 rounded-lg border-2 border-white" /> 
                                    <input className="w-full bg-black/40 p-2 text-center rounded font-mono text-sm" placeholder="123456" maxLength={6} onChange={(e) => setTwoFACode(e.target.value)}/> 
                                    <button onClick={verify2FASetup} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded">{t('set_verify')}</button> 
                                </div> 
                            )} 
                            {user.is_2fa_enabled && ( 
                                <div className="pt-2 border-t border-white/10"> 
                                    <div className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => setShowPassChange(!showPassChange)}> 
                                        <span className="font-bold text-sm text-yellow-500">{t('set_pass_change')}</span> 
                                        <span className="text-white/50 text-xs">{showPassChange ? "▼" : "▶"}</span> 
                                    </div> 
                                    {showPassChange && ( 
                                        <div className="flex flex-col gap-3 animate-in fade-in pt-3"> 
                                            <div className="relative"> 
                                                <input type={showNewPassword ? "text" : "password"} className="w-full bg-black/40 p-2 rounded text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none pr-10" placeholder={t('set_new_pass')} value={passChangeForm.newPassword} onChange={(e) => setPassChangeForm({...passChangeForm, newPassword: e.target.value})} /> 
                                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xs">{showNewPassword ? "🙈" : "👁️"}</button> 
                                            </div> 
                                            <input className="w-full bg-black/40 p-2 text-center rounded font-mono text-sm text-white placeholder-white/30 border border-white/5 focus:border-yellow-500/50 outline-none" placeholder="Auth Code" maxLength={6} value={passChangeForm.code} onChange={(e) => setPassChangeForm({...passChangeForm, code: e.target.value})}/> 
                                            <button onClick={handleChangePassword} className="w-full py-2 bg-yellow-600/20 text-yellow-500 text-xs font-bold rounded hover:bg-yellow-600/30 transition-colors">{t('set_confirm')}</button> 
                                        </div> 
                                    )} 
                                </div> 
                            )} 
                        </div> 
                      </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2"> 
                      <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-xs font-bold transition-colors px-2">{t('set_logout')}</button> 
                      <div className="flex gap-3"> 
                        <button onClick={()=>setShowSettings(false)} className="text-white/50 px-4 py-2 hover:text-white transition-colors text-sm">{t('btn_cancel')}</button> 
                        <button onClick={saveProfile} className="bg-white text-black px-8 py-2 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg shadow-white/10 text-sm">{t('btn_save')}</button> 
                      </div> 
                  </div>
              </GlassPanel>
          </div>
      )}

      {/* ✅ SERVER SETTINGS MODAL (Updated to match Glass Theme) */}
      {showServerSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <GlassPanel className="w-full max-w-5xl h-[85vh] flex overflow-hidden relative p-0 rounded-3xl animate-in zoom-in-95 shadow-2xl">
                  {/* Glass Sidebar */}
                  <div className="w-64 bg-black/20 flex flex-col pt-12 pb-4 px-3 border-r border-white/5 backdrop-blur-md">
                      <div className="w-full px-3 mb-4 text-xs font-bold text-white/50 uppercase truncate text-right tracking-widest">
                          {active.server.name}
                      </div>
                      <div className="w-full space-y-1">
                          {['Overview', 'Roles', 'Moderation'].map((tab) => (
                              <button
                                  key={tab}
                                  onClick={() => setServerSettingsTab(tab.toLowerCase())}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${serverSettingsTab === tab.toLowerCase() ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
                              >
                                  {tab}
                              </button>
                          ))}
                          <div className="my-4 h-px bg-white/10 w-[90%] mx-auto" />
                          <button onClick={() => { setShowServerSettings(false); leaveServer(); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 flex justify-between group transition-all">
                              Delete Server <span className="opacity-0 group-hover:opacity-100 transition-opacity">🗑️</span>
                          </button>
                      </div>
                  </div>

                  {/* Glass Content Area */}
                  <div className="flex-1 flex flex-col bg-transparent relative min-w-0">
                      <div className="absolute top-6 right-8 flex flex-col items-center gap-1 cursor-pointer group z-20" onClick={() => setShowServerSettings(false)}>
                          <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/50 font-bold group-hover:bg-white/10 group-hover:text-white transition-all shadow-lg backdrop-blur-md">✕</div>
                          <span className="text-[9px] text-white/30 font-bold uppercase group-hover:text-white/60 tracking-wider">ESC</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                          <h2 className="text-3xl font-bold text-white mb-8 capitalize tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-white/60 w-fit">{serverSettingsTab}</h2>
                          
                          {serverSettingsTab === 'overview' && (
                              <div className="space-y-8 max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                                  <div className="flex gap-8 items-start">
                                      <div className="flex flex-col gap-3 items-center">
                                          <div className="relative group cursor-pointer" onClick={() => (document.getElementById('sUpload') as any).click()}>
                                              <UserAvatar src={newServerFile ? URL.createObjectURL(newServerFile) : serverEditForm.imageUrl} className="w-32 h-32 rounded-full border-4 border-white/5 shadow-2xl group-hover:scale-105 transition-transform" />
                                              <div className="absolute top-0 right-0 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">EDIT</div>
                                              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold uppercase backdrop-blur-sm transition-all">Change</div>
                                          </div>
                                          <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Icon</span>
                                          <input id="sUpload" type="file" className="hidden" onChange={e => e.target.files && setNewServerFile(e.target.files[0])} />
                                      </div>
                                      <div className="flex-1 space-y-6">
                                          <div className="space-y-2">
                                              <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider ml-1">Server Name</label>
                                              <input className="w-full bg-black/40 text-white p-4 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 transition-all font-bold text-lg placeholder-white/20" value={serverEditForm.name} onChange={e => setServerEditForm({ ...serverEditForm, name: e.target.value })} />
                                          </div>
                                          <div className="space-y-2">
                                              <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Description</label>
                                              <textarea className="w-full bg-black/40 text-white p-4 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 transition-all h-24 resize-none text-sm placeholder-white/20" placeholder="What is this server about?" value={(serverEditForm as any).description} onChange={e => setServerEditForm({ ...serverEditForm, description: e.target.value } as any)}/>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="h-px bg-linear-to-r from-white/10 to-transparent w-full" />
                                  
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">System Messages Channel</label>
                                      <select className="w-full bg-black/40 text-white p-4 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 appearance-none cursor-pointer" value={(serverEditForm as any).systemChannelId || ""} onChange={e => setServerEditForm({ ...serverEditForm, systemChannelId: e.target.value } as any)}>
                                          {channels.filter(c => c.type === 'text').map(c => (
                                              <option key={c.id} value={c.id}># {c.name}</option>
                                          ))}
                                      </select>
                                      <span className="text-[10px] text-white/30 px-1">We'll send welcome messages here.</span>
                                  </div>

                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Server Banner Image (URL)</label>
                                      <input className="w-full bg-black/40 text-white p-4 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 transition-all font-mono text-xs text-blue-300" placeholder="https://..." value={(serverEditForm as any).bannerUrl} onChange={e => setServerEditForm({ ...serverEditForm, bannerUrl: e.target.value } as any)} />
                                      {(serverEditForm as any).bannerUrl && (
                                          <div className="mt-4 h-40 w-full rounded-2xl bg-cover bg-center border border-white/10 shadow-2xl" style={{ backgroundImage: `url(${(serverEditForm as any).bannerUrl})` }} />
                                      )}
                                  </div>
                              </div>
                          )}

                          {serverSettingsTab === 'roles' && (
                              <div className="flex h-full gap-8 animate-in slide-in-from-right-4 duration-500">
                                  <div className="w-60 shrink-0 flex flex-col gap-3">
                                      <div className="text-xs font-bold text-white/40 uppercase mb-1 tracking-wider">Roles List</div>
                                      <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                          {serverRoles.map((role) => (
                                              <div key={role.id} onClick={() => setActiveRole(role)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${activeRole?.id === role.id ? "bg-white/10 border-white/10 shadow-lg scale-[1.02]" : "bg-black/20 border-transparent text-white/50 hover:bg-white/5 hover:text-white"}`}>
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: role.color }} />
                                                      <span className="text-sm font-bold truncate max-w-[120px]">{role.name}</span>
                                                  </div>
                                                  <span className="text-xs opacity-50">›</span>
                                              </div>
                                          ))}
                                      </div>
                                      <button onClick={createRole} className="w-full py-3 bg-black/40 hover:bg-white/5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 shadow-lg">
                                          <span>+</span> Create Role
                                      </button>
                                  </div>

                                  {activeRole ? (
                                      <div className="flex-1 space-y-8 bg-black/20 rounded-3xl p-6 border border-white/5">
                                          <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                                  <span className="w-4 h-4 rounded-full" style={{backgroundColor: activeRole.color}}></span>
                                                  {activeRole.name}
                                              </h3>
                                              <button onClick={deleteRole} className="text-red-400 text-xs font-bold px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors">Delete Role</button>
                                          </div>
                                          <div className="space-y-6">
                                              <div className="grid grid-cols-2 gap-4">
                                                  <div className="space-y-2">
                                                      <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Role Name</label>
                                                      <input className="w-full bg-black/40 text-white p-3 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 transition-all font-bold" value={activeRole.name} onChange={(e) => setActiveRole({ ...activeRole, name: e.target.value })}/>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Role Color</label>
                                                      <div className="flex gap-2">
                                                          <div className="relative w-12 h-full rounded-xl overflow-hidden border border-white/10 shadow-inner">
                                                              <input type="color" className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer" value={activeRole.color} onChange={(e) => setActiveRole({ ...activeRole, color: e.target.value })}/>
                                                          </div>
                                                          <input className="flex-1 bg-black/40 text-white p-3 rounded-xl outline-none border border-white/5 focus:border-indigo-500/50 transition-all font-mono text-xs uppercase" value={activeRole.color} onChange={(e) => setActiveRole({ ...activeRole, color: e.target.value })}/>
                                                      </div>
                                                  </div>
                                              </div>

                                              <div className="space-y-4">
                                                  <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider ml-1">Permissions</label>
                                                  <div className="space-y-3">
                                                      {[{ key: 'administrator', label: 'Administrator', desc: 'Grants all permissions. Dangerous!' }, { key: 'manage_channels', label: 'Manage Channels', desc: 'Create, edit, and delete channels.' }, { key: 'kick_members', label: 'Kick Members', desc: 'Remove members from the server.' }, { key: 'ban_members', label: 'Ban Members', desc: 'Permanently ban members.' }].map((perm) => (
                                                          <div key={perm.key} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                                              <div>
                                                                  <div className={`text-sm font-bold ${perm.key === 'administrator' ? 'text-red-300' : 'text-white'}`}>{perm.label}</div>
                                                                  <div className="text-[10px] text-white/40 mt-1">{perm.desc}</div>
                                                              </div>
                                                              <div onClick={() => setActiveRole({ ...activeRole, permissions: { ...activeRole.permissions, [perm.key]: !activeRole.permissions?.[perm.key] } })} className={`w-12 h-6 rounded-full cursor-pointer relative transition-all shadow-inner ${activeRole.permissions?.[perm.key] ? 'bg-green-500 shadow-green-900/50' : 'bg-black/50 border border-white/10'}`}>
                                                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${activeRole.permissions?.[perm.key] ? 'right-1' : 'left-1'}`} />
                                                              </div>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="pt-4 flex justify-end">
                                              <button onClick={updateRole} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.3)] transition-transform active:scale-95">Save Role Changes</button>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="flex-1 flex flex-col items-center justify-center text-white/20 border border-white/5 rounded-3xl bg-black/20">
                                          <span className="text-5xl mb-4 grayscale opacity-50">🎭</span>
                                          <span className="text-sm font-bold uppercase tracking-widest">Select a Role to Edit</span>
                                      </div>
                                  )}
                              </div>
                          )}

                          {serverSettingsTab === 'moderation' && (
                              <div className="space-y-6 max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                                  <div className="flex items-center justify-between p-6 bg-black/40 rounded-2xl border border-white/5 shadow-lg">
                                      <div>
                                          <div className="text-white font-bold text-lg mb-1">Private Server</div>
                                          <div className="text-white/50 text-xs">Only allow users with an invite link to join this server.</div>
                                      </div>
                                      <div onClick={() => setServerEditForm({ ...serverEditForm, isPrivate: !(serverEditForm as any).isPrivate } as any)} className={`w-14 h-8 rounded-full cursor-pointer relative transition-all shadow-inner ${(serverEditForm as any).isPrivate ? 'bg-green-500 shadow-green-900/50' : 'bg-black/50 border border-white/10'}`}>
                                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${(serverEditForm as any).isPrivate ? 'right-1' : 'left-1'}`} />
                                      </div>
                                  </div>
                                  
                                  <div className="space-y-4">
                                      <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Verification Level</label>
                                      <div className="flex flex-col gap-3">
                                          {['None', 'Low (Verified Email)', 'High (10 min member)'].map((level, i) => (
                                              <div key={i} className="flex items-center gap-4 p-4 bg-black/40 rounded-xl cursor-pointer hover:bg-white/5 border border-white/5 transition-all group">
                                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${i === 0 ? 'border-green-500 bg-green-500/20' : 'border-white/20 group-hover:border-white/50'}`}>
                                                      {i === 0 && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />}
                                                  </div>
                                                  <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">{level}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Glass Footer Actions */}
                      <div className="p-6 bg-black/20 backdrop-blur-xl border-t border-white/5 flex justify-end gap-4 animate-in slide-in-from-bottom-2 z-10">
                          <button onClick={() => setShowServerSettings(false)} className="px-6 py-2 text-sm text-white/50 hover:text-white font-bold transition-colors">Cancel</button>
                          <button onClick={saveServerSettings} className="px-8 py-2 bg-white text-black text-sm font-bold rounded-xl transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">Save Changes</button>
                      </div>
                  </div>
              </GlassPanel>
          </div>
      )}

      {contextMenu.visible && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 flex flex-col w-48 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 animate-in zoom-in-95 duration-150 origin-top-left overflow-hidden" onClick={(e) => e.stopPropagation()} >
              {contextMenu.type === 'message' && ( <> <button onClick={() => copyText(contextMenu.data?.content || "")} className="text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>📋</span> {t('ctx_copy')} </button> {contextMenu.data?.sender_id === user.id && ( <button onClick={() => { deleteMessage(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>🗑️</span> {t('ctx_delete')} </button> )} </> )}
              {contextMenu.type === 'user' && ( 
                  <> 
                    <button onClick={() => { viewUserProfile(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>👤</span> {t('ctx_profile')} </button> 
                    <button onClick={() => { startDMCall(contextMenu.data); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>📞</span> {t('ctx_call')} </button> 
                    <div className="h-px bg-white/10 my-1 mx-2"></div> 
                    <button onClick={() => { navigator.clipboard.writeText(contextMenu.data.id.toString()); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"> <span>🆔</span> {t('ctx_id')} </button> 
                    
                    {/* ✅ UPDATED CONTEXT MENU: Role Assignment */}
                    {active.server && isMod && (
                        <>
                            <div className="h-px bg-white/10 my-1 mx-2"></div>
                            <div className="px-3 py-1 text-[10px] font-bold text-white/30 uppercase">Assign Role</div>
                            
                            {/* Option to remove role */}
                            <button onClick={() => assignRole(contextMenu.data.id, null)} className="text-left px-3 py-2 text-xs text-white/50 hover:bg-white/10 rounded-lg w-full">
                                No Role
                            </button>

                            {/* List available roles */}
                            {serverRoles.map(role => (
                                <button 
                                    key={role.id} 
                                    onClick={() => assignRole(contextMenu.data.id, role.id)} 
                                    className="text-left px-3 py-2 text-xs hover:bg-white/10 rounded-lg w-full flex items-center gap-2"
                                    style={{ color: role.color }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }}></div>
                                    {role.name}
                                </button>
                            ))}
                        </>
                    )}

                    {/* ✅ KICK BUTTON */}
{active.server && can('kick_members') && contextMenu.data.id !== user.id && (
    <button onClick={async () => {
        if(!confirm(`Kick ${contextMenu.data.username}?`)) return;
        await fetch(`${BACKEND_URL}/servers/kick`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ serverId: active.server.id, userId: user.id, targetId: contextMenu.data.id })
        });
        setContextMenu({ ...contextMenu, visible: false });
    }} className="text-left px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors flex items-center gap-2">
        <span>🥾</span> Kick Member
    </button>
)}

{/* ✅ BAN BUTTON */}
{active.server && can('ban_members') && contextMenu.data.id !== user.id && (
    <button onClick={async () => {
        if(!confirm(`Ban ${contextMenu.data.username}?`)) return;
        await fetch(`${BACKEND_URL}/servers/ban`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ serverId: active.server.id, userId: user.id, targetId: contextMenu.data.id })
        });
        setContextMenu({ ...contextMenu, visible: false });
    }} className="text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2">
        <span>🔨</span> Ban Member
    </button>
)}

                    <div className="h-px bg-white/10 my-1 mx-2"></div> 
                    <button onClick={() => { handleRemoveFriend(contextMenu.data.id); setContextMenu({ ...contextMenu, visible: false }); }} className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"> <span>🚫</span> {t('ctx_remove')} </button> 
                  </> 
              )}
          </div>
      )}
    </div>
  );
}

const RoomPlayer = memo(({ track, onSearch, t }: any) => {
    const [search, setSearch] = useState("");
    const [showQueue, setShowQueue] = useState(false);
    const [localVolume, setLocalVolume] = useState(50);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null); 

    const handleControl = (action: string) => { onSearch({ action }); };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    useEffect(() => {
       if(!track?.current || track.isPaused) return;
       const interval = setInterval(() => {
           const now = Date.now();
           const startTime = track.startTime || now;
           const actualElapsed = (now - startTime) + (track.elapsed || 0);
           setProgress(actualElapsed / 1000); 
       }, 1000);
       return () => clearInterval(interval);
    }, [track]);

    useEffect(() => {
        if(track?.isPaused) {
            setProgress((track.elapsed || 0) / 1000);
        }
    }, [track?.isPaused, track?.elapsed]);

    useEffect(() => {
        if(iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'setVolume',
                args: [localVolume]
            }), '*');
        }
    }, [localVolume, track]);

    const iframeSrc = useMemo(() => {
        if (!track?.current || track.isPaused) return "";
        const totalElapsedMs = track.elapsed + (track.startTime ? (Date.now() - track.startTime) : 0);
        const startSeconds = Math.floor(totalElapsedMs / 1000);
        return `https://www.youtube.com/embed/${track.current.videoId}?autoplay=1&controls=0&start=${startSeconds}&rel=0&origin=${window.location.origin}&enablejsapi=1`;
    }, [track?.current?.videoId, track?.startTime, track?.isPaused]);

    const PlayIcon = () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
    const PauseIcon = () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
    const SkipIcon = () => <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>;
    const VolumeIcon = () => <svg className="w-5 h-5 fill-current text-white/70" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
    const QueueIcon = () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/></svg>;
    const CloseIcon = () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;

    return (
        <div 
            className="relative w-full h-full bg-zinc-950 flex flex-col group overflow-hidden cursor-pointer rounded-2xl"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onClick={() => setShowControls(!showControls)}
        >
            {track?.current?.image && ( <div className="absolute inset-0 z-0 opacity-30 blur-3xl scale-110"> <img src={track.current.image} className="w-full h-full object-cover" alt="bg" /> </div> )}
            
            <div className="flex-1 relative z-10 flex flex-col p-4 min-h-0 justify-center items-center">
                <div 
                    className={`absolute top-20 md:top-4 left-4 right-4 flex gap-2 bg-black/60 p-2 rounded-xl border border-white/5 backdrop-blur-md z-30 transition-all duration-300 ${showControls ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}
                    onClick={(e) => e.stopPropagation()}
                >
                     <input className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none placeholder-white/40" placeholder={t('room_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) { onSearch({ query: search, action: 'queue' }); setSearch(""); } }} />
                     {track?.current && <button onClick={() => handleControl('stop')} className="text-red-400 hover:text-red-300 px-2 font-bold text-[10px] tracking-widest">STOP</button>}
                </div>

                {track?.current ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full transition-all duration-300 ease-in-out" style={{ transform: showControls ? 'scale(0.95) translateY(-10px)' : 'scale(1)' }}>
                        <div className="mt-32 md:mt-24 relative aspect-square w-full max-w-[240px] shadow-2xl rounded-2xl overflow-hidden mb-4 border border-white/10 shrink-0 bg-black group-hover:shadow-indigo-500/20 transition-all">
                            <img src={track.current.image} className="w-full h-full object-cover" alt="thumb" />
                            {!track.isPaused && ( <iframe ref={iframeRef} className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" src={iframeSrc} allow="autoplay" /> )}
                        </div>
                        <h3 className="text-white font-bold text-center line-clamp-1 px-4 text-lg w-full mb-1 drop-shadow-md">{track.current.title}</h3>
                    </div>
                ) : ( 
                    <div className="flex-1 flex flex-col items-center justify-center text-white/20"> 
                        <div className="text-5xl mb-4 animate-spin-slow opacity-50">💿</div> 
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t('room_idle')}</p> 
                    </div> 
                )}
            </div>

            <div 
                className={`relative z-20 bg-[#1e1f22]/90 backdrop-blur-2xl border-t border-white/5 p-4 transition-all duration-300 ease-out transform ${showControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
                onClick={(e) => e.stopPropagation()} 
            >
                {track?.current && (
                    <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-white/40 mb-3 px-1">
                        <span className="min-w-[30px] text-right">{formatTime(progress)}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${Math.min((progress / track.current.duration) * 100, 100)}%` }} />
                        </div>
                        <span className="min-w-[30px]">{formatTime(track.current.duration)}</span>
                    </div>
                )}

                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 flex items-center gap-2 min-w-0 justify-start group/vol">
                        <button className="hover:text-white transition-colors" onClick={() => setLocalVolume(localVolume === 0 ? 50 : 0)}><VolumeIcon /></button>
                        <input 
                            type="range" min="0" max="100" value={localVolume} 
                            onChange={(e) => setLocalVolume(parseInt(e.target.value))}
                            className="w-14 md:w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white opacity-60 hover:opacity-100 transition-opacity"
                        />
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                         <div className="w-8 h-8 opacity-0 pointer-events-none"></div>
                         <button 
                            onClick={() => handleControl(track?.isPaused ? 'resume' : 'pause')} 
                            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 hover:bg-indigo-50 transition-all active:scale-95 shadow-lg shadow-white/10"
                         > 
                            {track?.isPaused ? <PlayIcon /> : <PauseIcon />} 
                         </button>
                         <button 
                            onClick={() => handleControl('skip')} 
                            className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-90 hover:bg-white/10 rounded-full"
                         > 
                            <SkipIcon />
                         </button>
                    </div>

                    <div className="flex-1 flex justify-end min-w-0">
                         <button 
                            onClick={() => setShowQueue(!showQueue)} 
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${showQueue ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
                        >
                            <QueueIcon />
                         </button>
                    </div>
                </div>
            </div>

            {showQueue && track?.queue && ( 
                <div 
                    className="absolute inset-0 z-30 bg-[#111214]/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom-full duration-300"
                    onClick={(e) => e.stopPropagation()} 
                > 
                    <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/5"> 
                        <span className="text-xs font-bold text-white/70 uppercase tracking-widest flex items-center gap-2"><QueueIcon/> Up Next</span> 
                        <button onClick={() => setShowQueue(false)} className="text-white/50 hover:text-white transition-transform hover:rotate-90"><CloseIcon /></button> 
                    </div> 
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"> 
                        {track.queue.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/20 text-xs gap-2">
                                <span className="text-2xl">💤</span>
                                Queue is empty
                            </div>
                        ) : (
                            track.queue.map((q: any, i: number) => ( 
                                <div key={i} className="flex gap-3 items-center p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-default"> 
                                    <div className="relative w-10 h-10 shrink-0">
                                        <img src={q.image} className="w-full h-full rounded-md object-cover" alt="q-thumb"/>
                                        <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-[10px] text-white">▶</div>
                                    </div>
                                    <div className="flex-1 min-w-0"> 
                                        <div className="text-xs text-white/90 font-bold truncate">{q.title}</div> 
                                        <div className="text-[10px] text-white/40 truncate">Requested by User</div> 
                                    </div> 
                                </div> 
                            ))
                        )}
                    </div> 
                </div> 
            )}
        </div>
    );
});
RoomPlayer.displayName = "RoomPlayer";