import { OpenAIASH } from "./openai-ash";

const stt = new OpenAIASH();
const text = await stt.transcribe("recording.mp3");

console.log(text);
