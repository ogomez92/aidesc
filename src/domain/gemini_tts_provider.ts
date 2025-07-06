import { GoogleGenAI } from '@google/genai';
import { TTSProvider } from "./tts_provider";
import { TTSProviderSettings } from "@interfaces/settings";
import TTSResult from "@interfaces/tts_result";
import { VideoService } from "@services/video";

export class GeminiTTSProvider extends TTSProvider {
    private ai: GoogleGenAI;
    public static names = ['gemini'];

    constructor(config: TTSProviderSettings) {
        super(config);
        this.ai = new GoogleGenAI({
            apiKey: config.apiKey,
        });
    }

    async textToSpeech(text: string, outputPath: string): Promise<TTSResult> {
        const fs = await import('fs');
        try {
            const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');
            const response = await this.ai.models.generateContent({
                model: this.config.model || "gemini-2.5-pro-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: this.config.voice || 'Kore' },
                        },
                    },
                },
            });

            const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const buffer = Buffer.from(data, 'base64');

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
            throw new Error(`Error generating speech with Gemini: ${error}`);
        }
    }
}
