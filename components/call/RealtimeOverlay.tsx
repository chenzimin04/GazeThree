"use client";

import type { AssistantState } from "@/types/realtime";

type RealtimeOverlayProps = {
  aiState: AssistantState;
  isAiSpeaking: boolean;
  chromeTone?: "cyan" | "violet" | "emerald" | "zinc";
  transcript?: string;
};

const toneMap = {
  cyan: {
    ring: "rgba(34,211,238,0.42)",
    glow: "rgba(34,211,238,0.22)",
    text: "text-cyan-100",
    line: "stroke-cyan-300/90",
  },
  violet: {
    ring: "rgba(168,85,247,0.42)",
    glow: "rgba(168,85,247,0.22)",
    text: "text-violet-100",
    line: "stroke-violet-300/90",
  },
  emerald: {
    ring: "rgba(52,211,153,0.42)",
    glow: "rgba(52,211,153,0.22)",
    text: "text-emerald-100",
    line: "stroke-emerald-300/90",
  },
  zinc: {
    ring: "rgba(161,161,170,0.30)",
    glow: "rgba(161,161,170,0.18)",
    text: "text-zinc-100",
    line: "stroke-zinc-300/80",
  },
};

function labelForState(state: AssistantState) {
  if (state === "speaking") return "AI 正在说话";
  if (state === "thinking") return "AI 正在思考";
  if (state === "listening") return "AI 正在聆听";
  return "待命中";
}

export function RealtimeOverlay({
  aiState,
  isAiSpeaking,
  chromeTone = "cyan",
  transcript,
}: RealtimeOverlayProps) {
  const tone = toneMap[chromeTone];
  const pulseClass =
    aiState === "speaking"
      ? "animate-[pulse_1.15s_ease-in-out_infinite]"
      : aiState === "thinking"
        ? "animate-[pulse_2.1s_ease-in-out_infinite]"
        : "animate-[pulse_3.6s_ease-in-out_infinite]";

  return (
    <div className="pointer-events-none relative flex w-full items-center justify-center">
      <div className="absolute inset-x-0 top-[18%] mx-auto max-w-2xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-md">
          <span
            className={`h-2.5 w-2.5 rounded-full ${isAiSpeaking ? "bg-cyan-300" : "bg-white/45"}`}
            style={{
              boxShadow: isAiSpeaking
                ? "0 0 18px rgba(34,211,238,0.85)"
                : "0 0 10px rgba(255,255,255,0.2)",
            }}
          />
          <span className={`text-xs uppercase tracking-[0.22em] ${tone.text}`}>
            {labelForState(aiState)}
          </span>
        </div>

        {transcript ? (
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-6 text-white/82 sm:text-base">
            {transcript}
          </p>
        ) : null}
      </div>

      <div className="relative flex h-[52vmin] w-[52vmin] min-h-[260px] min-w-[260px] max-h-[520px] max-w-[520px] items-center justify-center">
        <div
          className={`absolute inset-[10%] rounded-full blur-3xl ${pulseClass}`}
          style={{
            background: `radial-gradient(circle, ${tone.glow} 0%, transparent 70%)`,
          }}
        />

        <div
          className="absolute inset-[18%] rounded-full border"
          style={{ borderColor: tone.ring }}
        />
        <div
          className={`absolute inset-[26%] rounded-full border ${pulseClass}`}
          style={{ borderColor: tone.ring }}
        />
        <div
          className="absolute inset-[34%] rounded-full border"
          style={{ borderColor: "rgba(255,255,255,0.16)" }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 420 140"
            className="h-32 w-[82%] drop-shadow-[0_0_20px_rgba(34,211,238,0.28)] sm:h-36"
            fill="none"
          >
            <path
              d="M10 70
                 C 28 70, 28 34, 46 34
                 C 64 34, 64 106, 82 106
                 C 100 106, 100 54, 118 54
                 C 136 54, 136 86, 154 86
                 C 172 86, 172 18, 190 18
                 C 208 18, 208 122, 226 122
                 C 244 122, 244 52, 262 52
                 C 280 52, 280 92, 298 92
                 C 316 92, 316 42, 334 42
                 C 352 42, 352 70, 370 70
                 C 388 70, 388 70, 410 70"
              className={`${tone.line} ${isAiSpeaking ? "animate-[pulse_0.9s_ease-in-out_infinite]" : ""}`}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="absolute bottom-[16%] text-center">
          <div className="text-[10px] tracking-[0.26em] text-white/36">
            ambient echo
          </div>
          <div className="mt-2 text-sm text-white/72">
            {aiState === "thinking"
              ? "正在处理画面和语音上下文"
              : aiState === "listening"
                ? "已准备好被打断"
                : aiState === "speaking"
                  ? "实时教练回复中"
                  : "等待会话开始"}
          </div>
        </div>
      </div>
    </div>
  );
}
