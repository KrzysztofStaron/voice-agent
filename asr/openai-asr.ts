import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { ASR } from "./asr";

export class OpenAIASR extends ASR {
  private client = new OpenAI();
  private model: string;

  constructor(model = "gpt-4o-transcribe") {
    super();
    this.model = model;
  }

  get id() {
    return `openai-${this.model}`;
  }

  async transcribe(file: string): Promise<string> {
    const transcription = await this.client.audio.transcriptions.create({
      file: createReadStream(file),
      model: this.model,
    });

    return transcription.text;
  }
}
