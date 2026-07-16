import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { ASR } from "./asr";

/** OpenAI /v1/audio/transcriptions models from the Speech to text docs. */
export const OPENAI_ASR_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
] as const;

export type OpenAIASRModel = (typeof OPENAI_ASR_MODELS)[number];

export class OpenAIASR extends ASR {
  private client = new OpenAI();
  private model: OpenAIASRModel;

  constructor(model: OpenAIASRModel = "gpt-4o-transcribe") {
    super();
    this.model = model;
  }

  get id() {
    return `openai-${this.model}`;
  }

  async transcribe(file: string): Promise<string> {
    const isDiarize = this.model === "gpt-4o-transcribe-diarize";

    const transcription = await this.client.audio.transcriptions.create({
      file: createReadStream(file),
      model: this.model,
      ...(isDiarize
        ? {
            response_format: "diarized_json" as const,
            chunking_strategy: "auto" as const,
          }
        : {}),
    });

    if (typeof transcription === "string") return transcription;
    return transcription.text;
  }
}
