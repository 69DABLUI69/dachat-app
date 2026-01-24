"use client";
import { useEffect, useState, useRef, memo } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";

// ⚠️ POLYFILL FOR SIMPLE-PEER
if (typeof window !== 'undefined') { 
    (window as any).global = window; 
    (window as any).process = { env: { DEBUG: undefined }, }; 
    (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; 
}

// 🔑 CONFIG
const KLIPY_API_KEY = "YOUR_KLIPY_API_KEY_HERE"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";

// 🌐 DYNAMIC BACKEND URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const socket = io(BACKEND_URL);

// 🔥 MEMOIZED AVATAR
const UserAvatar = memo(({ src, alt, className, fallbackClass }: any) => {
  return src ? (
    <img src={src} alt={alt || "User"} className={`${className} bg-black`} loading="eager" />
  ) : (
    <div className={`${className} ${fallbackClass || "bg-zinc-800"} flex items-center justify-center`}>
       <span className="text-[10px] text-zinc-400 font-bold opacity-50">?</span>
    </div>
  );
});
UserAvatar.displayName = "UserAvatar";

// 🔥 KLIPY GIF PICKER
const GifPicker = ({ onSelect, onClose }: any) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query 
        ? `${KLIPY_BASE_URL}/search?q=${query}&key=${KLIPY_API_KEY}&limit=20`
        : `${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) { console.error("Klipy API Error", err); }
    setLoading(false);
  };

  useEffect(() => { fetchGifs(""); }, []);

  const getGifUrl = (item: any) => item?.files?.gif?.url || item?.media_formats?.gif?.url || "";
  const getPreviewUrl = (item: any) => item?.files?.tinygif?.url || item?.media_formats?.tinygif?.url || getGifUrl(item);

  return (
    <div className="absolute bottom-24 left-4 w-[400px] h-[500px] bg-[#18181b] border border-white/20 rounded-[24px] shadow-2xl flex flex-col z-50 animate-scale-up overflow-hidden ring-1 ring-black">
      <div className="p-4 border-b border-white/10 flex gap-3 items-center bg-[#202023]">
        <input 
          className="flex-1 bg-black/40 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none border border-white/10"
          placeholder="Search GIFs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchGifs(search)}
          autoFocus
        />
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-300">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#18181b]">
        {loading ? <div className="text-center text-zinc-500 text-xs mt-10">LOADING...</div> : (
          <div className="columns-2 gap-3 space-y-3">
            {gifs.map((g) => (
              <div key={g.id} className="cursor-pointer border border-transparent hover:border-blue-500 rounded-xl overflow-hidden" onClick={() => onSelect(getGifUrl(g))}>
                <img src={getPreviewUrl(g)} className="w-full h-auto object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [serverMembers, setServerMembers] = useState<any[]>([]);

  const [view, setView] = useState("dms");
  const [active, setActive] = useState<any>({ server: null, channel: null, friend: null });
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newAvatar, setNewAvatar] = useState<File | null>(null);

  // Voice & Video
  const [inCall, setInCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null); 
  const peersRef = useRef<any[]>([]);
  const [voiceStates, setVoiceStates] = useState<Record<string, number[]>>({});
  const [maximizedContent, setMaximizedContent] = useState<{ stream: MediaStream, type: 'local' | 'remote' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);

  // --- AUTH & SETUP ---
  const handleAuth = async () => {
    const endpoint = isRegistering ? "register" : "login";
    try {
      const res = await fetch(`${BACKEND_URL}/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user); setError("");
        fetchServers(data.user.id); fetchFriends(data.user.id);
      } else { setError(data.message || "Auth failed"); }
    } catch { setError("Connection failed"); }
  };

  const fetchServers = async (id: number) => {
    const res = await fetch(`${BACKEND_URL}/my-servers/${id}`);
    const data = await res.json();
    setServers(data);
  };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`${BACKEND_URL}/my-friends/${id}`)).json());
  const fetchMembers = async (serverId: number) => {
    const res = await fetch(`${BACKEND_URL}/servers/${serverId}/members`);
    setServerMembers(await res.json());
  };

  const selectServer = async (server: any) => {
    setView("servers");
    setActive({ ...active, server, friend: null });
    const res = await fetch(`${BACKEND_URL}/servers/${server.id}/channels`);
    const data = await res.json();
    setChannels(data);
    const textChannels = data.filter((c: any) => c.type === 'text');
    if (textChannels.length > 0) joinChannel(textChannels[0]);
    fetchMembers(server.id);
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

  const goToHome = () => { setView("dms"); setActive({ server: null, channel: null, friend: null }); setChatHistory([]); fetchFriends(user.id); };
  const selectFriend = (friend: any) => {
    setActive((prev: any) => ({ ...prev, friend, channel: null }));
    setChatHistory([]);
    const ids = [user.id, friend.id].sort((a, b) => a - b);
    socket.emit("join_room", { roomId: `dm-${ids[0]}-${ids[1]}` });
  };

  // --- VOICE LOGIC (WITH GHOST FIX) ---
  const joinVoiceRoom = (roomId: string) => {
    if (!user) return;
    socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal");

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
      setInCall(true);
      setMyStream(stream);
      socket.emit("join_voice", { roomId, userData: user });

      socket.on("all_users", (users) => {
        const peersArr: any[] = [];
        users.forEach((u: any) => {
          // 👻 GHOST FIX: Don't connect to myself
          if (u.userData.id === user.id) return;
          const peer = createPeer(u.socketId, socket.id as string, stream, u.userData);
          peersRef.current.push({ peerID: u.socketId, peer, info: u.userData });
          peersArr.push({ peerID: u.socketId, peer, info: u.userData });
        });
        setPeers(peersArr);
      });

      socket.on("user_joined", (payload) => {
        // 👻 GHOST FIX: Reject duplicates
        if (payload.userData.id === user.id) return;
        
        if (peersRef.current.find(p => p.peerID === payload.callerID)) {
             peersRef.current.find(p => p.peerID === payload.callerID).peer.signal(payload.signal);
             return;
        }
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({ peerID: payload.callerID, peer, info: payload.userData });
        setPeers(users => [...users, { peerID: payload.callerID, peer, info: payload.userData }]);
      });

      socket.on("receiving_returned_signal", (payload) => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });
    }).catch(err => { console.error("Mic Error:", err); alert("Could not access microphone."); });
  };

  const createPeer = (userToSignal: string, callerID: string, stream: MediaStream, userData: any) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on("signal", (signal: any) => socket.emit("sending_signal", { userToSignal, callerID, signal, userData: user }));
    return peer;
  };
  const addPeer = (incomingSignal: any, callerID: string, stream: MediaStream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on("signal", (signal: any) => socket.emit("returning_signal", { signal, callerID }));
    peer.signal(incomingSignal);
    return peer;
  };

  // 🔥 SCREEN SHARE (NUCLEAR FIX)
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      setScreenStream(stream);
      setIsScreenSharing(true);

      // FORCE REPLACE TRACK (Direct Sender)
      peersRef.current.forEach((peerObj) => {
        const peer = peerObj.peer;
        if (peer._pc) {
            const sender = peer._pc.getSenders().find((s: any) => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
        }
      });
      screenTrack.onended = () => stopScreenShare();
    } catch (err) { console.error("Screen share failed", err); }
  };

  const stopScreenShare = () => {
    if (!screenStream) return;
    screenStream.getTracks().forEach(track => track.stop());
    setScreenStream(null);
    setIsScreenSharing(false);
    setMaximizedContent(null);

    if (myStream) {
        const cameraTrack = myStream.getVideoTracks()[0];
        peersRef.current.forEach((peerObj) => {
            const peer = peerObj.peer;
            if (peer._pc) {
                const sender = peer._pc.getSenders().find((s: any) => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(cameraTrack);
            }
        });
    }
  };

  useEffect(() => {
    if (myVideoRef.current && screenStream) {
        myVideoRef.current.srcObject = screenStream;
        myVideoRef.current.muted = true; 
        myVideoRef.current.play().catch(e => console.error("Local play error", e));
    }
  }, [screenStream]);

  const leaveCall = () => {
    if (isScreenSharing) stopScreenShare();
    setInCall(false);
    setMaximizedContent(null);
    myStream?.getTracks().forEach(track => track.stop());
    setMyStream(null);
    setPeers([]);
    peersRef.current = [];
    socket.emit("leave_voice");
  };

  const startDMCall = () => {
    const ids = [user.id, active.friend.id].sort((a, b) => a - b);
    joinVoiceRoom(`dm-call-${ids[0]}-${ids[1]}`);
  };

  // --- ACTIONS ---
  const addFriend = async () => { const f = prompt("Enter Name#1234"); if (f) { await fetch(`${BACKEND_URL}/add-friend`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ myId: user.id, friendString: f }) }); fetchFriends(user.id); }};
  const createServer = async () => { const n = prompt("Server Name"); if (n) { const res = await fetch(`${BACKEND_URL}/create-server`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: n, ownerId: user.id }) }); const d = await res.json(); if(d.success) { fetchServers(user.id); selectServer(d.server); }}};
  const createChannel = async () => { const n = prompt("Channel Name"); const t = confirm("Voice Channel?") ? "voice" : "text"; if (n) { await fetch(`${BACKEND_URL}/create-channel`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ serverId: active.server.id, name: n, type: t }) }); selectServer(active.server); }};
  const inviteUser = async () => { const u = prompt("Invite user (Name#1234):"); if(u) fetch(`${BACKEND_URL}/servers/invite`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ serverId: active.server.id, userString: u }) }); };
  const leaveServer = async () => { if(confirm("Leave server?")) { await fetch(`${BACKEND_URL}/servers/leave`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ serverId: active.server.id, userId: user.id }) }); setServers(prev => prev.filter(s => s.id !== active.server.id)); goToHome(); }};

  // --- SETTINGS ---
  const openSettings = () => { setNewUsername(user.username); setNewBio(user.bio || ""); setNewAvatar(null); setShowSettings(true); };
  const viewUserProfile = async (userId: number) => { const res = await fetch(`${BACKEND_URL}/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };
  const handleUpdateProfile = async () => {
    let avatarUrl = user.avatar_url;
    if (newAvatar) {
      const formData = new FormData(); formData.append("file", newAvatar);
      try { const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.success) avatarUrl = data.fileUrl; } catch {}
    }
    const res = await fetch(`${BACKEND_URL}/update-profile`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: user.id, username: newUsername, avatarUrl, bio: newBio }) });
    const data = await res.json();
    if (data.success) { setUser(data.user); setShowSettings(false); }
  };

  const handleFileUpload = async (e: any) => { const file = e.target.files[0]; if(!file)return; setIsUploading(true); const formData = new FormData(); formData.append("file", file); const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if(data.success) sendMessage(null, data.fileUrl); setIsUploading(false); };
  const sendMessage = (textMsg: string | null = null, fileUrl: string | null = null) => { 
      const content = textMsg || (fileUrl ? "Sent an image" : ""); 
      const payload: any = { content, senderId: user.id, senderName: `${user.username}#${user.discriminator}`, fileUrl }; 
      if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } 
      else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } 
      setMessage(""); 
  };

  useEffect(() => { 
      socket.on("receive_message", (msg) => setChatHistory(prev => [...prev, msg])); 
      socket.on("load_messages", (msgs) => setChatHistory(msgs));
      
      // 🧹 CLEANUP ON REFRESH
      const handleBeforeUnload = () => { socket.emit("leave_voice"); };
      window.addEventListener("beforeunload", handleBeforeUnload);
      
      return () => { 
          socket.off("receive_message"); socket.off("load_messages"); 
          window.removeEventListener("beforeunload", handleBeforeUnload);
      }; 
  }, []);
  
  useEffect(() => { if (user) socket.emit("setup", user.id); }, [user]);
  useEffect(() => { socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); }); return () => { socket.off("voice_state_update"); }; }, []);

  // --- RENDER LOGIN ---
  if (!user) return ( 
    <div className="flex h-screen items-center justify-center bg-[#050505] text-white"> 
      <div className="bg-[#121212] border border-white/10 p-10 rounded-[24px] w-[380px] text-center shadow-2xl"> 
        <h1 className="text-2xl font-bold mb-6">DaChat</h1>
        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
        <div className="space-y-3">
            <input className="w-full bg-[#0a0a0a] border border-white/10 px-4 py-3 rounded-lg" placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} /> 
            <input className="w-full bg-[#0a0a0a] border border-white/10 px-4 py-3 rounded-lg" type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /> 
        </div>
        <button onClick={handleAuth} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold mt-4">{isRegistering ? "Create Account" : "Enter"}</button> 
        <p className="text-xs text-zinc-500 mt-4 cursor-pointer" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? "Already have an account?" : "Need an account?"}</p> 
      </div> 
    </div> 
  );

  const canModerate = active.server && (user.id === active.server.owner_id || serverMembers.find(m => m.id === user.id)?.is_admin);

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-200 font-sans overflow-hidden">
      {/* 1. DOCK */}
      <div className="w-[80px] flex flex-col items-center py-6 gap-3 bg-[#080808] border-r border-white/10 flex-shrink-0">
        <div onClick={goToHome} className={`w-[50px] h-[50px] rounded-2xl flex items-center justify-center cursor-pointer transition-all ${view === 'dms' ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800"}`}>🏠</div>
        <div className="w-8 h-[1px] bg-white/10 rounded-full mb-3" />
        <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto no-scrollbar">
        {servers.map(s => ( 
            <div key={s.id} onClick={() => selectServer(s)} className={`w-[50px] h-[50px] rounded-2xl flex items-center justify-center cursor-pointer transition-all border ${active.server?.id === s.id ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"}`}> 
                <span className="font-bold text-sm">{s.name.substring(0, 2).toUpperCase()}</span> 
            </div> 
        ))}
        <div onClick={createServer} className="w-[50px] h-[50px] rounded-2xl border border-dashed border-zinc-700 flex items-center justify-center cursor-pointer text-zinc-600 hover:text-green-500 text-2xl">+</div>
        </div>
      </div>

      {/* 2. SIDEBAR */}
      <div className="w-[260px] bg-[#111111] flex flex-col border-r border-white/10 flex-shrink-0">
        <div className="h-16 flex items-center px-5 font-bold text-white border-b border-white/10"> {active.server ? active.server.name : "Messages"} </div>
        <div className="flex-1 p-3 overflow-y-auto">
          {view === "servers" && active.server ? (
            <>
              <div className="flex justify-between px-2 pb-2 pt-4 text-[10px] font-bold text-zinc-500 uppercase"> <span>Channels</span> <button onClick={createChannel}>+</button> </div>
              {channels.map(ch => (
                  <div key={ch.id} className={`px-3 py-2 rounded-lg cursor-pointer flex flex-col ${active.channel?.id === ch.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"}`} onClick={() => joinChannel(ch)}>
                    <div className="flex items-center gap-2">
                        <span>{ch.type === 'voice' ? '🔊' : '#'}</span> <span>{ch.name}</span>
                    </div>
                    {/* Voice Avatars */}
                    {ch.type === 'voice' && voiceStates[ch.id]?.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 ml-6">
                            {voiceStates[ch.id].map(uid => <UserAvatar key={uid} src={serverMembers.find(m => m.id === uid)?.avatar_url} className="w-5 h-5 rounded-full" />)}
                        </div>
                    )}
                  </div>
              ))}
            </>
          ) : (
            <>
              <button onClick={addFriend} className="w-full bg-[#18181b] hover:bg-[#202023] text-zinc-300 border border-white/10 text-xs py-2 rounded mb-6">Find Friends</button>
              {friends.map(f => (
                <div key={f.id} onClick={() => selectFriend(f)} className={`px-3 py-2 rounded-lg cursor-pointer flex gap-3 items-center ${active.friend?.id === f.id ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}>
                  <UserAvatar src={f.avatar_url} className="w-8 h-8 rounded-full" />
                  <span>{f.username}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="p-3 bg-[#111111] border-t border-white/10 flex items-center justify-between cursor-pointer hover:bg-zinc-800 rounded" onClick={openSettings}>
            <div className="flex items-center gap-2">
              <UserAvatar src={user.avatar_url} className="w-8 h-8 rounded-full" />
              <div className="text-xs"> <div className="font-bold text-white">{user.username}</div> <div className="text-zinc-500">#{user.discriminator}</div> </div>
            </div>
            <span>⚙️</span>
        </div>
      </div>

      {/* 3. CHAT / VIDEO AREA */}
      <div className="flex-1 bg-[#050505] flex flex-col min-w-0 relative">
        {(active.channel || active.friend) ? (
          <>
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a] z-10 sticky top-0">
              <span className="font-bold text-white">{active.channel ? (active.channel.type==='voice'? '🔊 '+active.channel.name : '# '+active.channel.name) : '@ '+active.friend.username}</span>
              {!active.channel && <div onClick={startDMCall} className="bg-green-600 p-2 rounded-full cursor-pointer">📞</div>}
            </div>

            {/* MAXIMIZED VIDEO */}
            {maximizedContent && (
                <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center">
                    <button onClick={() => setMaximizedContent(null)} className="absolute top-8 right-8 text-white p-3 rounded-full bg-zinc-800">✕</button>
                    <video ref={node => { if(node) { node.srcObject = maximizedContent.stream; node.muted = (maximizedContent.type === 'local'); node.play().catch(()=>{}); } }} autoPlay playsInline className="h-[90%] w-[90%] object-contain" />
                </div>
            )}

            {inCall ? (
              <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 relative">
                <div className="grid grid-cols-2 gap-6 w-full max-w-5xl h-full">
                  {/* MY VIDEO */}
                  <div className="bg-[#111111] rounded-xl flex items-center justify-center relative overflow-hidden border border-white/10"> 
                    {isScreenSharing ? <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" /> 
                    : <div className="flex flex-col items-center">
                        <UserAvatar src={user.avatar_url} className="w-24 h-24 rounded-full mb-4 border-4 border-zinc-800" />
                        <span className="font-bold">You</span>
                      </div>}
                    {isScreenSharing ? <button onClick={() => stopScreenShare()} className="absolute top-4 right-4 bg-red-600 text-xs px-3 py-1 rounded">Stop</button>
                     : <button onClick={startScreenShare} className="absolute bottom-4 right-4 bg-zinc-800 text-xs px-3 py-1 rounded">Share Screen</button>}
                  </div>
                  {/* PEERS */}
                  {peers.map((p, i) => <MediaPlayer key={i} peer={p.peer} userInfo={p.info} onMaximize={(s:any) => setMaximizedContent({stream:s, type:'remote'})} />)}
                </div>
                <button onClick={leaveCall} className="absolute bottom-10 bg-red-600 px-6 py-3 rounded-xl font-bold">Leave Call</button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className="flex gap-4">
                      <UserAvatar src={msg.avatar_url} className="w-10 h-10 rounded-full cursor-pointer" onClick={() => viewUserProfile(msg.sender_id)} />
                      <div>
                        <div className="flex items-baseline gap-2"> <span className="font-bold text-zinc-200 cursor-pointer" onClick={() => viewUserProfile(msg.sender_id)}>{msg.sender_name}</span> <span className="text-xs text-zinc-500">Today</span> </div>
                        {msg.content && (msg.content.startsWith("http") && (msg.content.includes("tenor") || msg.content.includes("klipy")) ? <img src={msg.content} className="rounded-lg max-w-sm mt-2" /> : <p className="text-zinc-300">{msg.content}</p>)}
                        {msg.file_url && <img src={msg.file_url} className="mt-2 max-w-sm rounded-lg border border-white/10" />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-[#050505] relative"> 
                  {showGifPicker && <GifPicker onSelect={(url:string) => { sendMessage(null, url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
                  <div className="bg-[#121212] border border-white/15 rounded-xl px-3 py-2 flex items-center gap-3"> 
                    <div className="text-zinc-400 cursor-pointer text-xl" onClick={() => fileInputRef.current?.click()}>+</div> 
                    <div className="bg-zinc-800 text-[10px] px-2 py-1 rounded cursor-pointer font-bold" onClick={() => setShowGifPicker(!showGifPicker)}>GIF</div> 
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" /> 
                    <input className="bg-transparent flex-1 outline-none text-zinc-200 placeholder-zinc-500" placeholder={`Message...`} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(message)} disabled={isUploading} /> 
                  </div> 
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest">No Server Selected</div>
        )}
      </div>

      {/* 4. MEMBER LIST (Layout Fix) */}
      {view === "servers" && active.server && (
        <div className="w-[240px] bg-[#111111] flex flex-col border-l border-white/10 flex-shrink-0">
          <div className="h-16 flex items-center px-6 font-bold text-zinc-500 text-xs uppercase tracking-widest border-b border-white/10">Members — {serverMembers.length}</div>
          <div className="flex-1 p-4 overflow-y-auto">
             <div className="flex gap-2 mb-4">
                <button onClick={inviteUser} className="flex-1 bg-zinc-800 text-xs py-2 rounded">Invite</button>
                <button onClick={leaveServer} className="flex-1 bg-red-900/20 text-red-400 text-xs py-2 rounded">Leave</button>
             </div>
             {serverMembers.map(m => (
               <div key={m.id} className="flex items-center gap-3 mb-2 p-2 rounded hover:bg-zinc-800 cursor-pointer" onClick={() => viewUserProfile(m.id)}>
                 <UserAvatar src={m.avatar_url} className="w-8 h-8 rounded-full" />
                 <div><div className={`text-sm font-bold ${m.id === active.server.owner_id ? "text-yellow-500" : "text-zinc-300"}`}>{m.username}</div><div className="text-[10px] text-zinc-500">#{m.discriminator}</div></div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#18181b] w-96 rounded-xl border border-white/10 p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Edit Profile</h2>
            <div className="flex justify-center" onClick={() => avatarInputRef.current?.click()}>
                 {newAvatar ? <img src={URL.createObjectURL(newAvatar)} className="w-20 h-20 rounded-full object-cover border-2 border-blue-500" /> : <UserAvatar src={user.avatar_url} className="w-20 h-20 rounded-full border-2 border-zinc-700" />}
                 <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && setNewAvatar(e.target.files[0])} />
            </div>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full bg-black p-3 rounded border border-white/10 text-white" />
            <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} rows={3} className="w-full bg-black p-3 rounded border border-white/10 text-white" />
            <div className="flex justify-end gap-2"> <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded text-xs bg-zinc-800">Cancel</button> <button onClick={handleUpdateProfile} className="px-4 py-2 rounded text-xs bg-white text-black font-bold">Save</button> </div>
          </div>
        </div>
      )}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setViewingProfile(null)}>
          <div className="bg-[#18181b] w-80 rounded-xl border border-white/10 p-6 text-center" onClick={e=>e.stopPropagation()}>
            <UserAvatar src={viewingProfile.avatar_url} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-800" />
            <h2 className="text-xl font-bold">{viewingProfile.username}</h2>
            <p className="text-zinc-500 text-xs">#{viewingProfile.discriminator}</p>
            <div className="mt-4 bg-black/50 p-4 rounded text-sm text-zinc-300">{viewingProfile.bio || "No bio."}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🔥 PLAYER (Fixed: Refresh on swap)
const MediaPlayer = ({ peer, userInfo, onMaximize }: any) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    peer.on("stream", (stream: MediaStream) => {
        if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(()=>{}); }
        setHasVideo(stream.getVideoTracks().length > 0);
        const vidTrack = stream.getVideoTracks()[0];
        if (vidTrack) vidTrack.onunmute = () => { if(ref.current) { ref.current.srcObject = stream; ref.current.play(); }};
        stream.onaddtrack = () => setHasVideo(stream.getVideoTracks().length > 0);
    });
  }, [peer]);

  return (
    <div className="relative w-full h-full bg-[#111] rounded-xl overflow-hidden group border border-white/10 flex items-center justify-center">
        {hasVideo ? (
            <>
            <video ref={ref} autoPlay playsInline className="w-full h-full object-contain bg-black" />
            <button onClick={() => onMaximize(ref.current?.srcObject)} className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">VIEW</button>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{userInfo?.username}</div>
            </>
        ) : (
            <div className="flex flex-col items-center">
                <UserAvatar src={userInfo?.avatar_url} className="w-20 h-20 rounded-full border-4 border-blue-900/50 mb-2" />
                <span className="font-bold">{userInfo?.username}</span>
            </div>
        )}
    </div>
  );
};