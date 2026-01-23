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
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const socket = io(BACKEND_URL);

// 🔥 MEMOIZED AVATAR
const UserAvatar = memo(({ src, alt, className, fallbackClass }: any) => {
  return src ? (
    <img src={src} alt={alt || "User"} className={`${className} bg-black/20`} loading="eager" />
  ) : (
    <div className={`${className} ${fallbackClass || "bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10"} flex items-center justify-center`}>
       <span className="text-[10px] text-white/70 font-bold">?</span>
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
    <div className="absolute bottom-24 left-4 w-[360px] h-[480px] bg-[#1a1a2e]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col z-50 animate-scale-up overflow-hidden ring-1 ring-white/10">
      <div className="p-4 border-b border-white/5 flex gap-3 items-center bg-white/5">
        <div className="relative flex-1">
            <input 
            className="w-full bg-black/20 text-white px-4 py-2.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-white/5 placeholder-white/30 font-medium transition-all"
            placeholder="Search GIFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchGifs(search)}
            autoFocus
            />
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {loading ? <div className="flex h-full items-center justify-center text-xs font-bold text-white/30 uppercase animate-pulse">Loading...</div> : (
          <div className="columns-2 gap-2 space-y-2">
            {gifs.map((g) => (
              <div key={g.id} className="relative group overflow-hidden rounded-xl cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all" onClick={() => onSelect(getGifUrl(g))}>
                <img src={getPreviewUrl(g)} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
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

  // --- AUTH ---
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
    return data;
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
        const uniqueUsers = new Map();
        users.forEach((u: any) => { if (String(u.userData.id) !== String(user.id)) uniqueUsers.set(u.userData.id, u); });
        uniqueUsers.forEach((u: any) => {
          const peer = createPeer(u.socketId, socket.id as string, stream, u.userData);
          peersRef.current.push({ peerID: u.socketId, peer, info: u.userData });
          peersArr.push({ peerID: u.socketId, peer, info: u.userData });
        });
        setPeers(peersArr);
      });

      socket.on("user_joined", (payload) => {
        if (String(payload.userData.id) === String(user.id)) return;
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

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      setScreenStream(stream);
      setIsScreenSharing(true);
      peersRef.current.forEach((peerObj) => {
        const peer = peerObj.peer;
        if (peer._pc) {
            const sender = peer._pc.getSenders().find((s: any) => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack).catch((e: any) => console.error(e));
            else if(peer.addTrack) peer.addTrack(screenTrack, stream);
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
                if (sender) sender.replaceTrack(cameraTrack || null); 
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
  const addFriend = async () => { const friendString = prompt("Enter Name#1234"); if (!friendString) return; const res = await fetch(`${BACKEND_URL}/add-friend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myId: user.id, friendString }) }); const data = await res.json(); data.success ? (alert("Added!"), fetchFriends(user.id)) : alert(data.message); };
  const createServer = async () => { const name = prompt("Server Name"); if (!name) return; const res = await fetch(`${BACKEND_URL}/create-server`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId: user.id }) }); const data = await res.json(); if (data.success) { fetchServers(user.id); selectServer(data.server); } };
  const createChannel = async () => { const name = prompt("Channel Name"); const type = confirm("Is this a Voice Channel?") ? "voice" : "text"; if (name) await fetch(`${BACKEND_URL}/create-channel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, name, type }) }); selectServer(active.server); };
  const inviteUser = async () => { const userString = prompt("Invite user (e.g. Robin#1234):"); if (!userString) return; const res = await fetch(`${BACKEND_URL}/servers/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userString }) }); const data = await res.json(); if (data.success) alert("User invited!"); else alert(data.message); };
  const kickMember = async (memberId: number) => { if (!confirm("Kick this user?")) return; const res = await fetch(`${BACKEND_URL}/servers/kick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, requesterId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const deleteChannel = async (channelId: number) => { if (!confirm("Delete this channel?")) return; const res = await fetch(`${BACKEND_URL}/channels/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, requesterId: user.id }) }); const data = await res.json(); if (data.success) selectServer(active.server); else alert(`Failed: ${data.message}`); };
  const promoteMember = async (memberId: number) => { if (!confirm("Make this user an ADMIN?")) return; const res = await fetch(`${BACKEND_URL}/servers/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, ownerId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const demoteMember = async (memberId: number) => { if (!confirm("Remove Admin status?")) return; const res = await fetch(`${BACKEND_URL}/servers/demote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: memberId, ownerId: user.id }) }); const data = await res.json(); if (!data.success) alert(`Failed: ${data.message}`); };
  const leaveServer = async () => { if (!confirm(`Are you sure you want to leave ${active.server.name}?`)) return; const res = await fetch(`${BACKEND_URL}/servers/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: active.server.id, userId: user.id }) }); const data = await res.json(); if (data.success) { setServers(prev => prev.filter(s => s.id !== active.server.id)); goToHome(); } else { alert(data.message); } };

  // --- SETTINGS ---
  const openSettings = () => { setNewUsername(user.username); setNewBio(user.bio || ""); setNewAvatar(null); setShowSettings(true); };
  const viewUserProfile = async (userId: number) => { const res = await fetch(`${BACKEND_URL}/users/${userId}`); const data = await res.json(); if (data.success) setViewingProfile(data.user); };
  const handleUpdateProfile = async () => {
    let avatarUrl = user.avatar_url;
    if (newAvatar) {
      const formData = new FormData();
      formData.append("file", newAvatar);
      try { const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.success) avatarUrl = data.fileUrl; } catch { alert("Failed to upload image"); return; }
    }
    const res = await fetch(`${BACKEND_URL}/update-profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, username: newUsername, avatarUrl, bio: newBio }) });
    const data = await res.json();
    if (data.success) { setUser(data.user); setShowSettings(false); alert("Profile updated!"); } else { alert("Update failed"); }
  };

  const handleFileUpload = async (e: any) => { const file = e.target.files[0]; if (!file) return; setIsUploading(true); const formData = new FormData(); formData.append("file", file); try { const res = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.success) sendMessage(null, data.fileUrl); } catch { alert("Error uploading"); } setIsUploading(false); };
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

  const amIOwner = active.server && user.id === active.server.owner_id;
  const myMemberInfo = serverMembers.find(m => m.id === user.id);
  const amIAdmin = myMemberInfo?.is_admin === true;
  const canModerate = amIOwner || amIAdmin;

  // 🔥 LOGIN SCREEN (Color + Glass)
  if (!user) return ( 
    <div className="flex h-screen items-center justify-center bg-[#09090b] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/60 via-[#09090b] to-[#09090b] text-white font-sans"> 
      <div className="z-10 bg-black/30 backdrop-blur-2xl border border-white/10 p-10 rounded-[40px] w-[380px] text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 flex flex-col gap-6"> 
        <div className="mb-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.063-2.33.155-3.456.279M6 7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0124 7.5v11.25a2.25 2.25 0 01-2.25 2.25h-9.568a4.51 4.51 0 00-1.789.365L6 24V7.5z" /></svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">DaChat</h1> 
            <p className="text-indigo-200/50 text-sm mt-2 font-medium">Your new digital home.</p>
        </div>
        {error && <p className="text-red-300 text-xs bg-red-500/20 py-3 rounded-xl border border-red-500/10 font-medium">{error}</p>} 
        <div className="space-y-3">
            <input className="w-full bg-black/20 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder-white/20 text-sm font-medium backdrop-blur-sm" placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} /> 
            <input className="w-full bg-black/20 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder-white/20 text-sm font-medium backdrop-blur-sm" type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /> 
        </div>
        <button onClick={handleAuth} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20 mt-2 text-sm active:scale-95 border border-white/10">
            {isRegistering ? "Create Account" : "Enter Space"}
        </button> 
        <p className="text-xs cursor-pointer text-white/40 hover:text-white transition-colors mt-2" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? "Already have an account?" : "Need an account?"}</p> 
      </div> 
    </div> 
  );

  // 🔥 MAIN UI (Colorful Glass)
  return (
    <div className="flex h-screen bg-[#0f0f13] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-900/40 via-[#0f0f13] to-[#050505] text-white font-sans overflow-hidden p-2 gap-2">
      
      {/* 1. DOCK (Frosted White Glass) */}
      <div className="w-[84px] flex flex-col items-center py-6 gap-3 z-30 rounded-[36px] bg-white/[0.03] backdrop-blur-2xl border border-white/5 shadow-2xl">
        <div onClick={goToHome} className={`w-[52px] h-[52px] rounded-[22px] flex items-center justify-center cursor-pointer transition-all duration-300 mb-4 shadow-lg border ${view === 'dms' ? "bg-gradient-to-br from-cyan-500 to-blue-600 border-white/20 text-white shadow-cyan-500/30" : "bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white"}`}> 
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> 
        </div>
        
        <div className="w-10 h-[2px] bg-white/10 rounded-full mb-2" />
        
        <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto no-scrollbar px-2 pb-2">
        {servers.map(s => ( 
            <div key={s.id} onClick={() => selectServer(s)} className={`group relative w-[52px] h-[52px] rounded-[22px] flex items-center justify-center cursor-pointer transition-all duration-300 shadow-lg border ${active.server?.id === s.id ? "bg-gradient-to-br from-blue-600 to-indigo-600 border-white/20 text-white shadow-blue-500/30" : "bg-white/5 border-transparent text-white/50 hover:bg-white/10 hover:text-white"}`}> 
                <span className="font-bold text-sm tracking-tight drop-shadow-sm">{s.name.substring(0, 2).toUpperCase()}</span> 
                {active.server?.id === s.id && <div className="absolute -left-[19px] w-1.5 h-8 bg-white rounded-r-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />} 
            </div> 
        ))}
        <div onClick={createServer} className="w-[52px] h-[52px] rounded-[22px] border border-dashed border-white/20 bg-transparent flex items-center justify-center cursor-pointer text-white/30 hover:border-emerald-400 hover:text-emerald-400 transition-all mt-2"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> </div>
        </div>
      </div>

      {/* 2. SIDEBAR (Darker Blue Glass) */}
      <div className="w-[280px] rounded-[36px] bg-[#13131f]/60 backdrop-blur-2xl border border-white/5 flex flex-col shadow-2xl overflow-hidden">
        <div className="h-20 flex items-center px-6 font-bold text-white text-[16px] tracking-tight border-b border-white/5 bg-white/[0.02] shadow-sm"> {active.server ? active.server.name : "Messages"} </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {view === "servers" && active.server ? (
            <>
              <div className="flex justify-between items-center px-3 pb-3 pt-2 text-[11px] font-bold text-indigo-200/40 uppercase tracking-widest"> <span>Channels</span> <button onClick={createChannel} className="hover:text-white transition-colors text-lg leading-none opacity-50 hover:opacity-100">+</button> </div>
              <div className="space-y-1">
                {channels.map(ch => (
                  <div key={ch.id} className={`group flex flex-col px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 border ${active.channel?.id === ch.id ? "bg-white/10 border-white/10 text-white shadow-inner" : "border-transparent hover:bg-white/5 text-indigo-100/60 hover:text-white"}`}>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex gap-3 items-center w-full" onClick={() => joinChannel(ch)}>
                        {ch.type === 'voice' ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 opacity-70"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg> : <span className="text-lg opacity-50">#</span>}
                        <span className="truncate text-[14px] font-medium tracking-wide">{ch.name}</span>
                        </div>
                        {canModerate && <span onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="hidden group-hover:block text-[10px] text-white/30 hover:text-red-400 transition-colors px-2">✕</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={addFriend} className="w-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-bold py-3.5 rounded-2xl mb-6 transition-all tracking-wide shadow-sm">Find Friends</button>
              <div className="text-[10px] font-bold text-indigo-200/40 uppercase tracking-widest px-3 mb-3">Direct Messages</div>
              {friends.map(f => (
                <div key={f.id} onClick={() => selectFriend(f)} className={`px-4 py-3.5 rounded-2xl cursor-pointer flex gap-3 items-center transition-all duration-200 border ${active.friend?.id === f.id ? "bg-white/10 border-white/10 shadow-lg" : "border-transparent hover:bg-white/5"}`}>
                  <UserAvatar src={f.avatar_url} className="w-10 h-10 rounded-full object-cover bg-black/40 ring-2 ring-black/20" />
                  <div className="flex flex-col"> <span className="text-[14px] font-medium text-white">{f.username}</span> <span className="text-[11px] text-white/40 font-medium">Offline</span> </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="p-4 bg-black/20 border-t border-white/5">
          <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer" onClick={openSettings}>
            <div className="flex items-center gap-3">
              <UserAvatar src={user.avatar_url} className="w-10 h-10 rounded-full object-cover bg-black/40" />
              <div className="text-sm overflow-hidden"> <div className="font-bold text-white truncate text-[13px]">{user.username}</div> <div className="text-[10px] text-white/40 font-medium">#{user.discriminator}</div> </div>
            </div>
            <div className="text-white/30 group-hover:text-white/70 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg> </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CHAT / VIDEO (Neutral Glass) */}
      <div className="flex-1 rounded-[36px] bg-[#000000]/40 backdrop-blur-2xl border border-white/5 flex flex-col min-w-0 relative shadow-2xl overflow-hidden">
        {(active.channel || active.friend) ? (
          <>
            {/* TOP BAR */}
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-white/[0.01] z-10 sticky top-0 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <span className="text-white/20 text-2xl font-light">{active.channel ? (active.channel.type==='voice'? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg> : '#') : "@"}</span>
                <span className="font-bold text-white text-lg tracking-wide drop-shadow-md">{active.channel ? active.channel.name : active.friend.username}</span>
              </div>
              {!active.channel && active.friend && (
                <div onClick={startDMCall} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white p-3.5 rounded-full cursor-pointer transition-all shadow-lg shadow-green-900/40 backdrop-blur-md"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg> </div>
              )}
            </div>

            {/* MAXIMIZED VIDEO */}
            {maximizedContent && (
                <div className="absolute inset-0 bg-[#000000]/80 z-50 flex items-center justify-center animate-scale-up backdrop-blur-3xl">
                    <button onClick={() => setMaximizedContent(null)} className="absolute top-8 right-8 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full z-50 border border-white/10 transition-all"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> </button>
                    <div className="w-full h-full p-12 flex items-center justify-center">
                        <video ref={node => { if(node) { node.srcObject = maximizedContent.stream; node.muted = (maximizedContent.type === 'local'); node.play().catch(() => {}); } }} autoPlay playsInline className="w-full h-full object-contain rounded-[40px] shadow-2xl border border-white/10 bg-black/50" />
                    </div>
                </div>
            )}

            {inCall ? (
              <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                <div className="grid grid-cols-2 gap-6 w-full h-full max-w-6xl">
                  {/* MY VIDEO */}
                  <div className="bg-black/30 rounded-[40px] flex flex-col items-center justify-center relative overflow-hidden border border-white/5 shadow-2xl group backdrop-blur-md ring-1 ring-white/5"> 
                    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
                        {isScreenSharing ? (
                            <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
                        ) : (
                            <div className="flex flex-col items-center">
                                <UserAvatar src={user.avatar_url} className="w-28 h-28 rounded-[40px] object-cover border-4 border-white/5 mb-6 shadow-2xl" />
                                <span className="text-white font-bold text-xl tracking-tight">{user.username} (You)</span> 
                                <div className="flex items-center gap-2 mt-3 px-4 py-1.5 bg-green-500/20 rounded-full border border-green-500/20 backdrop-blur-md">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase">Live</span> 
                                </div>
                            </div>
                        )}
                    </div>
                    {isScreenSharing && (
                        <>
                            <div className="absolute top-6 right-6 bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-lg z-10 transition-all tracking-wide border border-red-400/20 backdrop-blur-md" onClick={() => stopScreenShare()}>STOP SHARING</div>
                            <div onClick={() => setMaximizedContent({ stream: myVideoRef.current!.srcObject as MediaStream, type: 'local' })} className="absolute top-6 left-6 bg-black/50 hover:bg-black/80 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-white/10 backdrop-blur-md z-10"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg> </div>
                        </>
                    )}
                  </div>
                  
                  {peers.map((p, i) => ( 
                    <div key={i} className="bg-black/30 rounded-[40px] flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group shadow-2xl backdrop-blur-md ring-1 ring-white/5"> 
                      <MediaPlayer peer={p.peer} userInfo={p.info} onMaximize={(stream: MediaStream) => setMaximizedContent({ stream, type: 'remote' })} />
                    </div> 
                  ))}
                </div>
                
                {/* Floating Controls */}
                <div className="absolute bottom-10 flex gap-4 p-4 bg-black/50 border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 ring-1 ring-white/10">
                    <button onClick={startScreenShare} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-white/10 hover:bg-white/20 text-white"}`} disabled={isScreenSharing}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
                    </button>
                    <button onClick={leaveCall} className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 text-white flex items-center justify-center shadow-lg shadow-red-900/30 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                    </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className="flex gap-4 group animate-fade-in-up">
                      <UserAvatar src={msg.avatar_url} className="w-12 h-12 rounded-full object-cover shadow-lg cursor-pointer hover:opacity-80 transition-opacity border border-white/5" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-3 mb-1"> <span className={`font-bold text-[15px] cursor-pointer hover:underline ${msg.sender_id === user.id ? "text-cyan-400" : "text-indigo-200"}`} onClick={() => viewUserProfile(msg.sender_id)}>{msg.sender_name}</span> <span className="text-[11px] text-white/30 font-medium">Today at 12:00 PM</span> </div>
                        {msg.content && (
                            msg.content.startsWith("http") && (msg.content.includes("tenor") || msg.content.includes("klipy")) ? 
                            <img src={msg.content} className="rounded-2xl max-w-sm border border-white/10 shadow-xl" /> :
                            <p className="text-zinc-200 text-[15px] leading-relaxed font-normal bg-white/5 inline-block px-5 py-2.5 rounded-3xl rounded-tl-none border border-white/5 shadow-sm">{msg.content}</p>
                        )}
                        {msg.file_url && <img src={msg.file_url} alt="attachment" className="mt-3 max-w-[400px] max-h-[400px] rounded-2xl border border-white/10 shadow-xl" />}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 🔥 GLASS INPUT 🔥 */}
                <div className="p-6 relative"> 
                  {showGifPicker && <GifPicker onSelect={(url: string) => { sendMessage(null, url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
                  <div className="bg-white/5 border border-white/10 rounded-[28px] px-3 py-2 flex items-center gap-3 shadow-xl backdrop-blur-2xl relative z-20 ring-1 ring-white/5 hover:ring-white/10 transition-all"> 
                    <div className="w-11 h-11 rounded-[20px] bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/50 hover:text-white transition-all ml-1" onClick={() => fileInputRef.current?.click()}> 
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> 
                    </div> 
                    <div className="w-11 h-11 rounded-[20px] bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer text-white/50 hover:text-white transition-all text-[10px] font-black tracking-wider" onClick={() => setShowGifPicker(!showGifPicker)}>GIF</div> 
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" /> 
                    <input className="bg-transparent flex-1 outline-none text-zinc-100 placeholder-white/30 font-medium px-2 text-[15px]" placeholder={`Message ${active.channel ? "#"+active.channel.name : "@"+active.friend.username}`} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(message)} disabled={isUploading} /> 
                  </div> 
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-6"> 
            <div className="w-24 h-24 rounded-[36px] bg-white/5 border border-white/5 flex items-center justify-center shadow-inner backdrop-blur-sm"> 
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.063-2.33.155-3.456.279M6 7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0124 7.5v11.25a2.25 2.25 0 01-2.25 2.25h-9.568a4.51 4.51 0 00-1.789.365L6 24V7.5z" /></svg> 
            </div> 
            <p className="font-medium tracking-wide text-sm opacity-50 uppercase">No Server Selected</p> 
          </div>
        )}
      </div>

      {/* 4. MEMBER LIST (Lighter Blue Glass) */}
      {view === "servers" && active.server && (
        <div className="w-[260px] rounded-[36px] bg-[#1a1a2e]/60 backdrop-blur-2xl border border-white/5 flex flex-col shadow-2xl flex-shrink-0 overflow-hidden">
          <div className="h-20 flex items-center px-6 font-bold text-white/30 text-[11px] uppercase tracking-widest border-b border-white/5 bg-white/[0.02]">
            Members — {serverMembers.length}
          </div>
          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-2 gap-2 mb-6">
                <button onClick={inviteUser} className="bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold py-3 rounded-xl transition-all border border-white/5">Invite</button>
                <button onClick={leaveServer} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold py-3 rounded-xl transition-all border border-red-500/10">Leave</button>
             </div>
             
             {serverMembers.map(member => (
               <div key={member.id} className="flex items-center gap-3 mb-2 p-2.5 rounded-2xl hover:bg-white/5 group transition-colors cursor-pointer" onClick={() => viewUserProfile(member.id)}>
                 <UserAvatar src={member.avatar_url} className="w-10 h-10 rounded-full object-cover shadow-sm bg-black/40" />
                 <div className="flex-1 min-w-0"> 
                    <div className={`font-bold text-[13px] flex items-center gap-1.5 ${member.id === active.server.owner_id ? "text-yellow-400" : member.is_admin ? "text-emerald-400" : "text-indigo-200"}`}> 
                        <span className="truncate">{member.username}</span> 
                        {member.id === active.server.owner_id && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>} 
                    </div> 
                    <div className="text-[10px] text-white/30 font-medium">#{member.discriminator}</div> 
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* ⚙️ SETTINGS MODAL (Glass) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in">
          <div className="bg-[#0f0f13]/80 w-[440px] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden animate-scale-up ring-1 ring-white/10 backdrop-blur-2xl">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]"> <h2 className="text-xl font-bold text-white tracking-tight">Edit Profile</h2> <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors">✕</button> </div>
            <div className="p-10 flex flex-col gap-8">
              <div className="flex flex-col items-center gap-6">
                <div onClick={() => avatarInputRef.current?.click()} className="relative group cursor-pointer"> {newAvatar ? <img src={URL.createObjectURL(newAvatar)} className="w-32 h-32 rounded-full object-cover border-4 border-white/10 group-hover:border-cyan-500 transition-all shadow-xl" /> : <UserAvatar src={user.avatar_url} className="w-32 h-32 rounded-full object-cover border-4 border-white/10 group-hover:border-cyan-500 transition-all shadow-xl" />} <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg> </div> </div> <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && setNewAvatar(e.target.files[0])} /> 
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2"> <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">Username</label> <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-black/20 border border-white/10 text-white p-4 rounded-2xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium backdrop-blur-sm" /> </div>
                <div className="flex flex-col gap-2"> <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">About Me</label> <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} rows={3} className="bg-black/20 border border-white/10 text-white p-4 rounded-2xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none font-medium backdrop-blur-sm" placeholder="Write something..." /> </div>
              </div>
            </div>
            <div className="p-8 bg-black/20 border-t border-white/5 flex justify-end gap-3"> <button onClick={() => setShowSettings(false)} className="px-6 py-3 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors text-white/40 hover:text-white">CANCEL</button> <button onClick={handleUpdateProfile} className="px-8 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95">SAVE CHANGES</button> </div>
          </div>
        </div>
      )}

      {/* 👤 USER PROFILE MODAL (Glass) */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in" onClick={() => setViewingProfile(null)}>
          <div className="bg-[#121212]/90 w-[380px] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden animate-scale-up ring-1 ring-white/10 backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-tr from-cyan-600 to-blue-600 relative"> <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 p-2 bg-[#121212] rounded-full"> <UserAvatar src={viewingProfile.avatar_url} className="w-28 h-28 rounded-full object-cover border-4 border-[#121212]" /> </div> </div>
            <div className="pt-16 pb-10 px-8 text-center"> <h2 className="text-2xl font-bold text-white tracking-tight">{viewingProfile.username}</h2> <p className="text-white/40 text-xs font-bold tracking-widest mt-1 uppercase">#{viewingProfile.discriminator}</p> <div className="mt-8 bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-sm"> <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">About</h3> <p className="text-zinc-300 text-sm leading-relaxed font-normal"> {viewingProfile.bio || "No bio yet."} </p> </div> </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 🔥 INTELLIGENT MEDIA PLAYER (Glass Video Tiles)
const MediaPlayer = ({ peer, userInfo, onMaximize }: any) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    peer.on("stream", (stream: MediaStream) => {
        if (ref.current) {
            ref.current.srcObject = stream;
            ref.current.play().catch(e => console.error("Autoplay error:", e));
        }
        const videoTracks = stream.getVideoTracks();
        setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);

        if (videoTracks.length > 0) {
            videoTracks[0].onmute = () => setHasVideo(false);
            videoTracks[0].onunmute = () => {
                 setHasVideo(true);
                 if (ref.current) { ref.current.srcObject = stream; ref.current.play(); }
            };
        }
    });
  }, [peer]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/40 overflow-hidden group">
        <video 
            ref={ref} 
            autoPlay 
            playsInline 
            muted={false}
            className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-300 ${hasVideo ? "opacity-100 z-10" : "opacity-0 z-0"}`} 
        />

        {!hasVideo && (
            <div className="z-20 flex flex-col items-center animate-fade-in">
                <UserAvatar src={userInfo?.avatar_url} className="w-28 h-28 rounded-[40px] object-cover border-4 border-white/5 mb-6 shadow-2xl" />
                <span className="text-white font-semibold text-xl tracking-tight">{userInfo?.username || "Connecting..."}</span> 
            </div>
        )}

        {hasVideo && (
            <>
                <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                        onClick={() => onMaximize(ref.current?.srcObject)} 
                        className="bg-black/60 hover:bg-cyan-600 text-white p-2.5 rounded-xl backdrop-blur-md border border-white/20 shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-xs font-bold px-2">VIEW SCREEN</span>
                    </button>
                </div>
                <div className="absolute bottom-4 left-4 z-30 bg-black/60 px-4 py-1.5 rounded-full text-white text-xs font-bold border border-white/10 backdrop-blur-md">
                    {userInfo?.username || "Unknown"}
                </div>
            </>
        )}
    </div>
  );
};