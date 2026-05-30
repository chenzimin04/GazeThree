import type {
  AssistantState,
  GeminiSetupPayload,
  LearningPhase,
  RealtimeBootstrapResponse,
} from "@/types/realtime";

export type GeminiLiveClientOptions = {
  bootstrap: RealtimeBootstrapResponse;
  phase: LearningPhase;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: AssistantState) => void;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
  onAudioChunk?: (bytes: Uint8Array, mimeType: string) => void;
};

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private readonly options: GeminiLiveClientOptions;

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    const url = new URL(this.options.bootstrap.wsUrl);
    url.searchParams.set("key", this.options.bootstrap.apiKey);

    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.onopen = () => {
      this.sendSetup();
      this.options.onOpen?.();
    };

    socket.onerror = () => {
      this.options.onError?.(new Error("Gemini Live socket error"));
    };

    socket.onclose = () => {
      this.options.onClose?.();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
        this.handleMessage(payload);
      } catch (error) {
        this.options.onError?.(
          error instanceof Error ? error : new Error("Failed to parse Gemini Live message"),
        );
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  updatePhase(phase: LearningPhase, prompt: string) {
    this.sendJson({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: `Switch to ${phase}. New instruction context: ${prompt}` }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  interrupt() {
    this.sendJson({
      realtimeInput: {
        activityEnd: {},
      },
    });
  }

  sendText(text: string) {
    this.sendJson({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  sendJpegFrame(base64Data: string) {
    this.sendJson({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        ],
      },
    });
  }

  sendAudioChunk(base64Data: string, mimeType: string) {
    this.sendJson({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType,
            data: base64Data,
          },
        ],
      },
    });
  }

  private sendSetup() {
    const payload: { setup: GeminiSetupPayload } = {
      setup: {
        model: this.options.bootstrap.model,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.options.bootstrap.voiceName,
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.options.bootstrap.prompt }],
        },
      },
    };

    this.sendJson(payload);
  }

  private sendJson(payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private handleMessage(message: Record<string, unknown>) {
    if ("serverContent" in message) {
      const serverContent = message.serverContent as Record<string, unknown>;

      if (serverContent.interrupted) {
        this.options.onStateChange?.("listening");
      }

      const modelTurn = serverContent.modelTurn as
        | { parts?: Array<Record<string, unknown>> }
        | undefined;

      if (modelTurn?.parts?.length) {
        this.options.onStateChange?.("speaking");
      }

      for (const part of modelTurn?.parts ?? []) {
        if (typeof part.text === "string") {
          this.options.onTranscript?.(part.text, "assistant");
        }

        if (
          typeof part.inlineData === "object" &&
          part.inlineData &&
          typeof (part.inlineData as { data?: unknown }).data === "string"
        ) {
          const inlineData = part.inlineData as { data: string; mimeType?: string };
          const bytes = Uint8Array.from(atob(inlineData.data), (char) => char.charCodeAt(0));
          this.options.onAudioChunk?.(
            bytes,
            inlineData.mimeType ?? this.options.bootstrap.outputAudioMimeType,
          );
        }
      }

      if (serverContent.turnComplete) {
        this.options.onStateChange?.("listening");
      }
    }

    if ("usageMetadata" in message) {
      this.options.onStateChange?.("thinking");
    }
  }
}
