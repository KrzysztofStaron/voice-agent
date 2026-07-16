import { OpenAIASR } from "./asr/openai-asr";

const asr = new OpenAIASR();
const { text, usage } = await asr.transcribe("recording.mp3");

console.log(text);
if (usage) console.log(usage);
