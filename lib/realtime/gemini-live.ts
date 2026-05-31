import { GoogleGenAI, Modality } from "@google/genai";
import type {
  AssistantState,
  LearningPhase,
  RealtimeBootstrapResponse,
} from "@/types/realtime";

export type GeminiLiveClientOptions = {
  bootstrap: RealtimeBootstrapResponse;
  phase: LearningPhase;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onDebugEvent?: (event: string) => void;
  onStateChange?: (state: AssistantState) => void;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
  onAudioChunk?: (bytes: Uint8Array, mimeType: string) => void;
};

export class GeminiLiveClient {
  private session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
  private readonly options: GeminiLiveClientOptions;
  private readonly ai: GoogleGenAI;

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
    this.ai = new GoogleGenAI({
      apiKey: options.bootstrap.authToken,
      httpOptions: {
        apiVersion: "v1alpha",
        baseUrl: "https://generativelanguage.googleapis.com/",
      },
    });
  }

  async connect() {
    if (this.session) {
      return;
    }

    try {
      this.options.onDebugEvent?.(
        `connect:start model=${this.options.bootstrap.model} phase=${this.options.phase}`,
      );
      this.session = await this.ai.live.connect({
        model: this.options.bootstrap.model,
        callbacks: {
          onopen: () => {
            this.options.onDebugEvent?.("socket:onopen");
            this.options.onOpen?.();
          },
          onclose: (event) => {
            this.options.onDebugEvent?.(
              `socket:onclose code=${event.code} reason=${event.reason || "none"}`,
            );
            if (event.code !== 1000) {
              this.options.onError?.(
                new Error(
                  `Gemini Live closed: code=${event.code} reason=${event.reason || "none"}`,
                ),
              );
            }
            this.options.onClose?.();
          },
          onerror: (event) => {
            const message =
              event instanceof ErrorEvent
                ? event.message ||
                  (event.error instanceof Error ? event.error.message : "") ||
                  "Gemini Live socket error"
                : "Gemini Live socket error";
            this.options.onDebugEvent?.(`socket:onerror message=${message}`);
            this.options.onError?.(new Error(message));
          },
          onmessage: (message) => {
            try {
              this.handleMessage(message as unknown as Record<string, unknown>);
            } catch (error) {
              this.options.onError?.(
                error instanceof Error
                  ? error
                  : new Error("Failed to parse Gemini Live message"),
              );
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });
      this.options.onDebugEvent?.("connect:resolved");
    } catch (error) {
      this.options.onDebugEvent?.(
        `connect:catch ${
          error instanceof Error ? error.message : "Gemini Live connection failed"
        }`,
      );
      this.options.onError?.(
        error instanceof Error ? error : new Error("Gemini Live connection failed"),
      );
      throw error;
    }
  }

  disconnect() {
    this.session?.close();
    this.session = null;
  }

  updatePhase(phase: LearningPhase, prompt: string) {
    this.session?.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text: `Switch to ${phase}. New instruction context: ${prompt}` }],
        },
      ],
      turnComplete: true,
    });
  }

  interrupt() {
    void this.session?.sendRealtimeInput({
      activityEnd: {},
    });
  }

  sendText(text: string) {
    this.session?.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      turnComplete: true,
    });
  }

  sendJpegFrame(base64Data: string) {
    void this.session?.sendRealtimeInput({
      video: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    });
  }

  sendAudioChunk(base64Data: string, mimeType: string) {
    void this.session?.sendRealtimeInput({
      audio: {
        data: base64Data,
        mimeType,
      },
    });
  }

  private handleMessage(message: Record<string, unknown>) {
    if ("setupComplete" in message) {
      this.options.onDebugEvent?.("message:setupComplete");
    }

    if ("goAway" in message) {
      const goAway = message.goAway as Record<string, unknown> | undefined;
      this.options.onDebugEvent?.(`message:goAway ${JSON.stringify(goAway ?? {})}`);
    }

    if ("sessionResumptionUpdate" in message) {
      this.options.onDebugEvent?.("message:sessionResumptionUpdate");
    }

    if ("serverContent" in message) {
      const serverContent = message.serverContent as Record<string, unknown>;

      if (serverContent.interrupted) {
        this.options.onStateChange?.("listening");
      }

      const modelTurn = serverContent.modelTurn as
        | { parts?: Array<Record<string, unknown>> }
        | undefined;

      if (modelTurn?.parts?.length) {
        this.options.onDebugEvent?.(`message:modelTurn parts=${modelTurn.parts.length}`);
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
      this.options.onDebugEvent?.("message:usageMetadata");
      this.options.onStateChange?.("thinking");
    }
  }
}
