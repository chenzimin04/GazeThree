"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GeminiLiveClient } from "@/lib/realtime/gemini-live";
import { getPhaseConfig } from "@/lib/realtime/phases";
import type {
  AssistantState,
  LearningPhase,
  RealtimeBootstrapResponse,
  RealtimeStatus,
  SessionMode,
} from "@/types/realtime";

export type { AssistantState, LearningPhase };

type UseRealtimeStreamOptions = {
  phase: LearningPhase;
  videoFps?: number;
  enableVideo?: boolean;
  enableAudio?: boolean;
  onAiStateChange?: (state: AssistantState) => void;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
  onError?: (error: Error) => void;
};

type UseRealtimeStreamResult = {
  status: RealtimeStatus;
  sessionMode: SessionMode;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isAiSpeaking: boolean;
  debugInfo: string[];
  localStream: MediaStream | null;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  setPhase: (phase: LearningPhase) => void;
  interruptAi: () => void;
  sendText: (text: string) => void;
};

const DEFAULT_VIDEO_FPS = 6;
const DEFAULT_AUDIO_MIME = "audio/pcm;rate=16000";

async function requestMediaWithFallback(
  enableAudio: boolean,
  enableVideo: boolean,
  isCameraEnabled: boolean,
) {
  const audioConstraints: MediaTrackConstraints | boolean = enableAudio
    ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      }
    : false;

  const videoAttempts: Array<MediaTrackConstraints | false> =
    enableVideo && isCameraEnabled
      ? [
          {
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
          {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
          {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
        ]
      : [false];

  let lastError: unknown;

  for (const video of videoAttempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video,
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (enableAudio) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to acquire local media devices");
}

export function useRealtimeStream(
  options: UseRealtimeStreamOptions,
): UseRealtimeStreamResult {
  const {
    phase: initialPhase,
    videoFps = DEFAULT_VIDEO_FPS,
    enableVideo = true,
    enableAudio = true,
    onAiStateChange,
    onTranscript,
    onError,
  } = options;

  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [phase, setPhaseState] = useState<LearningPhase>(initialPhase);
  const [sessionMode, setSessionMode] = useState<SessionMode>("foreground");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(enableVideo);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputQueueRef = useRef<Promise<void>>(Promise.resolve());

  const pushDebug = useCallback((line: string) => {
    const timestamp = new Date().toISOString().split("T")[1]?.replace("Z", "") ?? "time";
    setDebugInfo((prev) => [...prev.slice(-11), `${timestamp} ${line}`]);
  }, []);

  const emitError = useCallback(
    (cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setStatus("error");
      pushDebug(`error:${error.message}`);
      onError?.(error);
    },
    [onError, pushDebug],
  );

  const playPcmChunk = useCallback(async (bytes: Uint8Array) => {
    if (!bytes.length) {
      return;
    }

    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const samples = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i += 1) {
      samples[i] = Math.max(-1, Math.min(1, pcm16[i] / 32768));
    }

    const context =
      outputAudioContextRef.current ?? new AudioContext({ sampleRate: 24000 });
    outputAudioContextRef.current = context;

    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);

    outputQueueRef.current = outputQueueRef.current.then(
      () =>
        new Promise<void>((resolve) => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          source.onended = () => resolve();
          source.start();
        }),
    );

    await outputQueueRef.current;
  }, []);

  const stopFramePump = useCallback(() => {
    if (frameTimerRef.current !== null) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

  const pumpVideoFrames = useCallback(() => {
    stopFramePump();

    if (!localVideoRef.current || !isCameraEnabled || sessionMode !== "foreground") {
      return;
    }

    const canvas = frameCanvasRef.current ?? document.createElement("canvas");
    frameCanvasRef.current = canvas;

    const interval = Math.max(1000 / videoFps, 100);

    frameTimerRef.current = window.setInterval(() => {
      const video = localVideoRef.current;
      if (!video || video.readyState < 2 || !clientRef.current) {
        return;
      }

      const targetWidth = 512;
      const scale = video.videoWidth > 0 ? targetWidth / video.videoWidth : 1;
      const targetHeight = Math.max(288, Math.round((video.videoHeight || 288) * scale));

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        return;
      }

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      const data = canvas.toDataURL("image/jpeg", 0.55).split(",")[1];
      clientRef.current.sendJpegFrame(data);
    }, interval);
  }, [isCameraEnabled, sessionMode, stopFramePump, videoFps]);

  const startMicrophoneStreaming = useCallback((stream: MediaStream, mimeType: string) => {
    if (!stream.getAudioTracks().length) {
      return;
    }

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (!clientRef.current || isMuted) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);

      for (let i = 0; i < input.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      const bytes = new Uint8Array(pcm.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      clientRef.current.sendAudioChunk(btoa(binary), mimeType);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    audioProcessorRef.current = processor;
  }, [isMuted]);

  const stopMicrophoneStreaming = useCallback(() => {
    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioContextRef.current?.close().catch(() => undefined);
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
  }, []);

  const attachLocalPreview = useCallback((stream: MediaStream) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    localVideoRef.current = video;
    void video.play().catch(() => undefined);
  }, []);

  const getLocalMedia = useCallback(async () => {
    const stream = await requestMediaWithFallback(
      enableAudio,
      enableVideo,
      isCameraEnabled,
    );
    setLocalStream(stream);
    setIsCameraEnabled(stream.getVideoTracks().length > 0);
    attachLocalPreview(stream);
    return stream;
  }, [attachLocalPreview, enableAudio, enableVideo, isCameraEnabled]);

  const bootstrapSession = useCallback(async (): Promise<RealtimeBootstrapResponse> => {
    setStatus("bootstrapping");
    pushDebug(
      `bootstrap:start phase=${phase} wantsVideo=${String(
        isCameraEnabled && sessionMode === "foreground",
      )} wantsAudio=${String(enableAudio)}`,
    );

    const response = await fetch("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase,
        wantsVideo: isCameraEnabled && sessionMode === "foreground",
        wantsAudio: enableAudio,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      pushDebug(`bootstrap:failed status=${response.status} body=${text}`);
      throw new Error(text || `Bootstrap failed: ${response.status}`);
    }

    const bootstrap = (await response.json()) as RealtimeBootstrapResponse;
    pushDebug(`bootstrap:ok model=${bootstrap.model} voice=${bootstrap.voiceName}`);
    return bootstrap;
  }, [enableAudio, isCameraEnabled, phase, pushDebug, sessionMode]);

  const startSession = useCallback(async () => {
    try {
      setDebugInfo([]);
      pushDebug("session:start");
      const stream = await getLocalMedia();
      pushDebug(
        `media:ok audioTracks=${stream.getAudioTracks().length} videoTracks=${stream.getVideoTracks().length}`,
      );
      const bootstrap = await bootstrapSession();

      setStatus("connecting");
      pushDebug("session:connecting");

      const client = new GeminiLiveClient({
        bootstrap,
        phase,
        onOpen: () => {
          setStatus("connected");
          pushDebug("session:connected");
          onAiStateChange?.("listening");
          startMicrophoneStreaming(stream, bootstrap.inputAudioMimeType || DEFAULT_AUDIO_MIME);
          pumpVideoFrames();
        },
        onClose: () => {
          setStatus("ended");
          pushDebug("session:closed");
          setIsAiSpeaking(false);
        },
        onError: emitError,
        onDebugEvent: pushDebug,
        onStateChange: (state) => {
          setIsAiSpeaking(state === "speaking");
          pushDebug(`assistant:${state}`);
          onAiStateChange?.(state);
        },
        onTranscript,
        onAudioChunk: (bytes) => {
          void playPcmChunk(bytes);
        },
      });

      clientRef.current = client;
      await client.connect();
    } catch (error) {
      emitError(error);
    }
  }, [
    bootstrapSession,
    emitError,
    getLocalMedia,
    onAiStateChange,
    onTranscript,
    phase,
    playPcmChunk,
    pumpVideoFrames,
    startMicrophoneStreaming,
  ]);

  const endSession = useCallback(() => {
    stopFramePump();
    stopMicrophoneStreaming();
    clientRef.current?.disconnect();
    localStream?.getTracks().forEach((track) => track.stop());
    localVideoRef.current?.pause();
    outputAudioContextRef.current?.close().catch(() => undefined);

    clientRef.current = null;
    localVideoRef.current = null;
    outputAudioContextRef.current = null;
    outputQueueRef.current = Promise.resolve();
    setLocalStream(null);
    setStatus("ended");
    setIsAiSpeaking(false);
  }, [localStream, stopFramePump, stopMicrophoneStreaming]);

  const toggleMute = useCallback(() => {
    if (!localStream) {
      return;
    }

    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted, localStream]);

  const toggleCamera = useCallback(async () => {
    if (!localStream) {
      setIsCameraEnabled((prev) => !prev);
      return;
    }

    const nextEnabled = !isCameraEnabled;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);

    if (!nextEnabled) {
      stopFramePump();
    } else if (sessionMode === "foreground") {
      pumpVideoFrames();
    }
  }, [isCameraEnabled, localStream, pumpVideoFrames, sessionMode, stopFramePump]);

  const setPhase = useCallback((next: LearningPhase) => {
    setPhaseState(next);
    const prompt = getPhaseConfig(next).systemPrompt;
    clientRef.current?.updatePhase(next, prompt);
  }, []);

  const interruptAi = useCallback(() => {
    clientRef.current?.interrupt();
    setIsAiSpeaking(false);
    onAiStateChange?.("listening");
  }, [onAiStateChange]);

  const sendText = useCallback((text: string) => {
    clientRef.current?.sendText(text);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      const nextMode: SessionMode = hidden ? "background-audio" : "foreground";
      setSessionMode(nextMode);

      if (hidden) {
        stopFramePump();
      } else if (isCameraEnabled) {
        pumpVideoFrames();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isCameraEnabled, pumpVideoFrames, stopFramePump]);

  useEffect(() => () => endSession(), [endSession]);

  return {
    status,
    sessionMode,
    isMuted,
    isCameraEnabled,
    isAiSpeaking,
    localStream,
    remoteAudioRef,
    startSession,
    endSession,
    toggleMute,
    toggleCamera,
    setPhase,
    interruptAi,
    sendText,
    debugInfo,
  };
}
