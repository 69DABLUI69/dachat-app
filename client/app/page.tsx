"use client";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

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

// 🔌 SOCKET SINGLETON
const socket: Socket = io(BACKEND_URL, { 
    autoConnect: false,
    transports: ["websocket", "polling"]
});

// 🎨 CUSTOM COMPONENTS
const GlassPanel = ({ children, className, onClick }: any) => (
  <div onClick={onClick} className={`backdrop-blur-xl bg-gray-900/60 border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] ${className}`}>
    {children}
  </div>
);

// ✅ UPDATED AVATAR: Added key={src} to force GIF reload/loop
const UserAvatar = memo(({ src, alt, className, fallbackClass, onClick }: any) => {
  return src ? (
    <img 
      key={src} 
      onClick={onClick} 
      src={src} 
      alt={alt || "User"} 
      className={`${className} bg-black/20 object-cover cursor-pointer`} 
      loading="lazy" 
    />
  ) : (
    <div onClick={onClick} className={`${className} ${fallbackClass || "bg-white/5"} flex items-center justify-center backdrop-blur-md border border-white/10 cursor-pointer`}>
       <span className="text-[10px] text-white/40 font-bold">?</span>
    </div>
  );
});
UserAvatar.displayName = "UserAvatar";

// 🔥 GIF PICKER
const GifPicker = ({ onSelect, onClose }: any) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`)
      .then(r => r.json()).then(d => setGifs(d.results || []));
  }, []);

  const searchGifs = async (q: string) => {
      if(!q) return;
      const res = await fetch(`${KLIPY_BASE_URL}/search?q=${q}&key=${KLIPY_API_KEY}&limit=20`);
      const data = await res.json();
      setGifs(data.results || []);
  };

  return (
    <GlassPanel className="absolute bottom-10 left-0 w-full h-[400px] rounded-[24px] flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 ring-1 ring-white/20">
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-3xl flex gap-3 items-center">
        <input 
            className="w-full bg-black/20 text-white px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5 placeholder-white/30 transition-all"
            placeholder="Search GIFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchGifs(search)}
            autoFocus
        />
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="columns-2 gap-3 space-y-3">
          {gifs.map((g) => (
            <div key={g.id} className="relative group overflow-hidden rounded-2xl cursor-pointer hover:ring-2 ring-blue-500/50 transition-all" onClick={() => onSelect(g?.media_formats?.gif?.url)}>
              <img src={g?.media_formats?.tinygif?.url} className="w-full h-auto object-cover rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
};

export default function DaChat() {
  // STATE
  const [user, setUser] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const [servers, setServers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [serverMembers, setServerMembers] = useState<any[]>([]);

  const [view, setView] = useState("dms");
  const [active, setActive] = useState<any>({ server: null, channel: null, friend: null });
  
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  // Voice/Video
  const [inCall, setInCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [voiceStates, setVoiceStates] = useState<Record<string, number[]>>({});
  const peersRef = useRef<any[]>([]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Viewing & Editing
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileGifPicker, setShowProfileGifPicker] = useState(false); // ✅ NEW
  const [editForm, setEditForm] = useState({ username: "", bio: "", avatarUrl: "" });
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);

  // --- INIT ---
  useEffect(() => { 
      socket.connect(); 
      socket.on("connect_error", (err) => console.error("Connection Error:", err));
      return () => { socket.disconnect(); }; 
  }, []);

  // --- AUTH & DATA ---
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
        socket.emit("setup", data.user.id);
      } else setError(data.message || "Auth failed");
    } catch { setError("Connection failed"); }
  };

  const fetchServers = async (id: number) => {
    const res = await fetch(`${BACKEND_URL}/my-servers/${id}`);
    const data = await res.json();
    setServers(data);
    return data;
  };

  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());

  const selectServer = async (server: any) => {
    setView("servers");
    setActive({ ...active, server, friend: null });
    const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`);
    const data = await res.json();
    setChannels(data);
    const textChannels = data.filter((c: any) => c.type === 'text');
    if (textChannels.length > 0) joinChannel(textChannels[0]);
    
    const memRes = await fetch(`${BACKEND_URL}/servers/${server.id}/members`);
    setServerMembers(await memRes.json());
  };

  const joinChannel = (channel: any) => {
    if (channel.type === 'voice') {
      if (channel.id) joinVoiceRoom(channel.id.toString());
    } else {
      setActive((prev: any) => ({ ...prev, channel }));
      setChatHistory([]);
      if (channel.id) socket.emit("join_room", { roomId: channel.id.toString() });
    }
  };

  const selectFriend = (friend: any) => {
    setActive((prev: any) => ({ ...prev, friend, channel: null }));
    setChatHistory([]);
    const ids = [user.id, friend.id].sort((a, b) => a - b);
    socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` });
  };

  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { 
      const content = textMsg || (fileUrl ? "Sent an image" : ""); 
      const payload: any = { content, senderId: user.id, senderName: user.username, fileUrl, avatar_url: user.avatar_url }; 
      if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } 
      else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } 
      setMessage(""); 
  };

  const handleFileUpload = async (e: any) => {
      const file = e.target.files[0];
      if(!file) return;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if(data.success) sendMessage(null, data.fileUrl);
  };

  // --- PROFILE LOGIC ---
  const viewUserProfile = async (userId: number) => {
      // 1. Fetch fresh data
      const res = await fetch(`${BACKEND_URL}/users/${userId}`);
      const data = await res.json();
      if (data.success) setViewingProfile(data.user);
  };

  const openSettings = () => {
      setEditForm({ username: user.username, bio: user.bio || "", avatarUrl: user.avatar_url });
      setShowSettings(true);
      setShowProfileGifPicker(false);
  };

  const saveProfile = async () => {
      let finalAvatarUrl = editForm.avatarUrl;
      
      // 1. Upload new avatar if selected (and not just a gif url)
      if (newAvatarFile) {
          const formData = new FormData();
          formData.append("file", newAvatarFile);
          try {
            const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                finalAvatarUrl = data.fileUrl;
            } else {
                alert("Failed to upload image. Please try again.");
                return;
            }
          } catch (e) {
              alert("Error uploading image.");
              return;
          }
      }

      // 2. Send profile update to backend
      try {
        const res = await fetch(`${BACKEND_URL}/update-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                userId: user.id, 
                username: editForm.username, 
                bio: editForm.bio, 
                avatarUrl: finalAvatarUrl 
            })
        });
        
        const data = await res.json();

        // 3. Handle Response
        if (data.success) {
            setUser(data.user);
            setShowSettings(false);
            setNewAvatarFile(null);
            alert("Profile Updated Successfully!");
        } else {
            alert(`Update Failed: ${data.message || "Unknown error"}`);
        }
      } catch (e) {
          alert("Could not connect to server.");
      }
  };

  // --- ACTIONS ---
  const createServer = async () => { const name = prompt("Server Name"); if(name) { const res = await fetch(`${BACKEND_URL}/create-server`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId: user.id }) }); const d = await res.json(); if(d.success) { fetchServers(user.id); selectServer(d.server); }}};
  const createChannel = async () => { const name = prompt("Name"); const type = confirm("Voice?") ? "voice" : "text"; if(name) { await fetch(`${BACKEND_URL}/create-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, name, type }) }); selectServer(active.server); }};
  const addFriend = async () => { const usernameToAdd = prompt("Enter the exact username to add:"); if (!usernameToAdd) return; try { const res = await fetch(`${BACKEND_URL}/add-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, usernameToAdd }) }); const data = await res.json(); if (data.success) { alert(`Added ${data.newFriend.username} to friends!`); fetchFriends(user.id); } else { alert(data.message); } } catch (e) { alert("Could not connect to server."); }};

  // --- VOICE LOGIC (Standard) ---
  const joinVoiceRoom = useCallback((roomId: string) => {
    if (!user) return;
    socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal");
    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
      setInCall(true); setMyStream(stream); socket.emit("join_voice", { roomId, userData: user });
      socket.on("all_users", (users) => { const peersArr: any[] = []; users.forEach((u: any) => { const peer = createPeer(u.socketId, socket.id as string, stream, u.userData); peersRef.current.push({ peerID: u.socketId, peer, info: u.userData }); peersArr.push({ peerID: u.socketId, peer, info: u.userData }); }); setPeers(peersArr); });
      socket.on("user_joined", (payload) => { const item = peersRef.current.find(p => p.peerID === payload.callerID); if (item) { item.peer.signal(payload.signal); return; } const peer = addPeer(payload.signal, payload.callerID, stream); peersRef.current.push({ peerID: payload.callerID, peer, info: payload.userData }); setPeers(users => [...users, { peerID: payload.callerID, peer, info: payload.userData }]); });
      socket.on("receiving_returned_signal", (payload) => { const item = peersRef.current.find(p => p.peerID === payload.id); if (item) item.peer.signal(payload.signal); });
    }).catch(err => { console.error(err); alert("Mic access denied"); });
  }, [user]);

  const createPeer = (userToSignal: string, callerID: string, stream: MediaStream, userData: any) => { const peer = new Peer({ initiator: true, trickle: false, stream }); peer.on("signal", (signal: any) => socket.emit("sending_signal", { userToSignal, callerID, signal, userData: user })); return peer; };
  const addPeer = (incomingSignal: any, callerID: string, stream: MediaStream) => { const peer = new Peer({ initiator: false, trickle: false, stream }); peer.on("signal", (signal: any) => socket.emit("returning_signal", { signal, callerID })); peer.signal(incomingSignal); return peer; };
  const leaveCall = () => { if(isScreenSharing) stopScreenShare(); setInCall(false); setMyStream(null); setPeers([]); myStream?.getTracks().forEach(t => t.stop()); peersRef.current.forEach(p => p.peer.destroy()); peersRef.current = []; socket.emit("leave_voice"); };
  const startScreenShare = async () => { try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); setScreenStream(stream); setIsScreenSharing(true); const screenTrack = stream.getVideoTracks()[0]; peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if(pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if(sender) sender.replaceTrack(screenTrack); } }); screenTrack.onended = () => stopScreenShare(); } catch(e) { console.error(e); } };
  const stopScreenShare = () => { screenStream?.getTracks().forEach(t => t.stop()); setScreenStream(null); setIsScreenSharing(false); if(myStream) { const track = myStream.getVideoTracks()[0]; if(track) { peersRef.current.forEach((peerObj) => { const pc = (peerObj.peer as any)._pc; if(pc) { const sender = pc.getSenders().find((s: any) => s.track && s.track.kind === 'video'); if(sender) sender.replaceTrack(track); } }); } } };

  // --- LISTENERS ---
  useEffect(() => { 
      socket.on("receive_message", (msg) => setChatHistory(prev => [...prev, msg])); 
      socket.on("load_messages", (msgs) => setChatHistory(msgs)); 
      socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); });
      socket.on("user_updated", ({ userId }) => { 
          // If viewing the user that updated, refresh their profile
          if (viewingProfile && viewingProfile.id === userId) viewUserProfile(userId);
          // Refresh lists to show new avatars
          if (active.server) fetchServers(user.id);
          fetchFriends(user.id);
      });
      return () => { socket.off("receive_message"); socket.off("load_messages"); socket.off("voice_state_update"); socket.off("user_updated"); }; 
  }, [user, viewingProfile, active.server]);

  // 🌈 LOGIN SCREEN
  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-black overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-40 animate-pulse-slow"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]"></div>
      <GlassPanel className="p-10 rounded-[40px] w-[400px] text-center relative z-10 flex flex-col gap-6 ring-1 ring-white/10">
        <div className="w-20 h-20 rounded-[30px] bg-gradient-to-tr from-blue-500 to-purple-600 mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.4)] mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        </div>
        <div> <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">DaChat</h1> <p className="text-white/40 text-sm mt-2">Next Gen Communication</p> </div>
        {error && <div className="bg-red-500/20 text-red-200 text-xs py-3 rounded-xl border border-red-500/20">{error}</div>}
        <div className="space-y-3">
            <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20" placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
            <input className="w-full bg-black/30 border border-white/5 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-white/20" type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
        </div>
        <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-2xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-[1.02] transition-all active:scale-95">{isRegistering ? "Create Account" : "Enter Space"}</button>
        <p className="text-xs text-white/40 cursor-pointer hover:text-white transition-colors" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? "Back to Login" : "Create an Account"}</p>
      </GlassPanel>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-[#050505] to-[#000000] z-0"></div>
      <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[140px] z-0 animate-pulse-slow"></div>
      
      {/* 1. DOCK */}
      <div className="z-30 w-[90px] h-full flex flex-col items-center py-8 gap-4 fixed left-0 top-0">
        <GlassPanel onClick={() => { setView("dms"); setActive({server:null,friend:null,channel:null}); }} className={`w-[56px] h-[56px] rounded-[24px] flex items-center justify-center cursor-pointer transition-all duration-300 group ${view === 'dms' ? "bg-blue-600/80 border-blue-400/50 shadow-[0_0_30px_rgba(37,99,235,0.4)]" : "hover:bg-white/10"}`}> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> </GlassPanel>
        <div className="w-10 h-[2px] bg-white/10 rounded-full" />
        <div className="flex-1 w-full flex flex-col items-center gap-4 overflow-y-auto no-scrollbar pb-4 px-2">
            {servers.map(s => (
                <div key={s.id} onClick={() => selectServer(s)} className="group relative w-full flex justify-center cursor-pointer">
                    {active.server?.id === s.id && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-[0_0_15px_white]" />}
                    <GlassPanel className={`w-[56px] h-[56px] rounded-[24px] flex items-center justify-center transition-all duration-300 ${active.server?.id === s.id ? "bg-gradient-to-br from-blue-600 to-purple-600 border-white/20 rounded-[20px]" : "hover:bg-white/10 hover:rounded-[20px]"}`}> <span className="font-bold text-sm tracking-wider">{s.name.substring(0, 2).toUpperCase()}</span> </GlassPanel>
                </div>
            ))}
            <div onClick={createServer} className="w-[56px] h-[56px] rounded-[24px] border border-dashed border-white/20 flex items-center justify-center cursor-pointer text-white/40 hover:text-white hover:border-white/60 hover:bg-white/5 transition-all"> <span className="text-2xl font-light">+</span> </div>
        </div>
        <div className="mb-4"> <UserAvatar onClick={openSettings} src={user.avatar_url} className="w-12 h-12 rounded-[20px] ring-2 ring-white/10 hover:ring-white/30 transition-all cursor-pointer" /> </div>
      </div>

      {/* 2. SIDEBAR */}
      <div className="relative z-10 w-[280px] ml-[90px] h-screen py-4">
        <GlassPanel className="w-full h-full rounded-[40px] flex flex-col overflow-hidden ring-1 ring-white/5">
            <div className="h-20 flex items-center px-8 font-bold text-white tracking-wide border-b border-white/5 bg-white/[0.02]"> {active.server ? active.server.name : "Direct Messages"} </div>
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-1">
                {view === "servers" && active.server ? (
                    <>
                        <div className="flex justify-between items-center px-4 py-4 text-[11px] font-bold text-white/40 uppercase tracking-widest"> <span>Channels</span> <button onClick={createChannel} className="text-lg hover:text-white transition-colors">+</button> </div>
                        {channels.map(ch => ( <div key={ch.id} onClick={() => joinChannel(ch)} className={`group px-4 py-3 rounded-[20px] cursor-pointer flex items-center justify-between transition-all ${active.channel?.id === ch.id ? "bg-white/10 text-white shadow-lg backdrop-blur-md" : "text-white/50 hover:bg-white/5 hover:text-white"}`}> <div className="flex items-center gap-3"> <span className="text-lg opacity-50">{ch.type==='voice' ? '🔊' : '#'}</span> <span className="text-[14px] font-medium">{ch.name}</span> </div> {ch.type === 'voice' && voiceStates[ch.id]?.length > 0 && ( <div className="flex -space-x-2"> {voiceStates[ch.id].map(uid => <UserAvatar key={uid} src={serverMembers.find(m=>m.id===uid)?.avatar_url} className="w-5 h-5 rounded-full border border-black" />)} </div> )} </div> ))}
                    </>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-4 py-4 text-[11px] font-bold text-white/40 uppercase tracking-widest"> <span>Direct Messages</span> <button onClick={addFriend} className="text-lg hover:text-white transition-colors">+</button> </div>
                        {friends.map(f => ( <div key={f.id} className={`p-3 rounded-[24px] flex items-center gap-4 transition-all ${active.friend?.id === f.id ? "bg-white/10 shadow-lg" : "hover:bg-white/5"}`}> <UserAvatar onClick={(e:any) => { e.stopPropagation(); viewUserProfile(f.id); }} src={f.avatar_url} className="w-10 h-10 rounded-[16px]" /> <div className="cursor-pointer flex-1" onClick={() => selectFriend(f)}><div className="text-sm font-bold text-white/90">{f.username}</div><div className="text-[10px] text-white/40">Online</div></div> </div> ))}
                    </>
                )}
            </div>
        </GlassPanel>
      </div>

      {/* 3. CHAT */}
      <div className="flex-1 h-screen relative z-10 p-4 pl-0 min-w-0">
         <GlassPanel className="w-full h-full rounded-[40px] flex flex-col relative overflow-hidden ring-1 ring-white/5">
            {(active.channel || active.friend) && ( <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-white/[0.02]"> <div className="flex items-center gap-4"> <span className="text-2xl text-white/30 font-light">@</span> <span className="text-lg font-bold tracking-wide cursor-pointer hover:underline" onClick={() => active.friend ? viewUserProfile(active.friend.id) : null}>{active.channel ? active.channel.name : active.friend?.username}</span> </div> {!active.channel && active.friend && ( <button onClick={() => { socket.emit("send_message", { content: "📞 Starting call...", senderId: user.id, recipientId: active.friend.id }); joinVoiceRoom(`dm-${[user.id, active.friend.id].sort().join('-')}-call`); }} className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white flex items-center justify-center transition-all"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> </button> )} </div> )}
            {inCall ? (
                <div className="flex-1 flex flex-col items-center justify-center relative p-8 gap-6">
                    <div className="grid grid-cols-2 gap-6 w-full h-full max-w-5xl">
                         <div className="relative rounded-[32px] overflow-hidden bg-black/40 border border-white/10 group"> {isScreenSharing ? <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : <div className="absolute inset-0 flex flex-col items-center justify-center"><UserAvatar src={user.avatar_url} className="w-24 h-24 rounded-[32px]" /><span className="mt-4 font-bold">You</span></div>} <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={startScreenShare} className="p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20">🖥️</button> </div> </div>
                         {peers.map(p => ( <div key={p.peerID} className="relative rounded-[32px] overflow-hidden bg-black/40 border border-white/10"> <MediaPlayer peer={p.peer} /> </div> ))}
                    </div>
                    <button onClick={leaveCall} className="px-8 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full font-bold shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all">End Call</button>
                </div>
            ) : (active.channel || active.friend) ? (
                <>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        {chatHistory.map((msg, i) => ( <div key={msg.id || i} className={`flex gap-4 group ${msg.sender_id === user.id ? "flex-row-reverse" : ""}`}> <UserAvatar onClick={() => viewUserProfile(msg.sender_id)} src={msg.avatar_url} className="w-10 h-10 rounded-[16px] shadow-lg" /> <div className={`max-w-[60%] flex flex-col ${msg.sender_id === user.id ? "items-end" : "items-start"}`}> <div className="flex items-center gap-2 mb-1 px-1"> <span className="text-[12px] font-bold text-white/50 cursor-pointer hover:text-white" onClick={() => viewUserProfile(msg.sender_id)}>{msg.sender_name}</span> </div> <div className={`px-5 py-3 rounded-[24px] text-[15px] leading-relaxed relative ${ msg.sender_id === user.id ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)] rounded-tr-sm" : "bg-white/10 text-white/90 backdrop-blur-md border border-white/5 rounded-tl-sm" }`}> {msg.content?.startsWith("http") ? <img src={msg.content} className="max-w-[300px] rounded-xl" /> : msg.content} </div> {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-[300px] rounded-[24px] border border-white/10" />} </div> </div> ))}
                    </div>
                    <div className="p-6 relative">
                        {showGifPicker && <GifPicker onSelect={(url:string) => { sendMessage(null, url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
                        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] p-2 flex items-center gap-2 shadow-2xl relative z-20 transition-all focus-within:ring-1 focus-within:ring-white/20 focus-within:bg-white/10"> <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors" onClick={() => fileInputRef.current?.click()}>📎</button> <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[10px] font-black text-white/50 transition-colors" onClick={() => setShowGifPicker(!showGifPicker)}>GIF</button> <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} /> <input className="flex-1 bg-transparent border-none outline-none text-white px-2 placeholder-white/20 font-medium" placeholder="Type a message..." value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(message)} /> <button onClick={() => sendMessage(message)} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all transform active:scale-90"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg> </button> </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-white/20"> <div className="w-32 h-32 rounded-[40px] border-4 border-white/5 flex items-center justify-center mb-6"> <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> </div> <p className="font-light tracking-widest uppercase">Select a channel</p> </div>
            )}
         </GlassPanel>
      </div>

      {/* 4. MEMBER LIST (Right Panel) */}
      {view === "servers" && active.server && (
          <div className="w-[260px] p-4 h-screen z-10 hidden xl:block">
              <GlassPanel className="w-full h-full rounded-[40px] flex flex-col p-4 ring-1 ring-white/5">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-6 px-2">Members — {serverMembers.length}</div>
                  <div className="space-y-2 overflow-y-auto custom-scrollbar">
                      {serverMembers.map(m => ( <div key={m.id} onClick={() => viewUserProfile(m.id)} className="flex items-center gap-3 p-2 rounded-[16px] hover:bg-white/5 cursor-pointer transition-colors"> <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-[12px]" /> <span className={`text-sm font-bold ${m.id===active.server.owner_id ? "text-yellow-500" : "text-white/70"}`}>{m.username}</span> </div> ))}
                  </div>
              </GlassPanel>
          </div>
      )}

      {/* 👤 VIEW PROFILE MODAL */}
      {viewingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingProfile(null)}>
              <GlassPanel className="w-[400px] p-8 flex flex-col items-center relative" onClick={(e:any) => e.stopPropagation()}>
                    <button onClick={() => setViewingProfile(null)} className="absolute top-5 right-5 text-white/30 hover:text-white transition-colors">✕</button>
                    <UserAvatar src={viewingProfile.avatar_url} className="w-32 h-32 rounded-full border-4 border-white/10 shadow-2xl mb-4" />
                    <h2 className="text-2xl font-bold">{viewingProfile.username}</h2>
                    <span className="text-white/40 text-sm mb-6">#{viewingProfile.discriminator || "0000"}</span>
                    <div className="w-full bg-white/5 p-4 rounded-2xl border border-white/10">
                        <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">About</h3>
                        <p className="text-white/80 text-sm leading-relaxed">{viewingProfile.bio || "No bio yet."}</p>
                    </div>
              </GlassPanel>
          </div>
      )}

      {/* ⚙️ EDIT SETTINGS MODAL */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <GlassPanel className="w-[450px] p-8 flex flex-col relative">
                  <h2 className="text-xl font-bold mb-6">Edit Profile</h2>
                  <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="relative group cursor-pointer" onClick={() => (document.getElementById('avatarUpload') as any).click()}>
                          {/* 🖼️ AVATAR DISPLAY (Supports GIFs) */}
                          <UserAvatar src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : editForm.avatarUrl} className="w-24 h-24 rounded-full border-2 border-white/10 group-hover:border-white/50 transition-all" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all text-xs font-bold">CHANGE</div>
                      </div>
                      
                      {/* 🔥 NEW GIF BUTTON */}
                      <button 
                        onClick={() => setShowProfileGifPicker(!showProfileGifPicker)} 
                        className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white/70 font-bold border border-white/5 transition-all"
                      >
                        CHOOSE GIF
                      </button>

                      <input id="avatarUpload" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setNewAvatarFile(e.target.files[0])} />
                  </div>

                  {/* 🔥 GIF PICKER IN SETTINGS */}
                  {showProfileGifPicker && (
                    <div className="absolute inset-0 z-50 bg-[#0e0e0f] rounded-[32px] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <span className="font-bold text-sm">Select GIF</span>
                            <button onClick={() => setShowProfileGifPicker(false)}>✕</button>
                        </div>
                        <div className="flex-1 relative">
                            {/* Reusing existing GIF picker logic but scoped locally */}
                            <GifPicker 
                                onSelect={(url: string) => {
                                    setEditForm({ ...editForm, avatarUrl: url });
                                    setNewAvatarFile(null); // Clear manual upload
                                    setShowProfileGifPicker(false);
                                }} 
                                onClose={() => setShowProfileGifPicker(false)} 
                            />
                        </div>
                    </div>
                  )}

                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-white/40 uppercase ml-1">Username</label>
                          <input className="w-full bg-black/30 border border-white/10 text-white px-4 py-3 rounded-xl mt-1 focus:outline-none focus:border-white/30" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-white/40 uppercase ml-1">Bio</label>
                          <textarea className="w-full bg-black/30 border border-white/10 text-white px-4 py-3 rounded-xl mt-1 focus:outline-none focus:border-white/30 resize-none h-24" value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} placeholder="Tell us about yourself..." />
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
                      <button onClick={saveProfile} className="px-6 py-2 bg-white text-black rounded-lg font-bold hover:bg-gray-200">Save</button>
                  </div>
              </GlassPanel>
          </div>
      )}

    </div>
  );
}

// VIDEO COMPONENT
const MediaPlayer = ({ peer }: any) => {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        peer.on("stream", (stream: MediaStream) => { if (ref.current) ref.current.srcObject = stream; });
    }, [peer]);
    return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />;
};