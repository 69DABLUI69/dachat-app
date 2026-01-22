"use client";
import { useEffect, useState, useRef, memo } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";

// ⚠️ POLYFILL FOR SIMPLE-PEER
if (typeof window !== 'undefined') { (window as any).global = window; (window as any).process = { env: { DEBUG: undefined }, }; (window as any).Buffer = (window as any).Buffer || require("buffer").Buffer; }

// 🔑 REPLACE WITH YOUR REAL KLIPY API KEY
const KLIPY_API_KEY = "YOUR_KLIPY_API_KEY_HERE"; 
const KLIPY_BASE_URL = "https://api.klipy.com/v2";

// If we are in production, use the environment variable. Otherwise, use localhost.
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

// 🔥 KLIPY GIF PICKER (Manual Fetch Implementation)
const GifPicker = ({ onSelect, onClose }: any) => {
  const [gifs, setGifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (query: string) => {
    setLoading(true);
    try {
      // Klipy API endpoints (Trending vs Search)
      const endpoint = query 
        ? `${KLIPY_BASE_URL}/search?q=${query}&key=${KLIPY_API_KEY}&limit=20`
        : `${KLIPY_BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=20`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      // Klipy returns data in a 'results' array.
      // We map it to ensure we have a consistent structure.
      setGifs(data.results || []);
    } catch (err) { 
        console.error("Klipy API Error", err); 
    }
    setLoading(false);
  };

  useEffect(() => { fetchGifs(""); }, []);

  // Helper to safely get the GIF URL from Klipy's structure
  const getGifUrl = (item: any) => {
    // Klipy usually puts the GIF in 'files.gif.url' or 'media_formats.gif.url' depending on version
    return item?.files?.gif?.url || item?.media_formats?.gif?.url || "";
  };

  const getPreviewUrl = (item: any) => {
    // Use tinygif for the grid preview to save bandwidth
    return item?.files?.tinygif?.url || item?.media_formats?.tinygif?.url || getGifUrl(item);
  };

  return (
    <div className="absolute bottom-24 left-4 w-[400px] h-[500px] bg-[#18181b] border border-white/20 rounded-[24px] shadow-2xl flex flex-col z-50 animate-scale-up overflow-hidden ring-1 ring-black">
      <div className="p-4 border-b border-white/10 flex gap-3 items-center bg-[#202023]">
        <div className="relative flex-1 group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-4 top-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
            className="w-full bg-black/40 text-white pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-white/10 placeholder-zinc-500 font-medium"
            placeholder="Search Klipy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchGifs(search)}
            autoFocus
            />
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-300 hover:text-white transition-colors">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#18181b]">
        {loading ? <div className="flex h-full items-center justify-center text-xs font-medium text-zinc-500 tracking-widest uppercase animate-pulse">Loading...</div> : (
          <div className="columns-2 gap-3 space-y-3">
            {gifs.map((g) => (
              <div key={g.id} className="relative group overflow-hidden rounded-xl cursor-pointer border border-white/10 hover:border-blue-500 transition-colors" onClick={() => onSelect(getGifUrl(g))}>
                <img src={getPreviewUrl(g)} className="w-full h-auto object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-5 py-2 bg-[#121214] text-[9px] text-zinc-500 text-center font-bold tracking-widest uppercase border-t border-white/10">Powered by Klipy</div>
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

  // --- AUTH ---
  const handleAuth = async () => {
    const endpoint = isRegistering ? "register" : "login";
    try {
      const res = await fetch(`http://localhost:3001/${endpoint}`, {
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
    const res = await fetch(`http://localhost:3001/my-servers/${id}`);
    const data = await res.json();
    setServers(data);
    return data;
  };
  const fetchFriends = async (id: number) => setFriends(await (await fetch(`http://localhost:3001/my-friends/${id}`)).json());
  const fetchMembers = async (serverId: number) => {
    const res = await fetch(`http://localhost:3001/servers/${serverId}/members`);
    setServerMembers(await res.json());
  };

  const selectServer = async (server: any) => {
    setView("servers");
    setActive({ ...active, server, friend: null });
    const res = await fetch(`http://localhost:3001/servers/${server.id}/channels`);
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

  // --- VOICE LOGIC ---
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
          const peer = createPeer(u.socketId, socket.id as string, stream, u.userData);
          peersRef.current.push({ peerID: u.socketId, peer, info: u.userData });
          peersArr.push({ peerID: u.socketId, peer, info: u.userData });
        });
        setPeers(peersArr);
      });

      socket.on("user_joined", (payload) => {
        if (peersRef.current.find(p => p.peerID === payload.callerID)) {
            const item = peersRef.current.find(p => p.peerID === payload.callerID);
            item.peer.signal(payload.signal);
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
    }).catch(err => {
      console.error("Mic Error:", err);
      alert("Could not access microphone.");
    });
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

  // 🔥 SCREEN SHARE 🔥
  const startScreenShare = async () => {
    if (!myStream) return;
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = stream.getVideoTracks()[0];

        setScreenStream(stream); 
        setIsScreenSharing(true);

        peersRef.current.forEach(p => {
            p.peer.addTrack(screenTrack, myStream);
        });

        screenTrack.onended = () => stopScreenShare(screenTrack);

    } catch (err) { console.log("Cancelled screen share"); }
  };

  const stopScreenShare = (screenTrack?: MediaStreamTrack) => {
    if (!myStream) return;
    const trackToStop = screenTrack || screenStream?.getVideoTracks()[0];
    if (trackToStop) {
        trackToStop.stop();
        peersRef.current.forEach(p => { try { p.peer.removeTrack(trackToStop, myStream); } catch(e) {} });
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    setMaximizedContent(null);
  };

  useEffect(() => {
    if (myVideoRef.current && screenStream) {
        myVideoRef.current.srcObject = screenStream;
        myVideoRef.current.muted = true; 
        myVideoRef.current.play().catch(e => console.error("Local play error", e));
    }
  }, [screenStream, isScreenSharing]);

  const leaveCall = () => {
    if (isScreenSharing) stopScreenShare();
    setInCall(false);
    setMaximizedContent(null);
    myStream?.getTracks().forEach(track => track.stop());
    setMyStream(null);
    setPeers([]);
    peersRef.current = [];
    socket.off("all_users"); socket.off("user_joined"); socket.off("receiving_returned_signal");
    socket.emit("leave_voice");
  };

  const startDMCall = () => {
    const ids = [user.id, active.friend.id].sort((a, b) => a - b);
    const roomId = `dm-call-${ids[0]}-${ids[1]}`;
    sendMessage(`📞 Started a call!`, null); 
    joinVoiceRoom(roomId);
  };

  // --- ACTIONS ---
  const addFriend = async () => { const friendString = prompt("Enter Name#1234"); if (!friendString) return; const res = await fetch("http://localhost:3001/add-friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendString }) }); const data = await res.json(); data.success ? (alert("Added!"), fetchFriends(user.id)) : alert(data.message); };
  const createServer = async () => { const name = prompt("Server Name"); if (!name) return; const res = await fetch("http://localhost:3001/create-server", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId: user.id }) }); const data = await res.json(); if (data.success) { fetchServers(user.id); selectServer(data.server); } };
  const createChannel = async () => { const name = prompt("Channel Name"); const type = confirm("Is this a Voice Channel?") ? "voice" : "text"; if (name) await fetch("http://localhost:3001/create-channel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, name, type }) }); selectServer(active.server); };
  const inviteUser = async () => { const userString = prompt("Invite user (e.g. Robin#1234):"); if (!userString) return; const res = await fetch("http://localhost:3001/servers/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userString }) }); const data = await res.json(); if (data.success) alert("User invited!"); else alert(data.message); };
  const kickMember = async (memberId: number) => { if (!confirm("Kick this user?")) return; const res = await fetch("http://localhost:3001/servers/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, requesterId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const deleteChannel = async (channelId: number) => { if (!confirm("Delete this channel?")) return; const res = await fetch("http://localhost:3001/channels/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, requesterId: user.id }) }); const data = await res.json(); if (data.success) selectServer(active.server); else alert(`Failed: ${data.message}`); };
  const promoteMember = async (memberId: number) => { if (!confirm("Make this user an ADMIN?")) return; const res = await fetch("http://localhost:3001/servers/promote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, ownerId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const demoteMember = async (memberId: number) => { if (!confirm("Remove Admin status?")) return; const res = await fetch("http://localhost:3001/servers/demote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, ownerId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const leaveServer = async () => { if (!confirm(`Are you sure you want to leave ${active.server.name}?`)) return; const res = await fetch("http://localhost:3001/servers/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id }) }); const data = await res.json(); if (data.success) { setServers(prev => prev.filter(s => s.id !== active.server.id)); goToHome(); } else { alert(data.message); } };

  // --- SETTINGS ---
  const openSettings = () => { setNewUsername(user.username); setNewBio(user.bio || ""); setNewAvatar(null); setShowSettings(true); };
  const viewUserProfile = async (userId: number) => { const res = await fetch(`http://localhost:3001/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };
  const handleUpdateProfile = async () => {
    let avatarUrl = user.avatar_url;
    if (newAvatar) {
      const formData = new FormData();
      formData.append("file", newAvatar);
      try { const res = await fetch("http://localhost:3001/upload", { method: "POST", body: formData }); const data = await res.json(); if (data.success) avatarUrl = data.fileUrl; } catch { alert("Failed to upload image"); return; }
    }
    const res = await fetch("http://localhost:3001/update-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, username: newUsername, avatarUrl, bio: newBio }) });
    const data = await res.json();
    if (data.success) { setUser(data.user); setShowSettings(false); alert("Profile updated!"); } else { alert("Update failed"); }
  };

  const handleFileUpload = async (e: any) => { const file = e.target.files[0]; if (!file) return; setIsUploading(true); const formData = new FormData(); formData.append("file", file); try { const res = await fetch("http://localhost:3001/upload", { method: "POST", body: formData }); const data = await res.json(); if (data.success) sendMessage(null, data.fileUrl); } catch { alert("Error uploading"); } setIsUploading(false); };
  const sendMessage = (textMsg: string | null, fileUrl: string | null = null) => { const content = textMsg || (fileUrl ? "Sent an image" : ""); const payload: any = { content, senderId: user.id, senderName: `${user.username}#${user.discriminator}`, fileUrl }; if (view === "servers" && active.channel) { payload.channelId = active.channel.id; socket.emit("send_message", payload); } else if (view === "dms" && active.friend) { payload.recipientId = active.friend.id; socket.emit("send_message", payload); } setMessage(""); };

  useEffect(() => { socket.on("receive_message", (msg) => setChatHistory(prev => [...prev, msg])); socket.on("load_messages", (msgs) => setChatHistory(msgs)); return () => { socket.off("receive_message"); socket.off("load_messages"); }; }, []);
  useEffect(() => { if (user) socket.emit("setup", user.id); }, [user]);
  useEffect(() => { 
    socket.on("new_server_invite", async () => { if (user) { const newServers = await fetchServers(user.id); if (active.server && !newServers.find((s: any) => s.id === active.server.id)) { goToHome(); alert("You have been removed from the server."); } } });
    socket.on("server_update", ({ serverId }) => { if (active.server && active.server.id == serverId) fetchMembers(serverId); });
    socket.on("user_updated", () => { if (active.server) fetchMembers(active.server.id); if (user) fetchFriends(user.id); });
    socket.on("voice_state_update", ({ channelId, users }) => { setVoiceStates(prev => ({ ...prev, [channelId]: users })); });
    return () => { socket.off("new_server_invite"); socket.off("server_update"); socket.off("user_updated"); socket.off("voice_state_update"); };
  }, [user, active.server]);

  // LOGIN SCREEN (High Contrast)
  if (!user) return ( 
    <div className="flex h-screen items-center justify-center bg-[#050505] text-white font-sans selection:bg-blue-500/30"> 
      
      <div className="z-10 bg-[#121212] border border-white/10 p-10 rounded-[24px] w-[380px] text-center shadow-2xl ring-1 ring-black flex flex-col gap-6"> 
        <div className="mb-2">
            <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.063-2.33.155-3.456.279M6 7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0124 7.5v11.25a2.25 2.25 0 01-2.25 2.25h-9.568a4.51 4.51 0 00-1.789.365L6 24V7.5z" /></svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">DaChat</h1> 
            <p className="text-zinc-400 text-sm mt-2">Sign in to your workspace</p>
        </div>
        
        {error && <p className="text-red-400 text-xs bg-red-500/10 py-2.5 rounded-lg border border-red-500/20 font-medium">{error}</p>} 
        
        <div className="space-y-3">
            <input className="w-full bg-[#0a0a0a] border border-white/10 text-white px-4 py-3.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-zinc-500 text-sm font-medium" placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} /> 
            <input className="w-full bg-[#0a0a0a] border border-white/10 text-white px-4 py-3.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-zinc-500 text-sm font-medium" type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /> 
        </div>

        <button onClick={handleAuth} className="w-full bg-blue-600 text-white hover:bg-blue-500 py-3.5 rounded-lg font-bold transition-all shadow-lg shadow-blue-500/10 mt-2 text-sm active:scale-95">{isRegistering ? "Create Account" : "Enter"}</button> 
        <p className="text-xs cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors mt-2" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? "Already have an account?" : "Need an account?"}</p> 
      </div> 
    </div> 
  );

  const amIOwner = active.server && user.id === active.server.owner_id;
  const myMemberInfo = serverMembers.find(m => m.id === user.id);
  const amIAdmin = myMemberInfo?.is_admin === true;
  const canModerate = amIOwner || amIAdmin;

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-200 font-sans overflow-hidden selection:bg-blue-600/30">
      
      {/* 1. DOCK */}
      <div className="w-[80px] flex flex-col items-center py-6 gap-3 z-30 fixed left-0 top-0 bottom-0 bg-[#080808] border-r border-white/10">
        <div onClick={goToHome} className={`w-[50px] h-[50px] rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 mb-4 shadow-lg border ${view === 'dms' ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white"}`}> 
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> 
        </div>
        
        <div className="w-8 h-[1px] bg-white/10 rounded-full mb-3" />
        
        <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto no-scrollbar px-2">
        {servers.map(s => ( 
            <div key={s.id} onClick={() => selectServer(s)} className={`group relative w-[50px] h-[50px] rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 shadow-md border ${active.server?.id === s.id ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white"}`}> 
                <span className="font-bold text-sm tracking-tight">{s.name.substring(0, 2).toUpperCase()}</span> 
                {active.server?.id === s.id && <div className="absolute -left-[14px] w-1 h-6 bg-white rounded-r-full" />} 
            </div> 
        ))}
        <div onClick={createServer} className="w-[50px] h-[50px] rounded-2xl border border-dashed border-zinc-700 bg-transparent flex items-center justify-center cursor-pointer text-zinc-600 hover:border-green-500 hover:text-green-500 transition-all mt-2"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> </div>
        </div>
      </div>

      {/* 2. SIDEBAR */}
      <div className="w-[260px] bg-[#111111] flex flex-col border-r border-white/10 ml-[80px]">
        <div className="h-16 flex items-center px-5 font-bold text-white text-[15px] tracking-tight border-b border-white/10 shadow-sm bg-[#141414]"> {active.server ? active.server.name : "Messages"} </div>
        <div className="flex-1 p-3 overflow-y-auto">
          {view === "servers" && active.server ? (
            <>
              <div className="flex justify-between items-center px-2 pb-2 pt-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest"> <span>Channels</span> <button onClick={createChannel} className="hover:text-white transition-colors text-lg leading-none">+</button> </div>
              <div className="space-y-[2px]">
                {channels.map(ch => (
                  <div key={ch.id} className={`group flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 border ${active.channel?.id === ch.id ? "bg-zinc-800 border-white/5 text-white" : "border-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"}`}>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex gap-3 items-center w-full" onClick={() => joinChannel(ch)}>
                        {ch.type === 'voice' ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 opacity-70"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg> : <span className="text-lg opacity-50">#</span>}
                        <span className="truncate text-[13px] font-medium tracking-wide">{ch.name}</span>
                        </div>
                        {canModerate && <span onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-[10px] text-zinc-500 hover:text-red-400 transition-colors px-2">✕</span>}
                    </div>
                    {/* Voice Avatars */}
                    {ch.type === 'voice' && voiceStates[ch.id] && voiceStates[ch.id].length > 0 && (
                        <div className="flex items-center gap-1 mt-2 ml-7">
                            {voiceStates[ch.id].map(uid => {
                                const member = serverMembers.find(m => m.id === uid);
                                return member ? (
                                    <UserAvatar key={uid} src={member.avatar_url} className="w-6 h-6 rounded-full object-cover border border-black shadow-sm" fallbackClass="bg-zinc-600 border border-black" />
                                ) : null;
                            })}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={addFriend} className="w-full bg-[#18181b] hover:bg-[#202023] text-zinc-300 border border-white/10 text-xs font-semibold py-2.5 rounded-lg mb-6 transition-all tracking-wide shadow-sm">Find Friends</button>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-3">Direct Messages</div>
              {friends.map(f => (
                <div key={f.id} onClick={() => selectFriend(f)} className={`px-3 py-2.5 rounded-lg cursor-pointer flex gap-3 items-center transition-all duration-200 border ${active.friend?.id === f.id ? "bg-zinc-800 border-white/5" : "border-transparent hover:bg-zinc-800/50"}`}>
                  <UserAvatar src={f.avatar_url} className="w-9 h-9 rounded-full object-cover bg-zinc-800" fallbackClass="bg-gradient-to-br from-indigo-900 to-purple-900" />
                  <div className="flex flex-col"> <span className="text-[13px] font-medium text-zinc-200">{f.username}</span> <span className="text-[10px] text-zinc-500 font-medium">Offline</span> </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="p-3 bg-[#111111] border-t border-white/10">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800 transition-colors group cursor-pointer" onClick={openSettings}>
            <div className="flex items-center gap-3">
              <UserAvatar src={user.avatar_url} className="w-9 h-9 rounded-full object-cover bg-zinc-800" fallbackClass="bg-gradient-to-tr from-yellow-600 to-orange-700" />
              <div className="text-sm overflow-hidden"> <div className="font-bold text-white truncate text-[13px]">{user.username}</div> <div className="text-[10px] text-zinc-500 font-medium">#{user.discriminator}</div> </div>
            </div>
            <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg> </div>
          </div>
        </div>
      </div>

      {/* 3. CHAT AREA / VOICE CALL */}
      <div className="flex-1 bg-[#050505] flex flex-col min-w-0 relative">
        {(active.channel || active.friend) ? (
          <>
            {/* TOP BAR */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a] z-10 sticky top-0 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-xl font-light">{active.channel ? (active.channel.type==='voice'? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg> : '#') : "@"}</span>
                <span className="font-bold text-white text-md tracking-wide">{active.channel ? active.channel.name : active.friend.username}</span>
              </div>
              {!active.channel && active.friend && (
                <div onClick={startDMCall} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-full cursor-pointer transition-all shadow-md shadow-green-900/20"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg> </div>
              )}
            </div>

            {/* MAXIMIZED VIDEO OVERLAY */}
            {maximizedContent && (
                <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center animate-scale-up backdrop-blur-md">
                    <button onClick={() => setMaximizedContent(null)} className="absolute top-8 right-8 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full z-50 border border-white/20 transition-all group shadow-2xl"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> </button>
                    <div className="w-full h-full p-10 flex items-center justify-center">
                        <video ref={node => { if(node) { node.srcObject = maximizedContent.stream; node.muted = (maximizedContent.type === 'local'); node.play().catch(() => {}); } }} autoPlay playsInline className="w-full h-full object-contain rounded-[24px] shadow-2xl border border-zinc-800" />
                    </div>
                </div>
            )}

            {inCall ? (
              <div className="flex-1 bg-black flex flex-col items-center justify-center relative p-8">
                <div className="grid grid-cols-2 gap-6 w-full h-full max-w-6xl">
                  {/* MY VIDEO */}
                  <div className="bg-[#111111] rounded-[24px] flex flex-col items-center justify-center relative overflow-hidden border border-white/10 group shadow-2xl"> 
                    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
                        {isScreenSharing ? (
                            <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
                        ) : (
                            <div className="flex flex-col items-center">
                                <UserAvatar src={user.avatar_url} className="w-24 h-24 rounded-[32px] object-cover border-4 border-zinc-800 mb-6 shadow-xl" fallbackClass="bg-zinc-800 border-4 border-zinc-700 mb-6" />
                                <span className="text-white font-bold text-lg tracking-tight">{user.username} (You)</span> 
                                <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-green-900/30 rounded-full border border-green-500/20">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase">Live</span> 
                                </div>
                            </div>
                        )}
                    </div>
                    {isScreenSharing && (
                        <>
                            <div className="absolute top-6 right-6 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shadow-lg z-10 transition-colors tracking-wide border border-red-400/20" onClick={() => stopScreenShare()}>STOP SHARING</div>
                            <div onClick={() => setMaximizedContent({ stream: myVideoRef.current!.srcObject as MediaStream, type: 'local' })} className="absolute bottom-6 right-6 bg-black/80 hover:bg-black text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-white/10"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg> </div>
                        </>
                    )}
                  </div>
                  
                  {/* PEERS */}
                  {peers.map((p, i) => ( 
                    <div key={i} className="bg-[#111111] rounded-[24px] flex flex-col items-center justify-center border border-white/10 relative overflow-hidden group shadow-2xl"> 
                      <MediaPlayer peer={p.peer} userInfo={p.info} onMaximize={(stream: MediaStream) => setMaximizedContent({ stream, type: 'remote' })} />
                    </div> 
                  ))}
                </div>
                
                {/* Floating Controls */}
                <div className="absolute bottom-10 flex gap-4 p-3 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl">
                    <button onClick={startScreenShare} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isScreenSharing ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-zinc-800 hover:bg-zinc-700 text-white"}`} disabled={isScreenSharing}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
                    </button>
                    <button onClick={leaveCall} className="w-12 h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-900/20 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                    </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#050505]">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className="flex gap-4 group animate-fade-in-up">
                      <UserAvatar src={msg.avatar_url} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer hover:opacity-80 transition-opacity" fallbackClass={`w-10 h-10 rounded-full flex-shrink-0 shadow-sm cursor-pointer ${msg.sender_id === user.id ? "bg-gradient-to-tr from-yellow-400 to-orange-500" : "bg-gradient-to-br from-blue-500 to-indigo-600"}`} />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1"> <span className={`font-bold text-[14px] cursor-pointer hover:underline ${msg.sender_id === user.id ? "text-yellow-500" : "text-blue-400"}`} onClick={() => viewUserProfile(msg.sender_id)}>{msg.sender_name}</span> <span className="text-[10px] text-zinc-500 font-medium">Today at 12:00 PM</span> </div>
                        {msg.content && (
                            msg.content.startsWith("http") && msg.content.includes("tenor") ? 
                            <img src={msg.content} className="rounded-xl max-w-sm border border-white/10 shadow-md" /> :
                            <p className="text-zinc-300 text-[15px] leading-relaxed font-normal">{msg.content}</p>
                        )}
                        {msg.file_url && <img src={msg.file_url} alt="attachment" className="mt-3 max-w-[400px] max-h-[400px] rounded-xl border border-white/10 shadow-lg" />}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 🔥 SLEEK FLOATING INPUT 🔥 */}
                <div className="p-6 relative bg-[#050505]"> 
                  {showGifPicker && <GifPicker onSelect={(url: string) => { sendMessage(null, url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
                  
                  <div className="bg-[#121212] border border-white/15 rounded-[18px] px-3 py-2 flex items-center gap-3 shadow-lg relative z-20"> 
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center cursor-pointer text-zinc-400 hover:text-white transition-all ml-1" onClick={() => fileInputRef.current?.click()}> 
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> 
                    </div> 
                    
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center cursor-pointer text-zinc-400 hover:text-white transition-all text-[10px] font-black tracking-wider" onClick={() => setShowGifPicker(!showGifPicker)}> 
                      GIF
                    </div> 

                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" /> 
                    <input className="bg-transparent flex-1 outline-none text-zinc-200 placeholder-zinc-500 font-medium px-2 text-[15px]" placeholder={`Message ${active.channel ? "#"+active.channel.name : "@"+active.friend.username}`} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(message)} disabled={isUploading} /> 
                  </div> 
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-6"> 
            <div className="w-24 h-24 rounded-[32px] bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner"> 
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 opacity-20"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.063-2.33.155-3.456.279M6 7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0124 7.5v11.25a2.25 2.25 0 01-2.25 2.25h-9.568a4.51 4.51 0 00-1.789.365L6 24V7.5z" /></svg> 
            </div> 
            <p className="font-medium tracking-wide text-sm opacity-50 uppercase">No Server Selected</p> 
          </div>
        )}
      </div>

      {/* 4. MEMBER LIST (Contrast Panel) */}
      {view === "servers" && active.server && (
        <div className="w-[260px] bg-[#111111] flex flex-col border-l border-white/10 fixed right-0 top-0 bottom-0">
          <div className="h-16 flex items-center px-6 font-bold text-zinc-500 text-[11px] uppercase tracking-widest border-b border-white/10 bg-[#141414]">Members — {serverMembers.length}</div>
          <div className="flex-1 p-5 overflow-y-auto">
             <div className="grid grid-cols-2 gap-2 mb-6">
                <button onClick={inviteUser} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold py-2.5 rounded-lg transition-all border border-white/5">Invite</button>
                <button onClick={leaveServer} className="bg-red-900/20 hover:bg-red-900/30 text-red-400 text-xs font-bold py-2.5 rounded-lg transition-all border border-red-500/10">Leave</button>
             </div>
             
             {serverMembers.map(member => (
               <div key={member.id} className="flex items-center gap-3 mb-2 p-2 rounded-lg hover:bg-zinc-800 group transition-colors cursor-pointer" onClick={() => viewUserProfile(member.id)}>
                 <UserAvatar src={member.avatar_url} className="w-8 h-8 rounded-full object-cover shadow-sm bg-zinc-700" fallbackClass={`w-8 h-8 rounded-full shadow-lg ${member.id === active.server.owner_id ? "bg-gradient-to-tr from-yellow-600 to-orange-700" : member.is_admin ? "bg-gradient-to-tr from-green-600 to-emerald-700" : "bg-zinc-800"}`} />
                 <div className="flex-1 min-w-0"> 
                    <div className={`font-bold text-[13px] flex items-center gap-1.5 ${member.id === active.server.owner_id ? "text-yellow-500" : member.is_admin ? "text-green-500" : "text-zinc-300"}`}> 
                        <span className="truncate">{member.username}</span> 
                        {member.id === active.server.owner_id && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>} 
                    </div> 
                    <div className="text-[10px] text-zinc-500 font-medium">#{member.discriminator}</div> 
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* ⚙️ SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] w-[420px] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden animate-scale-up ring-1 ring-black">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#202023]"> <h2 className="text-xl font-bold text-white tracking-tight">Edit Profile</h2> <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">✕</button> </div>
            <div className="p-10 flex flex-col gap-8">
              <div className="flex flex-col items-center gap-6">
                <div onClick={() => avatarInputRef.current?.click()} className="relative group cursor-pointer"> {newAvatar ? <img src={URL.createObjectURL(newAvatar)} className="w-28 h-28 rounded-full object-cover border-4 border-zinc-700 group-hover:border-blue-500 transition-all shadow-xl" /> : <UserAvatar src={user.avatar_url} className="w-28 h-28 rounded-full object-cover border-4 border-zinc-700 group-hover:border-blue-500 transition-all shadow-xl" fallbackClass="w-28 h-28 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 border-4 border-zinc-800 group-hover:border-blue-500 transition-all shadow-xl" />} <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg> </div> </div> <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && setNewAvatar(e.target.files[0])} /> 
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2"> <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Username</label> <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-black/40 border border-white/10 text-white p-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium" /> </div>
                <div className="flex flex-col gap-2"> <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest ml-1">About Me</label> <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} rows={3} className="bg-black/40 border border-white/10 text-white p-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none font-medium" placeholder="Write something..." /> </div>
              </div>
            </div>
            <div className="p-8 bg-[#121214] border-t border-white/10 flex justify-end gap-3"> <button onClick={() => setShowSettings(false)} className="px-6 py-3 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white">CANCEL</button> <button onClick={handleUpdateProfile} className="px-8 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">SAVE CHANGES</button> </div>
          </div>
        </div>
      )}

      {/* 👤 USER PROFILE MODAL */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setViewingProfile(null)}>
          <div className="bg-[#18181b] w-[380px] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden animate-scale-up ring-1 ring-black" onClick={e => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-tr from-blue-900 to-purple-900 relative"> <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 p-2 bg-[#18181b] rounded-full"> <UserAvatar src={viewingProfile.avatar_url} className="w-28 h-28 rounded-full object-cover border-4 border-[#18181b]" fallbackClass="w-28 h-28 rounded-full bg-zinc-800 border-4 border-[#18181b]" /> </div> </div>
            <div className="pt-16 pb-10 px-8 text-center"> <h2 className="text-2xl font-bold text-white tracking-tight">{viewingProfile.username}</h2> <p className="text-zinc-500 text-xs font-bold tracking-widest mt-1 uppercase">#{viewingProfile.discriminator}</p> <div className="mt-8 bg-black/30 p-6 rounded-2xl border border-white/5"> <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">About</h3> <p className="text-zinc-300 text-sm leading-relaxed font-normal"> {viewingProfile.bio || "No bio yet."} </p> </div> </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 🔥 INTELLIGENT MEDIA PLAYER (Video/Screen Share)
const MediaPlayer = ({ peer, userInfo, onMaximize }: any) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    peer.on("stream", (stream: MediaStream) => {
        if (ref.current) {
            ref.current.srcObject = stream;
            ref.current.play().catch(e => console.log("Autoplay blocked", e));
        }
        setHasVideo(stream.getVideoTracks().length > 0);
        stream.onaddtrack = () => { setHasVideo(stream.getVideoTracks().length > 0); if(ref.current) ref.current.play(); };
        stream.onremovetrack = () => setHasVideo(stream.getVideoTracks().length > 0);
    });
  }, [peer]);

  return (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
        {hasVideo ? (
            <>
                <video ref={ref} autoPlay playsInline className="w-full h-full object-contain bg-black" />
                <div onClick={() => onMaximize(ref.current?.srcObject)} className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg> </div>
            </>
        ) : (
            <>
                <video ref={ref} autoPlay playsInline className="hidden" /> 
                <div className="flex flex-col items-center">
                    <UserAvatar src={userInfo?.avatar_url} className="w-24 h-24 rounded-full object-cover border-4 border-blue-900/50 mb-6 shadow-xl" fallbackClass="w-24 h-24 rounded-full bg-blue-900/20 border-4 border-blue-900/50 mb-6" />
                    <span className="text-white font-semibold text-xl tracking-tight">{userInfo?.username || "Unknown"}</span> 
                </div>
            </>
        )}
    </div>
  );
};