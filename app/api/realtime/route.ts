import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { getPhaseConfig, isLearningPhase, type LearningPhase } from "@/lib/realtime/phases";
import type {
  RealtimeBootstrapRequest,
  RealtimeBootstrapResponse,
} from "@/types/realtime";

export const runtime = "nodejs";

const DEFAULT_MODEL = (() => {
  const configured = process.env.NEXT_PUBLIC_REALTIME_MODEL?.trim();
  if (
    !configured ||
    configured === "models/gemini-2.0-flash-live-001" ||
    configured === "gemini-2.0-flash-live-001" ||
    configured === "gemini-live-2.5-flash-preview"
  ) {
    return "gemini-3.1-flash-live-preview";
  }
  return configured;
})();
const DEFAULT_VOICE = process.env.GEMINI_LIVE_VOICE ?? "Aoede";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function generateSessionId() {
  return crypto.randomUUID();
}

async function createLiveAuthToken(params: {
  apiKey: string;
  model: string;
  prompt: string;
  voiceName: string;
}) {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    apiVersion: "v1alpha",
  });

  const token = await ai.authTokens.create({
    config: {
      newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      uses: 1,
      liveConnectConstraints: {
        model: params.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: params.voiceName,
              },
            },
          },
          systemInstruction: params.prompt,
        },
      },
    },
  });

  if (!token.name) {
    throw new Error("Live auth token creation returned an empty token name");
  }

  return token.name;
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
  let authToken: string;

  try {
    authToken = await createLiveAuthToken({
      apiKey,
      model: DEFAULT_MODEL,
      prompt: phaseConfig.systemPrompt,
      voiceName: DEFAULT_VOICE,
    });
  } catch (error) {
    console.error("Failed to create Gemini Live auth token", error);
    return jsonError("Failed to create Gemini Live auth token", 500);
  }

  const response: RealtimeBootstrapResponse = {
    sessionId,
    model: DEFAULT_MODEL,
    authToken,
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
