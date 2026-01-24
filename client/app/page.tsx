"use client";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

// ⚠️ POLYFILL
if (typeof window !== 'undefined') { 
    (window as any).global = window; 
    (window as any).process = { env: { DEBUG: undefined }, }; 
    (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; 
}

const BACKEND_URL = "https://dachat-app.onrender.com"; 
const KLIPY_API_KEY = "bfofoQzlu5Uu8tpvTAnOn0ZC64MyxoVBAgJv52RbIRqKnjidRZ6IPbQqnULhIIi9"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";

const PEER_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const socket: Socket = io(BACKEND_URL, { 
    autoConnect: false,
    transports: ["websocket", "polling"]
});

const GlassPanel = ({ children, className, onClick }: any) => (
  <div onClick={onClick} className={`backdrop-blur-xl bg-gray-900/60 border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] ${className}`}>
    {children}
  </div>
);

const UserAvatar = memo(({ src, alt, className, fallbackClass, onClick }: any) => {
  return src ? (
    <img key={src} onClick={onClick} src={src} alt={alt || "User"} className={`${className} bg-black/20 object-cover cursor-pointer`} loading="lazy" />
  ) : (
    <div onClick={onClick} className={`${className} ${fallbackClass || "bg-white/5"} flex items-center justify-center backdrop-blur-md border border-white/10 cursor-pointer`}>
       <span className="text-[10px] text-white/40 font-bold">?</span>
    </div>
  );
});
UserAvatar.displayName = "UserAvatar";

const GifPicker = ({ onSelect, onClose }: any) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { fetch(`${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`).then(r => r.json()).then(d => setGifs(d.results || [])); }, []);
  const searchGifs = async (q: string) => { if(!q) return; const res = await fetch(`${KLIPY_BASE_URL}/search?q=${q}&key=${KLIPY_API_KEY}&limit=20`); const data = await res.json(); setGifs(data.results || []); };
  return (
    <GlassPanel className="absolute bottom-24 left-4 w-[360px] h-[480px] rounded-[32px] flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-3xl flex gap-3 items-center">
        <input className="w-full bg-black/20 text-white px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5" placeholder="Search GIFs..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchGifs(search)} autoFocus />
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="columns-2 gap-3 space-y-3">
          {gifs.map((g) => ( <div key={g.id} className="relative group overflow-hidden rounded-2xl cursor-pointer hover:ring-2 ring-blue-500/50" onClick={() => onSelect(g?.media_formats?.gif?.url)}> <img src={g?.media_formats?.tinygif?.url} className="w-full h-auto object-cover rounded-xl" /> </div> ))}
        </div>
      </div>
    </GlassPanel>
  );
};

