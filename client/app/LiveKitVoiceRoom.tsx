"use client";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

// 1. Custom Tile (Shows Avatar if no video)
function CustomParticipantTile({ trackRef, user, ...props }: { trackRef?: TrackReferenceOrPlaceholder, user: any }) {
  // GridLayout injects 'trackRef' automatically into this component
  return (
    <ParticipantTile 
      trackRef={trackRef} 
      className="border border-white/10 rounded-xl overflow-hidden bg-zinc-900 shadow-lg"
      {...props}
    >
      {/* We overlay the avatar because this is a voice-only room */}
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
         <div className="relative flex flex-col items-center gap-3">
            <img 
              src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=guest"} 
              className="w-20 h-20 rounded-full border-4 border-white/10 shadow-xl"
              alt="User"
            />
            {/* You could add a speaking indicator here later */}
         </div>
      </div>
    </ParticipantTile>
  );
}

// 2. Grid Component (MUST be a separate component to use hooks)
function MyParticipantGrid({ user }: { user: any }) {
  // ✅ Hook is called here, inside the Room context
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      {/* GridLayout will clone this element and pass a 'trackRef' to it for every user */}
      <CustomParticipantTile user={user} />
    </GridLayout>
  );
}

// 3. Main Room Component
export default function LiveKitVoiceRoom({ room, user, onLeave }: any) {
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/livekit/token?roomName=${room}&participantName=${user.username}`
        );
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [room, user?.username]);

  if (token === "") return <div className="flex items-center justify-center h-full text-white/50 animate-pulse">Connecting to Voice...</div>;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onDisconnected={onLeave} 
    >
      {/* Main Grid Area */}
      <div className="flex-1 overflow-hidden p-4">
         {/* ✅ We render the child component here */}
         <MyParticipantGrid user={user} />
      </div>

      {/* Controls (Mute, Leave, etc) */}
      <ControlBar 
        variation="minimal" 
        controls={{ microphone: true, camera: false, screenShare: false, chat: false, settings: true, leave: true }}
      />
      
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}