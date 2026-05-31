export type LearningPhase = "phase1" | "phase2" | "phase3";
export type TransportMode = "websocket";
export type SessionMode = "foreground" | "background-audio";

export type RealtimeStatus =
  | "idle"
  | "bootstrapping"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "error";

export type AssistantState = "idle" | "listening" | "thinking" | "speaking";

export type RealtimeBootstrapRequest = {
  phase?: LearningPhase | string;
  wantsVideo?: boolean;
  wantsAudio?: boolean;
};

export type RealtimeBootstrapResponse = {
  sessionId: string;
  model: string;
  authToken: string;
  phase: LearningPhase;
  prompt: string;
  voiceName: string;
  inputAudioMimeType: string;
  outputAudioMimeType: string;
  capabilities: {
    video: boolean;
    audio: boolean;
    bargeIn: boolean;
    backgroundAudio: boolean;
  };
};

export type TranscriptRole = "user" | "assistant";

export type TranscriptEvent = {
  type: "transcript";
  role: TranscriptRole;
  text: string;
  isFinal?: boolean;
};

export type ClientVideoFrameEvent = {
  type: "client.video.frame";
  mimeType: "image/jpeg";
  data: string;
  timestamp: number;
};

export type ClientTextEvent = {
  type: "conversation.text";
  text: string;
};

export type ClientPhaseUpdateEvent = {
  type: "phase.update";
  phase: LearningPhase;
};

export type ClientInterruptEvent = {
  type: "conversation.interrupt";
};
