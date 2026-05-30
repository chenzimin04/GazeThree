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
      apiKey: options.bootstrap.apiKey,
    });
  }

  async connect() {
    if (this.session) {
      return;
    }

    try {
      this.session = await this.ai.live.connect({
        model: this.options.bootstrap.model,
        callbacks: {
          onopen: () => {
            this.options.onOpen?.();
          },
          onclose: (event) => {
            if (event.reason) {
              this.options.onError?.(
                new Error(`Gemini Live closed: ${event.code} ${event.reason}`),
              );
            }
            this.options.onClose?.();
          },
          onerror: (event) => {
            const message =
              event instanceof ErrorEvent && event.message
                ? event.message
                : "Gemini Live socket error";
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
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.options.bootstrap.voiceName,
              },
            },
          },
          systemInstruction: this.options.bootstrap.prompt,
        },
      });
    } catch (error) {
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
      media: {
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
