"use client";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  GridLayout,
  ParticipantTile,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

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

  if (token === "") return <div className="text-white/50 p-4">Connecting to Voice...</div>;

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
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <MyParticipantGrid />
      </div>
      <ControlBar />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function MyParticipantGrid() {
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  );
}