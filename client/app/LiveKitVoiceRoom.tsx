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

  useEffect(() => {
    const updateAvatar = () => {
      if (participant.metadata) {
        try {
          const meta = JSON.parse(participant.metadata);
          if (meta.avatarUrl) {
            setAvatarUrl(meta.avatarUrl);
            return;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      setAvatarUrl("");
    };

    updateAvatar();
    
    const onMetadataChanged = () => updateAvatar();
    
    // 👇 FIX: Cast to 'any' to bypass TypeScript enum error
    // The event 'metadataChanged' works at runtime, TS just complains about the enum key.
    participant.on('metadataChanged' as any, onMetadataChanged);

    return () => {
      participant.off('metadataChanged' as any, onMetadataChanged);
    };
  }, [participant, participant.metadata]);

  // Fallback to seed based on identity if no custom avatar found
  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.identity}`;

  return (
    <div className={`relative aspect-square bg-zinc-800 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-200 ${isSpeaking ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "border-white/5"}`}>
        <img 
            src={finalAvatar} 
            alt={participant.identity}
            className={`w-16 h-16 rounded-full mb-3 object-cover transition-transform ${isSpeaking ? "scale-110" : "scale-100"}`}
        />
        <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm truncate max-w-[100px]">
                {participant.identity}
            </span>
            {participant.isMicrophoneEnabled ? <span className="text-[10px] text-white/50">🎙️</span> : <span className="text-[10px] text-red-400">🔇</span>}
        </div>
        {isSpeaking && (
            <div className="absolute bottom-4 flex gap-1 h-3 items-end">
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