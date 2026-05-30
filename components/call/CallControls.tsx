"use client";

import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react";
import type { LearningPhase } from "@/types/realtime";

type PhaseOption = {
  value: LearningPhase;
  label: string;
};

type CallControlsProps = {
  phase: LearningPhase;
  phases: PhaseOption[];
  isMuted: boolean;
  isCameraEnabled: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  onPhaseChange: (phase: LearningPhase) => void;
};

type ControlButtonProps = {
  active?: boolean;
  danger?: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
};

function ControlButton({
  active = false,
  danger = false,
  label,
  onClick,
  icon,
}: ControlButtonProps) {
  const tone = danger
    ? "border-rose-400/30 bg-rose-500/18 text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.16)]"
    : active
      ? "border-cyan-400/30 bg-cyan-400/14 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.14)]"
      : "border-white/10 bg-white/6 text-white/82";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-14 min-w-14 items-center justify-center rounded-2xl border px-4 backdrop-blur-xl transition duration-200 hover:scale-[1.02] hover:bg-white/10 ${tone}`}
      aria-label={label}
      title={label}
    >
      <span className="flex items-center justify-center">{icon}</span>
    </button>
  );
}

export function CallControls({
  phase,
  phases,
  isMuted,
  isCameraEnabled,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  onPhaseChange,
}: CallControlsProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-[28px] border border-white/10 bg-black/20 p-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 flex-1 items-center">
        <div className="inline-flex w-full max-w-full rounded-2xl border border-white/10 bg-white/5 p-1">
          {phases.map((item) => {
            const selected = phase === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onPhaseChange(item.value)}
                className={[
                  "flex-1 rounded-xl px-3 py-2 text-sm transition duration-200",
                  selected
                    ? "bg-cyan-400/16 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]"
                    : "text-white/62 hover:bg-white/6 hover:text-white/86",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <ControlButton
          active={!isMuted}
          label={isMuted ? "取消麦克风静音" : "静音麦克风"}
          onClick={onToggleMute}
          icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        />

        <ControlButton
          active={isCameraEnabled}
          label={isCameraEnabled ? "关闭摄像头" : "开启摄像头"}
          onClick={onToggleCamera}
          icon={isCameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        />

        <ControlButton
          danger
          label="结束通话"
          onClick={onEndCall}
          icon={<PhoneOff className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