export default function DaChat() {
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const [servers, setServers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [serverMembers, setServerMembers] = useState<any[]>([]);

  const [view, setView] = useState("dms");
  const [active, setActive] = useState<any>({ server: null, channel: null, friend: null, pendingRequest: null });
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [voiceStates, setVoiceStates] = useState<Record<string, number[]>>({});
  const peersRef = useRef<any[]>([]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings & Edit States
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false); // ✅ NEW
  const [showProfileGifPicker, setShowProfileGifPicker] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", bio: "", avatarUrl: "" });
  const [serverEditForm, setServerEditForm] = useState({ name: "", imageUrl: "" }); // ✅ NEW
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newServerFile, setNewServerFile] = useState<File | null>(null); // ✅ NEW

  useEffect(() => { 
      socket.connect(); 
      const handleConnect = () => { if (user) socket.emit("setup", user.id); };
      socket.on("connect", handleConnect);
      socket.on("connect_error", (err) => console.error("Connection Error:", err));
      if (socket.connected && user) socket.emit("setup", user.id);
      return () => { socket.off("connect", handleConnect); socket.disconnect(); }; 
  }, [user]); 

  useEffect(() => { 
      socket.on("receive_message", (msg) => setChatHistory(prev => [...prev, msg])); 
      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); });
      
      socket.on("user_updated", ({ userId }) => { 
          if (viewingProfile && viewingProfile.id === userId) viewUserProfile(userId);
          if (active.server) fetchServers(user.id);
          fetchFriends(user.id);
      });
      
      socket.on("new_friend_request", () => { if(user) fetchRequests(user.id); });
      socket.on("new_server_invite", () => { if(user) fetchServers(user.id); });
      socket.on("server_updated", ({ serverId }) => { 
          if (active.server?.id === serverId) {
              fetchServers(user.id); 
              selectServer({ id: serverId }); // Refresh contents
          }
      });
      socket.on("incoming_call", (data) => setIncomingCall(data));
      
      return () => { 
          socket.off("receive_message"); 
          socket.off("load_messages"); 
          socket.off("voice_state_update"); 
          socket.off("user_updated"); 
          socket.off("new_friend_request");
          socket.off("incoming_call"); 
          socket.off("server_updated");
          socket.off("new_server_invite");
      }; 
  }, [user, viewingProfile, active.server]);

  const handleAuth = async () => {
    const endpoint = isRegistering ? "register" : "login";
    try {
      const res = await fetch(`${BACKEND_URL}/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        fetchServers(data.user.id);
        fetchFriends(data.user.id);
        fetchRequests(data.user.id);
        socket.emit("setup", data.user.id);
      } else setError(data.message || "Auth failed");
    } catch { setError("Connection failed"); }
  };

  const fetchServers = async (id: number) => { const res = await fetch(`${BACKEND_URL}/my-servers/${id}`); setServers(await res.json()); };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());
  const fetchRequests = async (id: number) => setRequests(await (await fetch(`${BACKEND_URL}/my-requests/${id}`)).json());

  const selectServer = async (server: any) => {
    setView("servers");
    setActive((prev:any) => ({ ...prev, server, friend: null, pendingRequest: null }));
    const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`);
    const chData = await res.json();
    setChannels(chData);
    
    // Auto Join First Channel if none active
    if(!active.channel && chData.length > 0) joinChannel(chData[0]);
    else if(active.channel) joinChannel(active.channel); // Refresh current

    const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`);
    setServerMembers(await memRes.json());
  };

  const joinChannel = (channel: any) => {
    if (channel.type === 'voice') { if (channel.id) joinVoiceRoom(channel.id.toString()); } 
    else { setActive((prev: any) => ({ ...prev, channel, friend: null, pendingRequest: null })); setChatHistory([]); if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() }); }
  };

  const selectFriend = (friend: any) => { setActive((prev: any) => ({ ...prev, friend, channel: null, pendingRequest: null })); setChatHistory([]); const ids = [user.id, friend.id].sort((a, b) => a - b); socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` }); };
  const selectRequest = (requestUser: any) => { setActive((prev: any) => ({ ...prev, pendingRequest: requestUser, friend: null, channel: null })); };

  // --- ACTIONS ---
  const sendFriendRequest = async () => { const usernameToAdd = prompt("Enter username to request:"); if (!usernameToAdd) return; try { const res = await fetch(`${BACKEND_URL}/send-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); const data = await res.json(); alert(data.message); } catch { alert("Error sending request"); }};
  const handleAcceptRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/accept-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchFriends(user.id); fetchRequests(user.id); selectFriend(active.pendingRequest); };
  const handleDeclineRequest = async () => { if(!active.pendingRequest) return; await fetch(`${BACKEND_URL}/decline-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, senderId: active.pendingRequest.id }) }); fetchRequests(user.id); setActive({...active, pendingRequest: null}); };
  const handleRemoveFriend = async () => { if (!viewingProfile) return; if (!confirm(`Are you sure you want to remove ${viewingProfile.username} from your friends?`)) return; await fetch(`${BACKEND_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendId: viewingProfile.id }) }); setViewingProfile(null); fetchFriends(user.id); if(active.friend?.id === viewingProfile.id) setActive({ ...active, friend: null }); };

  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { 
      const content = textMsg || (fileUrl ? "Sent an image" : ""); 
      const payload: any = { content, senderId: user.id, senderName: user.username, fileUrl, avatar_url: user.avatar_url }; 
      if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } 
      else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } 
      setMessage(""); 
  };

  const handleFileUpload = async (e: any) => {
      const file = e.target.files[0]; if(!file) return; const formData = new FormData(); formData.append("file", file);
      const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json();
      if(data.success) sendMessage(null, data.fileUrl);
  };

  const viewUserProfile = async (userId: number) => { const res = await fetch(`${BACKEND_URL}/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };

  const openSettings = () => { setEditForm({ username: user.username, bio: user.bio || "", avatarUrl: user.avatar_url }); setShowSettings(true); setShowProfileGifPicker(false); };
  const saveProfile = async () => {
      let finalAvatarUrl = editForm.avatarUrl;
      if (newAvatarFile) { const formData = new FormData(); formData.append("file", newAvatarFile); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); finalAvatarUrl = (await res.json()).fileUrl; }
      const res = await fetch(`${BACKEND_URL}/update-profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, username: editForm.username, bio: editForm.bio, avatarUrl: finalAvatarUrl }) });
      if ((await res.json()).success) { setUser({...user, username: editForm.username, bio: editForm.bio, avatar_url: finalAvatarUrl }); setShowSettings(false); setNewAvatarFile(null); alert("Updated!"); }
  };

  // --- SERVER MANAGEMENT UI LOGIC ---
  const createServer = async () => { const name = prompt("Server Name"); if(name) { await fetch(`${BACKEND_URL}/create-server`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId: user.id }) }); fetchServers(user.id); }};
  
  const createChannel = async () => { const name = prompt("Name"); const type = confirm("Voice?") ? "voice" : "text"; if(name) { await fetch(`${BACKEND_URL}/create-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, name, type }) }); selectServer(active.server); }};
  const deleteChannel = async (channelId: number) => { if(!confirm("Delete channel?")) return; await fetch(`${BACKEND_URL}/delete-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, channelId }) }); selectServer(active.server); };
  
  const inviteUser = async () => { const userString = prompt("Username to invite:"); if(!userString) return; const res = await fetch(`${BACKEND_URL}/servers/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userString }) }); alert((await res.json()).message || "Invited!"); };
  const leaveServer = async () => { if(!confirm("Leave server?")) return; await fetch(`${BACKEND_URL}/servers/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id }) }); setView("dms"); setActive({server:null}); fetchServers(user.id); };
  
  const openServerSettings = () => { setServerEditForm({ name: active.server.name, imageUrl: active.server.image_url || "" }); setShowServerSettings(true); };
  const saveServerSettings = async () => {
      let finalImg = serverEditForm.imageUrl;
      if (newServerFile) { const formData = new FormData(); formData.append("file", newServerFile); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); finalImg = (await res.json()).fileUrl; }
      await fetch(`${BACKEND_URL}/servers/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id, name: serverEditForm.name, imageUrl: finalImg }) });
      setShowServerSettings(false); setNewServerFile(null);
  };

  const promoteMember = async (targetId: number) => { if(!confirm("Toggle Moderator Status?")) return; await fetch(`${BACKEND_URL}/servers/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, ownerId: user.id, targetUserId: targetId }) }); };

  // --- ROLE HELPERS ---
  const getRole = () => serverMembers.find(m => m.id === user.id);
  const isMod = getRole()?.is_admin;
  const isOwner = active.server?.owner_id === user.id;

  // --- WEBRTC ---
  const startDMCall = () => { if (!active.friend) return; const ids = [user.id, active.friend.id].sort((a, b) => a - b); const roomId = `dm-call-${ids[0]}-${ids[1]}`; joinVoiceRoom(roomId); socket.emit("start_call", { senderId: user.id, recipientId: active.friend.id, senderName: user.username, avatarUrl: user.avatar_url, roomId }); };
  const answerCall = () => { if (incomingCall) { joinVoiceRoom(incomingCall.roomId); setIncomingCall(null); } };
  const joinVoiceRoom = useCallback((roomId: string) => { if (!user) return; socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal"); navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => { setInCall(true); setMyStream(stream); socket.emit("join_voice", { roomId, userData: user }); socket.on("all_users", (users) => { const arr: any[] = []; users.forEach((u: any) => { const p = createPeer(u.socketId, socket.id as string, stream); peersRef.current.push({ peerID: u.socketId, peer: p, info: u.userData }); arr.push({ peerID: u.socketId, peer: p, info: u.userData }); }); setPeers(arr); }); socket.on("user_joined", (p) => { const item = peersRef.current.find(x => x.peerID === p.callerID); if(item) { item.peer.signal(p.signal); return; } const peer = addPeer(p.signal, p.callerID, stream); peersRef.current.push({ peerID: p.callerID, peer, info: p.userData }); setPeers(u => [...u, { peerID: p.callerID, peer, info: p.userData }]); }); socket.on("receiving_returned_signal", (p) => { const item = peersRef.current.find(x => x.peerID === p.id); if(item) item.peer.signal(p.signal); }); }).catch(() => alert("Mic denied")); }, [user]);
  const createPeer = (u:string, c:string, s:MediaStream) => { const p = new Peer({ initiator: true, trickle: false, stream: s, config: PEER_CONFIG }); p.on("signal", (sig:any) => socket.emit("sending_signal", { userToSignal: u, callerID: c, signal: sig, userData: user })); return p; };
  const addPeer = (sig:any, c:string, s:MediaStream) => { const p = new Peer({ initiator: false, trickle: false, stream: s, config: PEER_CONFIG }); p.on("signal", (sig:any) => socket.emit("returning_signal", { signal: sig, callerID: c })); p.signal(sig); return p; };
  const leaveCall = () => { if(isScreenSharing) stopScreenShare(); setInCall(false); setMyStream(null); setPeers([]); myStream?.getTracks().forEach(t => t.stop()); peersRef.current.forEach(p => p.peer.destroy()); peersRef.current = []; socket.emit("leave_voice"); };
  const startScreenShare = async () => { try { const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); setScreenStream(s); setIsScreenSharing(true); const t = s.getVideoTracks()[0]; peersRef.current.forEach((po) => { const pc = (po.peer as any)._pc; if(pc) { const snd = pc.getSenders().find((x: any) => x.track && x.track.kind === 'video'); if(snd) snd.replaceTrack(t); } }); t.onended = () => stopScreenShare(); } catch(e) { console.error(e); } };
  const stopScreenShare = () => { screenStream?.getTracks().forEach(t => t.stop()); setScreenStream(null); setIsScreenSharing(false); if(myStream) { const t = myStream.getVideoTracks()[0]; if(t) { peersRef.current.forEach((po) => { const pc = (po.peer as any)._pc; if(pc) { const snd = pc.getSenders().find((x: any) => x.track && x.track.kind === 'video'); if(snd) snd.replaceTrack(t); } }); } } };

  if (!user) return ( <div className="flex h-screen items-center justify-center bg-black relative"><GlassPanel className="p-10 rounded-3xl w-96 flex flex-col gap-4 text-center"> <h1 className="text-3xl font-bold text-white">DaChat</h1> {error && <div className="text-red-400 text-xs">{error}</div>} <input className="bg-white/10 p-3 rounded text-white" placeholder="Username" onChange={e=>setAuthForm({...authForm, username: e.target.value})} /> <input className="bg-white/10 p-3 rounded text-white" type="password" placeholder="Password" onChange={e=>setAuthForm({...authForm, password: e.target.value})} /> <button onClick={handleAuth} className="bg-white text-black py-3 rounded font-bold">{isRegistering?"Register":"Login"}</button> <p className="text-white/50 cursor-pointer text-xs" onClick={()=>setIsRegistering(!isRegistering)}>{isRegistering?"Login":"Create Account"}</p> </GlassPanel></div> );

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-black to-black z-0"></div>
      
      {/* 1. DOCK */}
      <div className="z-30 w-[90px] h-full flex flex-col items-center py-8 gap-4 fixed left-0 top-0 border-r border-white/5 bg-black/40 backdrop-blur-xl">
        <div onClick={() => { setView("dms"); setActive({server:null}); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all ${view === 'dms' ? "bg-blue-600" : "bg-white/10 hover:bg-white/20"}`}> 🏠 </div>
        <div className="w-8 h-[1px] bg-white/10" />
        <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto no-scrollbar">
            {servers.map(s => ( <div key={s.id} onClick={() => selectServer(s)} className="group relative w-12 h-12 cursor-pointer"> {active.server?.id === s.id && <div className="absolute -left-3 top-2 h-8 w-1 bg-white rounded-r-full" />} <UserAvatar src={s.image_url} alt={s.name} className={`w-12 h-12 object-cover transition-all ${active.server?.id === s.id ? "rounded-2xl" : "rounded-[24px] group-hover:rounded-2xl"}`} fallbackClass={`w-12 h-12 bg-white/10 flex items-center justify-center font-bold text-xs transition-all ${active.server?.id === s.id ? "rounded-2xl" : "rounded-[24px] group-hover:rounded-2xl"}`} /> </div> ))}
            <div onClick={createServer} className="w-12 h-12 rounded-[24px] border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white hover:text-green-400 text-white/40 transition-all"> + </div>
        </div>
        <UserAvatar onClick={openSettings} src={user.avatar_url} className="w-12 h-12 rounded-full cursor-pointer hover:ring-2 ring-white/50" />
      </div>

      {/* 2. SIDEBAR */}
      <div className="relative z-10 w-[260px] ml-[90px] h-screen bg-black/20 backdrop-blur-md border-r border-white/5 flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 font-bold tracking-wide">
            <span className="truncate">{active.server ? active.server.name : "Direct Messages"}</span>
            {active.server && isMod && <button onClick={openServerSettings} className="text-xs text-white/50 hover:text-white">⚙️</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {view === "servers" && active.server ? (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>Channels</span> {isMod && <button onClick={createChannel} className="text-lg hover:text-white">+</button>} </div>
                    {channels.map(ch => ( 
                        <div key={ch.id} className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between ${active.channel?.id === ch.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
                            <div className="flex items-center gap-2 truncate" onClick={() => joinChannel(ch)}> <span className="opacity-50">{ch.type==='voice'?'🔊':'#'}</span> {ch.name} </div>
                            {isMod && <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-xs text-red-400">✕</button>}
                        </div>
                    ))}
                    <div className="mt-6 px-2 space-y-2">
                        <button onClick={inviteUser} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/30">Invite People</button>
                        <button onClick={leaveServer} className="w-full py-2 bg-red-600/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/20">Leave Server</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center px-2 py-2 text-[10px] font-bold text-white/40 uppercase"> <span>Requests</span> <button onClick={sendFriendRequest} className="text-lg hover:text-white">+</button> </div>
                    {requests.map(req => ( <div key={req.id} onClick={() => selectRequest(req)} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 ${active.pendingRequest?.id===req.id?"bg-white/10":""}`}> <UserAvatar src={req.avatar_url} className="w-8 h-8 rounded-full" /> <div><div className="text-xs font-bold">{req.username}</div><div className="text-[9px] text-yellow-400">Request</div></div> </div> ))}
                    <div className="mt-4 px-2 text-[10px] font-bold text-white/40 uppercase">Friends</div>
                    {friends.map(f => ( <div key={f.id} className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-white/5 ${active.friend?.id===f.id?"bg-white/10":""}`}> <UserAvatar onClick={(e:any)=>{e.stopPropagation(); viewUserProfile(f.id)}} src={f.avatar_url} className="w-8 h-8 rounded-full" /> <div className="flex-1" onClick={()=>selectFriend(f)}><div className="text-xs font-bold">{f.username}</div><div className="text-[9px] text-green-400">Online</div></div> </div> ))}
                </>
            )}
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
         {(active.channel || active.friend) && <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md"> <div className="flex items-center gap-3 font-bold text-lg"> <span className="text-white/30">@</span> {active.channel ? active.channel.name : active.friend?.username} </div> {!active.channel && <button onClick={startDMCall} className="bg-green-600 p-2 rounded-full hover:bg-green-500">📞</button>} </div>}
         
         {active.pendingRequest ? (
             <div className="flex-1 flex flex-col items-center justify-center gap-4">
                 <UserAvatar src={active.pendingRequest.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/10" />
                 <div className="text-xl font-bold">{active.pendingRequest.username}</div>
                 <div className="flex gap-3"> <button onClick={handleAcceptRequest} className="px-6 py-2 bg-green-600 rounded-lg font-bold">Accept</button> <button onClick={handleDeclineRequest} className="px-6 py-2 bg-red-600/30 text-red-200 rounded-lg font-bold">Decline</button> </div>
             </div>
         ) : inCall ? (
             <div className="flex-1 bg-black flex flex-col items-center justify-center relative p-4">
                 <div className="grid grid-cols-2 gap-4 w-full h-full max-w-4xl">
                     <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10"> {isScreenSharing ? <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : <div className="absolute inset-0 flex items-center justify-center flex-col"><UserAvatar src={user.avatar_url} className="w-20 h-20 rounded-full" /><span>You</span></div>} <button onClick={startScreenShare} className="absolute bottom-4 right-4 p-2 bg-white/10 rounded-full">🖥️</button> </div>
                     {peers.map(p => ( <div key={p.peerID} className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10"> <MediaPlayer peer={p.peer} /> </div> ))}
                 </div>
                 <button onClick={leaveCall} className="mt-4 px-8 py-3 bg-red-600 rounded-full font-bold">End Call</button>
             </div>
         ) : (active.channel || active.friend) ? (
             <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {chatHistory.map((msg, i) => ( <div key={msg.id || i} className={`flex gap-3 ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`}> <UserAvatar onClick={()=>viewUserProfile(msg.sender_id)} src={msg.avatar_url} className="w-10 h-10 rounded-xl" /> <div className={`max-w-[70%] ${msg.sender_id===user.id?"items-end":"items-start"} flex flex-col`}> <div className="flex items-center gap-2 mb-1"> <span className="text-xs font-bold text-white/50">{msg.sender_name}</span> </div> <div className={`px-4 py-2 rounded-2xl text-sm ${msg.sender_id===user.id?"bg-blue-600":"bg-white/10"}`}> {msg.content?.startsWith("http") ? <img src={msg.content} className="max-w-[250px] rounded-lg" /> : msg.content} </div> {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-[300px] rounded-xl border border-white/10" />} </div> </div> ))}
                </div>
                <div className="p-4">
                    {showGifPicker && <div className="absolute bottom-20 left-4 z-50"><GifPicker onSelect={(u:string)=>{sendMessage(null,u); setShowGifPicker(false)}} onClose={()=>setShowGifPicker(false)} /></div>}
                    <div className="bg-white/5 border border-white/10 rounded-full p-2 flex items-center gap-2"> <button className="w-10 h-10 rounded-full hover:bg-white/10 text-white/50" onClick={()=>fileInputRef.current?.click()}>📎</button> <button className="w-10 h-10 rounded-full hover:bg-white/10 text-[10px] font-bold text-white/50" onClick={()=>setShowGifPicker(!showGifPicker)}>GIF</button> <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> <input className="flex-1 bg-transparent outline-none px-2" placeholder="Message..." value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage(message)} /> </div>
                </div>
             </>
         ) : <div className="flex-1 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest">Select a Channel</div>}
      </div>

      {/* 4. MEMBER LIST */}
      {view === "servers" && active.server && (
          <div className="w-[240px] border-l border-white/5 bg-black/20 backdrop-blur-md p-4 hidden lg:block">
              <div className="text-[10px] font-bold text-white/30 uppercase mb-4">Members — {serverMembers.length}</div>
              <div className="space-y-1">
                  {serverMembers.map(m => ( 
                    <div key={m.id} onClick={() => viewUserProfile(m.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group"> 
                        <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-full" /> 
                        <div className="flex-1 min-w-0"> <div className={`text-sm font-bold truncate ${m.id === active.server.owner_id ? "text-yellow-500" : "text-white/80"}`}>{m.username}</div> </div>
                        {m.id === active.server.owner_id && <span>👑</span>}
                        {m.is_admin && m.id !== active.server.owner_id && <span>🛡️</span>}
                    </div> 
                  ))}
              </div>
          </div>
      )}

      {/* MODALS */}
      {viewingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setViewingProfile(null)}>
              <GlassPanel className="w-96 p-8 flex flex-col items-center relative" onClick={(e:any)=>e.stopPropagation()}>
                  <UserAvatar src={viewingProfile.avatar_url} className="w-24 h-24 rounded-full mb-4 border-4 border-white/10" />
                  <h2 className="text-2xl font-bold">{viewingProfile.username}</h2>
                  <p className="text-white/50 text-sm mt-2 text-center">{viewingProfile.bio || "No bio set."}</p>
                  
                  {/* Remove Friend Logic */}
                  {friends.some((f: any) => f.id === viewingProfile.id) && <button onClick={handleRemoveFriend} className="mt-6 w-full py-2 bg-red-500/20 text-red-400 rounded-lg font-bold">Remove Friend</button>}
                  
                  {/* Mod Logic: Promote/Demote */}
                  {active.server && isOwner && viewingProfile.id !== user.id && serverMembers.some((m:any) => m.id === viewingProfile.id) && (
                      <div className="mt-4 w-full space-y-2 pt-4 border-t border-white/10">
                          <div className="text-[10px] uppercase text-white/30 font-bold text-center mb-2">Owner Actions</div>
                          <button onClick={() => promoteMember(viewingProfile.id)} className="w-full py-2 bg-blue-500/20 text-blue-300 rounded-lg font-bold text-sm">Toggle Moderator</button>
                      </div>
                  )}
              </GlassPanel>
          </div>
      )}

      {showServerSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <GlassPanel className="w-96 p-8 flex flex-col gap-4">
                  <h2 className="text-xl font-bold">Server Settings</h2>
                  <div className="flex justify-center mb-4 cursor-pointer" onClick={()=>(document.getElementById('serverImg') as any).click()}>
                      <UserAvatar src={newServerFile ? URL.createObjectURL(newServerFile) : serverEditForm.imageUrl} className="w-20 h-20 rounded-2xl border-2 border-white/20" />
                      <input id="serverImg" type="file" className="hidden" onChange={(e)=>e.target.files && setNewServerFile(e.target.files[0])} />
                  </div>
                  <input className="bg-white/10 p-3 rounded text-white" value={serverEditForm.name} onChange={e=>setServerEditForm({...serverEditForm, name: e.target.value})} />
                  <div className="flex justify-end gap-2"> <button onClick={()=>setShowServerSettings(false)} className="text-white/50 px-4">Cancel</button> <button onClick={saveServerSettings} className="bg-white text-black px-6 py-2 rounded font-bold">Save</button> </div>
              </GlassPanel>
          </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-bounce-in">
              <div className="flex flex-col items-center gap-6">
                  <UserAvatar src={incomingCall.avatarUrl} className="w-32 h-32 rounded-full border-4 border-green-500 animate-pulse" />
                  <div className="text-2xl font-bold">{incomingCall.senderName} is calling...</div>
                  <div className="flex gap-8">
                      <button onClick={()=>setIncomingCall(null)} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-2xl">✕</button>
                      <button onClick={answerCall} className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-2xl">📞</button>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Profile Modal (Existing) */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <GlassPanel className="w-96 p-8 flex flex-col gap-4">
                  <div className="flex flex-col items-center mb-4">
                      <UserAvatar src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} className="w-24 h-24 rounded-full mb-2" onClick={()=>(document.getElementById('pUpload') as any).click()}/>
                      <input id="pUpload" type="file" className="hidden" onChange={e=>e.target.files && setNewAvatarFile(e.target.files[0])} />
                  </div>
                  <input className="bg-white/10 p-3 rounded text-white" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})} />
                  <textarea className="bg-white/10 p-3 rounded text-white h-24 resize-none" value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} />
                  <div className="flex justify-end gap-2"> <button onClick={()=>setShowSettings(false)} className="text-white/50 px-4">Cancel</button> <button onClick={saveProfile} className="bg-white text-black px-6 py-2 rounded font-bold">Save</button> </div>
              </GlassPanel>
          </div>
      )}
    </div>
  );
}

const MediaPlayer = ({ peer }: any) => { const ref = useRef<HTMLVideoElement>(null); useEffect(() => { peer.on("stream", (stream: MediaStream) => { if (ref.current) ref.current.srcObject = stream; }); }, [peer]); return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />; };