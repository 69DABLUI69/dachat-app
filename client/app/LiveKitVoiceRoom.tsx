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
  const [volume, setVolume] = useState(1); 
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

  // Discord-style: Darker card, cleaner border
  return (
    <div className={`group relative w-full aspect-square bg-[#1e1f22] rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all duration-200 ${isSpeaking ? "ring-2 ring-green-500" : "hover:bg-[#404249]"}`} onClick={() => setShowVolume(false)}>
        <img src={finalAvatar} alt={participant.identity} className={`w-14 h-14 rounded-full mb-2 object-cover transition-transform ${isSpeaking ? "scale-105" : "scale-100"}`} />
        
        {/* Mobile Volume Toggle & Desktop Hover */}
        {!participant.isLocal && (
          <>
            <button 
                onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); }}
                className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white/70 md:opacity-0 md:group-hover:opacity-100 ${showVolume ? "opacity-100 bg-green-600 text-white" : ""}`}
            >
                {showVolume ? "✕" : "🔊"}
            </button>
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-xl p-2 z-10 transition-all duration-200 
                ${showVolume ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"}`}
            >
               <input 
                  type="range" min="0" max="1" step="0.1" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-green-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer mb-1"
               />
               <span className="text-[10px] font-mono font-bold text-green-400">{Math.round(volume * 100)}%</span>
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5 relative z-0 max-w-full px-2">
            <span className="text-white font-bold text-xs truncate">
                {participant.identity} {participant.isLocal && "(You)"}
            </span>
            {participant.isMicrophoneEnabled ? null : <span className="text-[10px] text-red-400">🔇</span>}
        </div>
        
        {/* Green Ring Animation for Speaking */}
        {isSpeaking && (
             <div className="absolute inset-0 rounded-xl ring-2 ring-green-500 animate-pulse pointer-events-none" />
        )}
    </div>
  );
}

// 3. Grid Component - Optimized for Sidebar (2 Columns)
function MyParticipantGrid() {
  const participants = useParticipants(); 

  return (
    // Discord sidebar style: simple grid with minimal gaps
    <div className="grid grid-cols-2 gap-2 p-2 h-full content-start overflow-y-auto custom-scrollbar">
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

  if (token === "") return <div className="flex items-center justify-center h-full text-white/50 animate-pulse text-xs uppercase tracking-widest">Connecting...</div>;

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
        <div className="flex-1 overflow-hidden bg-[#2b2d31]">
           <MyParticipantGrid />
        </div>

        {/* Discord Style: Control Bar at bottom of sidebar */}
        <div className="bg-[#1e1f22] p-2 border-t border-black/20">
            <ControlBar 
              variation="minimal" 
              controls={{ microphone: true, camera: false, screenShare: false, chat: false, settings: true, leave: true }}
            />
        </div>
        
        <RoomAudioRenderer />
      </LiveKitRoom>
    </LayoutContextProvider>
  );
}