"use client";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useIsSpeaking,
  LayoutContextProvider,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Participant } from "livekit-client";

// ✅ 1. DEFINE BACKEND URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dachat-app.onrender.com";

// 2. Individual User Tile
function VoiceUserTile({ participant }: { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const [avatarUrl, setAvatarUrl] = useState("");
  // 🔊 Local Volume State
  const [volume, setVolume] = useState(1); 
  // 📱 Mobile Toggle State
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    participant.audioTrackPublications.forEach((publication) => {
      if (publication.track && publication.track.kind === 'audio') {
        // @ts-ignore
        if(publication.track.setVolume) { (publication.track as any).setVolume(volume); }
        else { const el = publication.track.attachedElements?.[0]; if(el) el.volume = volume; }
      }
    });
  }, [volume, participant]);

  useEffect(() => {
    const updateAvatar = () => {
      if (participant.metadata) {
        try { const meta = JSON.parse(participant.metadata); if (meta.avatarUrl) { setAvatarUrl(meta.avatarUrl); return; } } catch (e) {}
      }
      setAvatarUrl("");
    };
    updateAvatar();
    participant.on('metadataChanged' as any, updateAvatar);
    return () => { participant.off('metadataChanged' as any, updateAvatar); };
  }, [participant, participant.metadata]);

  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.identity}`;

  return (
    <div className={`group relative aspect-square bg-zinc-800 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-200 ${isSpeaking ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "border-white/5"}`} onClick={() => setShowVolume(false)}>
        <img src={finalAvatar} alt={participant.identity} className={`w-16 h-16 rounded-full mb-3 object-cover transition-transform ${isSpeaking ? "scale-110" : "scale-100"}`} />
        
        {/* 🔊 CONTROLS OVERLAY */}
        {!participant.isLocal && (
          <>
            {/* 📱 Mobile Toggle Button (Always visible on mobile, hidden on hover) */}
            <button 
                onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); }}
                className={`absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:bg-black hover:text-white transition-all md:opacity-0 md:group-hover:opacity-100 ${showVolume ? "opacity-100 bg-green-600 text-white" : ""}`}
            >
                {showVolume ? "✕" : "🔊"}
            </button>

            {/* Volume Slider Overlay */}
            <div 
                onClick={(e) => e.stopPropagation()} // Prevent closing when using slider
                className={`absolute inset-0 bg-black/85 flex flex-col items-center justify-center rounded-2xl p-4 z-10 backdrop-blur-sm transition-all duration-200 
                ${showVolume ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"}`}
            >
               <span className="text-[10px] font-bold text-white/50 mb-2 uppercase tracking-widest">User Volume</span>
               <input 
                  type="range" min="0" max="1" step="0.1" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-green-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer mb-2"
               />
               <span className="text-xs font-mono font-bold text-green-400">{Math.round(volume * 100)}%</span>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 relative z-0">
            <span className="text-white font-bold text-sm truncate max-w-[100px]">{participant.identity} {participant.isLocal && "(You)"}</span>
            {participant.isMicrophoneEnabled ? <span className="text-[10px] text-white/50">🎙️</span> : <span className="text-[10px] text-red-400">🔇</span>}
        </div>
        
        {isSpeaking && (
            <div className="absolute bottom-4 flex gap-1 h-3 items-end z-0">
                <div className="w-1 bg-green-500 animate-bounce" style={{ height: '60%', animationDelay: '0ms' }} />
                <div className="w-1 bg-green-500 animate-bounce" style={{ height: '100%', animationDelay: '100ms' }} />
                <div className="w-1 bg-green-500 animate-bounce" style={{ height: '80%', animationDelay: '200ms' }} />
            </div>
        )}
    </div>
  );
}

// 3. Grid Component (Iterates over all participants)
function MyParticipantGrid() {
  const participants = useParticipants(); // Get all users in the room

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 h-full content-start overflow-y-auto custom-scrollbar">
      {participants.map((p) => (
        <VoiceUserTile key={p.identity} participant={p} />
      ))}
    </div>
  );
}

// 4. Main Component
export default function LiveKitVoiceRoom({ room, user, onLeave }: any) {
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `${BACKEND_URL}/livekit/token?roomName=${room}&participantName=${user.username}&avatarUrl=${encodeURIComponent(user.avatar_url)}`
        );
        if (!resp.ok) throw new Error("Failed to fetch token");
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error("Token Error:", e);
      }
    })();
  }, [room, user?.username, user?.avatar_url]);

  if (token === "") return <div className="flex items-center justify-center h-full text-white/50 animate-pulse">Connecting to Voice...</div>;

  return (
    <LayoutContextProvider>
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
        onDisconnected={onLeave} 
      >
        <div className="flex-1 overflow-hidden bg-zinc-950/50">
           <MyParticipantGrid />
        </div>

        <ControlBar 
          variation="minimal" 
          controls={{ microphone: true, camera: false, screenShare: false, chat: false, settings: true, leave: true }}
        />
        
        <RoomAudioRenderer />
      </LiveKitRoom>
    </LayoutContextProvider>
  );
}