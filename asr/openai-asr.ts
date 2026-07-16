import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { ASR, type TranscribeResult, type UsageInfo } from "./asr";

/** OpenAI /v1/audio/transcriptions models from the Speech to text docs. */
export const OPENAI_ASR_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
] as const;

export type OpenAIASRModel = (typeof OPENAI_ASR_MODELS)[number];

/** Published OpenAI list prices used to estimate USD from response `usage`. */
const PRICING = {
  "whisper-1": { perMinuteUsd: 0.006 },
  "gpt-4o-mini-transcribe": { inputPerMillionUsd: 1.25, outputPerMillionUsd: 5.0 },
  "gpt-4o-transcribe": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10.0 },
  // Same token pricing family as gpt-4o-transcribe (OpenAI does not list a separate rate).
  "gpt-4o-transcribe-diarize": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10.0 },
} as const;

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

  async transcribe(file: string): Promise<TranscribeResult> {
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

    if (typeof transcription === "string") {
      return { text: transcription };
    }

    return {
      text: transcription.text,
      usage: toUsageInfo(this.model, transcription.usage),
    };
  }
}

function toUsageInfo(
  model: OpenAIASRModel,
  usage: OpenAI.Audio.Transcriptions.Transcription["usage"] | undefined,
): UsageInfo | undefined {
  if (!usage) return undefined;

  if (usage.type === "duration") {
    const seconds = usage.seconds;
    const price = PRICING[model];
    const costUsd =
      "perMinuteUsd" in price ? (seconds / 60) * price.perMinuteUsd : null;
    return {
      type: "duration",
      seconds,
      costUsd,
    };
  }

  const price = PRICING[model];
  const costUsd =
    "inputPerMillionUsd" in price
      ? (usage.input_tokens / 1_000_000) * price.inputPerMillionUsd +
        (usage.output_tokens / 1_000_000) * price.outputPerMillionUsd
      : null;

  return {
    type: "tokens",
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    costUsd,
  };
}
