import { OpenAIASR } from "./asr/openai-asr";

const asr = new OpenAIASR();
const text = await asr.transcribe("recording.mp3");

console.log(text);
