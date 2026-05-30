import { NextRequest, NextResponse } from "next/server";
import { getPhaseConfig, isLearningPhase, type LearningPhase } from "@/lib/realtime/phases";
import type {
  RealtimeBootstrapRequest,
  RealtimeBootstrapResponse,
} from "@/types/realtime";

export const runtime = "edge";

const DEFAULT_MODEL = (() => {
  const configured = process.env.NEXT_PUBLIC_REALTIME_MODEL?.trim();
  if (!configured || configured === "models/gemini-2.0-flash-live-001") {
    return "gemini-live-2.5-flash-preview";
  }
  return configured;
})();
const DEFAULT_WS_URL =
  process.env.GEMINI_LIVE_WS_URL ??
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const DEFAULT_VOICE = process.env.GEMINI_LIVE_VOICE ?? "Aoede";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function generateSessionId() {
  return crypto.randomUUID();
}

export async function POST(request: NextRequest) {
  let body: RealtimeBootstrapRequest;

  try {
    body = (await request.json()) as RealtimeBootstrapRequest;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const phase: LearningPhase = isLearningPhase(body.phase) ? body.phase : "phase1";
  const wantsVideo = Boolean(body.wantsVideo);
  const wantsAudio = body.wantsAudio !== false;

  if (!wantsAudio) {
    return jsonError("Audio is required for AmbientEcho sessions");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError("Missing GEMINI_API_KEY on server", 500);
  }

  const sessionId = generateSessionId();
  const phaseConfig = getPhaseConfig(phase);

  const response: RealtimeBootstrapResponse = {
    sessionId,
    model: DEFAULT_MODEL,
    wsUrl: DEFAULT_WS_URL,
    apiKey,
    phase,
    prompt: phaseConfig.systemPrompt,
    voiceName: DEFAULT_VOICE,
    inputAudioMimeType: "audio/pcm;rate=16000",
    outputAudioMimeType: "audio/pcm;rate=24000",
    capabilities: {
      video: wantsVideo,
      audio: wantsAudio,
      bargeIn: true,
      backgroundAudio: true,
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
