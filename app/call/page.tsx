"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react";
import { CallControls } from "@/components/call/CallControls";
import { RealtimeOverlay } from "@/components/call/RealtimeOverlay";
import { SessionStatus } from "@/components/call/SessionStatus";
import {
  type AssistantState,
  type LearningPhase,
  useRealtimeStream,
} from "@/hooks/useRealtimeStream";

const phaseOptions: Array<{ value: LearningPhase; label: string }> = [
  { value: "phase1", label: "阶段 1" },
  { value: "phase2", label: "阶段 2" },
  { value: "phase3", label: "阶段 3" },
];

export default function CallPage() {
  const [phase, setPhase] = useState<LearningPhase>("phase1");
  const [aiState, setAiState] = useState<AssistantState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);

  const {
    status,
    sessionMode,
    isMuted,
    isCameraEnabled,
    isAiSpeaking,
    debugInfo,
    localStream,
    remoteAudioRef,
    startSession,
    endSession,
    toggleMute,
    toggleCamera,
    setPhase: syncPhase,
  } = useRealtimeStream({
    phase,
    videoFps: 6,
    enableVideo: true,
    enableAudio: true,
    onAiStateChange: setAiState,
    onTranscript: (text, role) => {
      if (role === "assistant") {
        setTranscript(text);
      }
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    void startSession();
    return () => endSession();
  }, [startSession, endSession]);

  useEffect(() => {
    if (!backgroundVideoRef.current || !localStream) {
      return;
    }

    backgroundVideoRef.current.srcObject = localStream;
    void backgroundVideoRef.current.play().catch(() => undefined);
  }, [localStream]);

  const chromeTone = useMemo(() => {
    if (aiState === "speaking") return "cyan";
    if (aiState === "thinking") return "violet";
    if (aiState === "listening") return "emerald";
    return "zinc";
  }, [aiState]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="absolute inset-0">
        <video
          ref={backgroundVideoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,6,23,0.48)_72%,rgba(0,0,0,0.84)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.18)_28%,rgba(2,6,23,0.38)_64%,rgba(0,0,0,0.82)_100%)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-start justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/28 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.8)]" />
              AmbientEcho
            </div>
            <SessionStatus
              status={status}
              sessionMode={sessionMode}
              aiState={aiState}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/24 px-3 py-2 backdrop-blur-xl">
            <div className="text-[10px] tracking-[0.22em] text-white/40">
              当前模式
            </div>
            <div className="mt-1 text-sm font-medium text-white/88">
              {sessionMode === "foreground" ? "前台视觉通话" : "后台语音通话"}
            </div>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 sm:px-6">
          <div className="relative flex w-full max-w-5xl flex-1 items-center justify-center">
            <RealtimeOverlay
              aiState={aiState}
              isAiSpeaking={isAiSpeaking}
              chromeTone={chromeTone}
              transcript={transcript}
            />
          </div>
        </div>

        <footer className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <CallControls
            phase={phase}
            phases={phaseOptions}
            isMuted={isMuted}
            isCameraEnabled={isCameraEnabled}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onEndCall={endSession}
            onPhaseChange={(next) => {
              setPhase(next);
              syncPhase(next);
            }}
          />
        </footer>
      </div>

      <div className="pointer-events-none absolute bottom-28 left-4 flex gap-2 sm:left-6">
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/72 backdrop-blur-md">
          {isMuted ? (
            <span className="inline-flex items-center gap-2">
              <MicOff className="h-3.5 w-3.5 text-rose-300" />
              麦克风已静音
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-emerald-300" />
              麦克风已开启
            </span>
          )}
        </div>

        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/72 backdrop-blur-md">
          {isCameraEnabled ? (
            <span className="inline-flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-cyan-300" />
              摄像头已开启
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <CameraOff className="h-3.5 w-3.5 text-white/55" />
              纯语音模式
            </span>
          )}
        </div>

        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/72 backdrop-blur-md">
          <span className="inline-flex items-center gap-2">
            <PhoneOff className="h-3.5 w-3.5 text-white/50" />
            可随时结束
          </span>
        </div>
      </div>

      {errorMessage ? (
        <div className="absolute left-4 right-4 top-24 z-20 space-y-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 backdrop-blur-md sm:left-6 sm:right-auto sm:max-w-md">
          <div className="font-medium">{errorMessage}</div>
          {debugInfo.length ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-rose-100/70">
                Connection Diagnostics
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-rose-50/90">
                {debugInfo.join("\n")}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
