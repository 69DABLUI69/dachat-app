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

// 1. Custom Tile to show Avatar instead of black screen
function CustomParticipantTile({ trackRef, user }: { trackRef: TrackReferenceOrPlaceholder, user: any }) {
  return (
    <ParticipantTile 
      trackRef={trackRef} 
      className="border border-white/10 rounded-xl overflow-hidden bg-zinc-900"
    >
      {/* Overlay Avatar since we are audio-only */}
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
         <div className="relative">
            <img 
              src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=guest"} 
              className="w-20 h-20 rounded-full border-4 border-white/10"
              alt="User"
            />
            {/* Visualizer / Speaking Indicator would go here */}
         </div>
      </div>
    </ParticipantTile>
  );
}

// 2. Grid Component
function MyParticipantGrid({ user }: { user: any }) {
  // Get all audio tracks (since we are voice only)
  const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown], { onlySubscribed: false });
  
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      {/* Render a custom tile for each user */}
      <CustomParticipantTile user={user} trackRef={tracks[0]} /> 
    </GridLayout>
  );
}

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

  if (token === "") return <div className="flex items-center justify-center h-full text-white/50">Connecting...</div>;

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
         {/* We pass the 'ParticipantTile' layout to the grid */}
         <GridLayout tracks={useTracks([Track.Source.Microphone], { onlySubscribed: false })}>
            <ParticipantTile />
         </GridLayout>
      </div>

      {/* Controls (Mute, Leave, etc) */}
      <ControlBar 
        variation="minimal" 
        controls={{ microphone: true, camera: false, screenShare: false, chat: false, settings: true, leave: true }}
      />
      
      {/* Essential for hearing audio */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}