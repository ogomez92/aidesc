import OpenAI from "openai";
import { TTSProvider } from "./tts_provider";
import { TTSProviderSettings } from "@interfaces/settings";
import TTSResult from "@interfaces/tts_result";
import { VideoService } from "@services/video";

export class OpenAITTSProvider extends TTSProvider {
    private openai: OpenAI;

    constructor(config: TTSProviderSettings) {
        super(config);
        this.openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: config.apiKey,
        });
    }

    async textToSpeech(text: string, outputPath: string): Promise<TTSResult> {
        const fs = await import('fs');
        try {
            const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');
            const mp3 = await this.openai.audio.speech.create({
                model: this.config.model,
                input: text,
                voice: this.config.voice,
                response_format: 'mp3',
                instructions: 'Voice: VoiceOver like, professional, fast talking and concise. Narration. Clear, used for audio descriptions in a video. Minimize pauses and breathing.'
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            fs.writeFileSync(tempOutputPath, buffer);

            // Apply speed factor if needed
            if (this.config.speedFactor !== 1.0) {
                await this.applySpeedFactor(tempOutputPath, outputPath, this.config.speedFactor);
                fs.unlinkSync(tempOutputPath);
            } else {
                fs.renameSync(tempOutputPath, outputPath);
            }

            const audioDuration = await VideoService.getDuration(outputPath);

            return {
                duration: audioDuration,
                cost: Math.ceil(text.length / 1000000) * 12 // 12 dollars per 1m characters.
            };
        } catch (error) {
            throw new Error(`Error generating speech with OpenAI: ${error}`);
        }
    }
}
