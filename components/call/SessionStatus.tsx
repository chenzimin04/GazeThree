"use client";

import type { AssistantState, RealtimeStatus, SessionMode } from "@/types/realtime";

type SessionStatusProps = {
  status: RealtimeStatus;
  sessionMode: SessionMode;
  aiState: AssistantState;
};

function statusTone(status: RealtimeStatus) {
  if (status === "connected") return "text-emerald-300";
  if (status === "connecting" || status === "bootstrapping" || status === "reconnecting") {
    return "text-cyan-300";
  }
  if (status === "error") return "text-rose-300";
  return "text-white/65";
}

export function SessionStatus({
  status,
  sessionMode,
  aiState,
}: SessionStatusProps) {
  const statusLabel =
    status === "idle"
      ? "空闲"
      : status === "bootstrapping"
        ? "初始化中"
        : status === "connecting"
          ? "连接中"
          : status === "connected"
            ? "已连接"
            : status === "reconnecting"
              ? "重连中"
              : status === "ended"
                ? "已结束"
                : "错误";

  const aiLabel =
    aiState === "idle"
      ? "待命"
      : aiState === "listening"
        ? "聆听"
        : aiState === "thinking"
          ? "思考"
          : "说话";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/24 px-3 py-2 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`font-medium uppercase tracking-[0.22em] ${statusTone(status)}`}>
          {statusLabel}
        </span>
        <span className="text-white/28">/</span>
        <span className="tracking-[0.18em] text-white/55">
          {sessionMode === "foreground" ? "视觉模式" : "语音模式"}
        </span>
        <span className="text-white/28">/</span>
        <span className="tracking-[0.18em] text-white/55">
          {aiLabel}
        </span>
      </div>
    </div>
  );
}
