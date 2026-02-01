"use client";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useIsSpeaking,
  LayoutContextProvider,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Participant, Track } from "livekit-client";

// ✅ 1. DEFINE BACKEND URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dachat-app.onrender.com";

// 2. Individual User Tile (Updated with Stop Watching logic)
function VoiceUserTile({ 
    participant, 
    screenTrackRef, 
    isWatching, // 🆕 New prop to check active state
    onWatch 
}: { 
    participant: Participant, 
    screenTrackRef?: any, 
    isWatching?: boolean,
    onWatch?: () => void 
}) {
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

  return (
    <div 
        className={`group relative w-full h-full bg-[#2b2d31] rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-200 shadow-xl ${isSpeaking ? "ring-2 ring-green-500" : "hover:bg-[#313338]"}`} 
        onClick={() => setShowVolume(false)}
    >
        {/* 🔴 STREAMING BADGE & BUTTON */}
        {screenTrackRef && (
            <div className="absolute top-3 left-3 z-30 flex gap-2">
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">LIVE</span>
                
                {/* 🆕 Dynamic Watch/Stop Button */}
                {!participant.isLocal && onWatch && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onWatch(); }}
                        className={`text-[10px] font-bold px-3 py-1 rounded shadow-lg transition-transform hover:scale-105 active:scale-95 ${
                            isWatching 
                            ? "bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/50" 
                            : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        }`}
                    >
                        {isWatching ? "Stop Watching ✕" : "Watch Stream 👁️"}
                    </button>
                )}
            </div>
        )}

        <div className="relative">
            <img src={finalAvatar} alt={participant.identity} className={`w-16 h-16 md:w-24 md:h-24 rounded-full mb-4 object-cover transition-transform duration-300 ${isSpeaking ? "scale-110 border-2 border-green-500" : "scale-100"}`} />
            {isSpeaking && <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#2b2d31] rounded-full flex items-center justify-center"><div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div></div>}
        </div>
        
        {/* Mobile Volume Toggle */}
        {!participant.isLocal && (
          <>
            <button 
                onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); }}
                className={`absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:bg-black hover:text-white transition-all md:opacity-0 md:group-hover:opacity-100 ${showVolume ? "opacity-100 bg-green-600 text-white" : ""}`}
            >
                {showVolume ? "✕" : "🔊"}
            </button>
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-2xl p-6 z-10 transition-all duration-200 
                ${showVolume ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"}`}
            >
               <span className="text-xs font-bold text-white/50 uppercase mb-2 tracking-widest">User Volume</span>
               <input 
                  type="range" min="0" max="1" step="0.1" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full max-w-[150px] accent-green-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer mb-2"
               />
               <span className="text-sm font-mono font-bold text-green-400">{Math.round(volume * 100)}%</span>
            </div>
          </>
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            <span className="text-white font-bold text-sm truncate max-w-[120px]">
                {participant.identity} {participant.isLocal && "(You)"}
            </span>
            {participant.isMicrophoneEnabled ? null : <span className="text-[10px] text-red-400">🔇</span>}
        </div>
    </div>
  );
}

// 3. Grid Component - Handles Logic for Choosing Streams
function MyParticipantGrid({ children }: { children?: React.ReactNode }) {
  const participants = useParticipants(); 
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  
  // State: Which stream is the user actively watching?
  const [viewingTrack, setViewingTrack] = useState<any>(null);

  // Auto-close stream if the user stops sharing
  useEffect(() => {
      if (viewingTrack) {
          const stillExists = screenTracks.find(t => t.participant.identity === viewingTrack.participant.identity);
          if (!stillExists) setViewingTrack(null);
      }
  }, [screenTracks, viewingTrack]);

  // 🅰️ LAYOUT A: Watching a Specific Stream
  if (viewingTrack) {
    return (
        <div className="flex flex-col h-full w-full bg-[#111214]">
            {/* STAGE: The Screen Share */}
            <div className="flex-1 w-full relative p-2 min-h-0 flex flex-col">
                <div className="flex justify-between items-center mb-2 px-2">
                    <div className="text-white font-bold flex items-center gap-2">
                        <span className="text-red-500 animate-pulse">●</span>
                        Watching {viewingTrack.participant.identity}'s Stream
                    </div>
                    <button 
                        onClick={() => setViewingTrack(null)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/10"
                    >
                        Exit Stream ✕
                    </button>
                </div>

                <div className="flex-1 w-full bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl relative group">
                    <VideoTrack 
                        trackRef={viewingTrack} 
                        className="w-full h-full object-contain"
                    />
                </div>
            </div>

            {/* STRIP: Participants & Music Player */}
            <div className="h-40 shrink-0 w-full overflow-x-auto custom-scrollbar border-t border-white/5 bg-[#1e1f22]/50">
                <div className="flex items-center gap-3 p-3 h-full min-w-max">
                    {/* Music Player (Smaller in this view) */}
                    {children && (
                        <div className="w-64 h-full shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/5">
                            {children}
                        </div>
                    )}
                    
                    {/* User Tiles (Row) */}
                    {participants.map((p) => {
                        const trackRef = screenTracks.find(t => t.participant.identity === p.identity);
                        const isThisUser = viewingTrack?.participant.identity === p.identity;

                        return (
                            <div key={p.identity} className="w-48 h-full shrink-0">
                                <VoiceUserTile 
                                    participant={p} 
                                    screenTrackRef={trackRef} 
                                    isWatching={isThisUser} // 🆕 Pass active state
                                    onWatch={() => isThisUser ? setViewingTrack(null) : setViewingTrack(trackRef)} // 🆕 Toggle stream
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
  }

  // 🅱️ LAYOUT B: Standard Grid (Choosing a Stream)
  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar relative bg-[#111214]">
      <div className="flex flex-wrap items-center justify-center content-center gap-4 p-4 w-full min-h-full">
        
        {/* 🎵 Music Player Tile */}
        {children && (
            <div className="relative w-full md:w-[48%] lg:w-[32%] h-64 md:h-80 bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 shadow-xl hover:ring-1 hover:ring-indigo-500/50 transition-all shrink-0">
               {children}
            </div>
        )}

        {/* 👥 Participant Tiles */}
        {participants.map((p) => {
          // Find if this specific user is sharing
          const trackRef = screenTracks.find(t => t.participant.identity === p.identity);
          
          return (
            <div key={p.identity} className="w-full md:w-[48%] lg:w-[32%] h-64 md:h-80">
               <VoiceUserTile 
                  participant={p} 
                  screenTrackRef={trackRef}
                  onWatch={() => setViewingTrack(trackRef)} // Pass click handler
               />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 4. Main Component
export default function LiveKitVoiceRoom({ room, user, onLeave, children }: any) {
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
        video={true} // ✅ Allow Video (Screen Share)
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
        onDisconnected={onLeave} 
      >
        <div className="flex-1 overflow-hidden bg-[#111214]"> 
           {/* Pass the Music Player (children) into the Grid */}
           <MyParticipantGrid>{children}</MyParticipantGrid>
        </div>

        {/* Discord Style Control Bar */}
        <div className="bg-[#1e1f22] p-3 border-t border-black/20 flex justify-center">
            <ControlBar 
              variation="minimal" 
              controls={{ microphone: true, camera: false, screenShare: true, chat: false, settings: true, leave: true }}
            />
        </div>
        
        <RoomAudioRenderer />
      </LiveKitRoom>
    </LayoutContextProvider>
  );
}