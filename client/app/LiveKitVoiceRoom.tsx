"use client";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useIsSpeaking,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Participant } from "livekit-client";

export default function LiveKitVoiceRoom({ room, user, onLeave }: any) {
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 👇 PASS avatarUrl here
        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/livekit/token?roomName=${room}&participantName=${user.username}&avatarUrl=${encodeURIComponent(user.avatar_url)}`
        );
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [room, user?.username, user?.avatar_url]);

  if (token === "") return <div className="text-white/50 p-4">Connecting to Voice...</div>;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true} // 👈 Force connection
      data-lk-theme="default"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onDisconnected={onLeave}
    >
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <MyParticipantGrid />
      </div>
      {/* 👇 Standard control bar handles Mute/Unmute automatically */}
      <ControlBar /> 
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function MyParticipantGrid() {
  const participants = useParticipants();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {participants.map((p) => (
        <VoiceUserTile key={p.identity} participant={p} />
      ))}
    </div>
  );
}

function VoiceUserTile({ participant }: { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const [avatarUrl, setAvatarUrl] = useState("");

  // 👇 Extract Avatar URL from Metadata
  useEffect(() => {
    if (participant.metadata) {
      try {
        const meta = JSON.parse(participant.metadata);
        if (meta.avatarUrl) setAvatarUrl(meta.avatarUrl);
      } catch (e) {
        // Metadata might not be JSON, ignore
      }
    }
  }, [participant.metadata]);

  // Fallback to identity seed if no metadata avatar
  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.identity}`;

  return (
    <div className={`relative aspect-square bg-zinc-800 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-200 ${isSpeaking ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "border-white/5"}`}>
        {/* Avatar */}
        <img 
            src={finalAvatar} 
            alt={participant.identity}
            className={`w-16 h-16 rounded-full mb-3 object-cover transition-transform ${isSpeaking ? "scale-110" : "scale-100"}`}
        />
        
        {/* Name */}
        <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm truncate max-w-[100px]">
                {participant.identity}
            </span>
            {/* Mic Status Icon */}
            {participant.isMicrophoneEnabled ? (
                <span className="text-[10px] text-white/50">🎤</span>
            ) : (
                <span className="text-[10px] text-red-400">🔇</span>
            )}
        </div>

        {/* Visualizer Bar */}
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