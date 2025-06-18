import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Readable } from 'node:stream';
import { TTSProvider } from "./tts_provider";
import { TTSProviderSettings } from "@interfaces/settings";
import TTSResult from "@interfaces/tts_result";
import { VideoService } from "@services/video";

export class ElevenLabsTTSProvider extends TTSProvider {
    private eleven: ElevenLabsClient;
    private previousText = '';

    constructor(config: TTSProviderSettings) {
        super(config);
        this.eleven = new ElevenLabsClient({
            apiKey: config.apiKey,
        });
    }

    async textToSpeech(text: string, outputPath: string,): Promise<TTSResult> {
        const fs = await import('fs');

        try {
            const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');

            const audio: ReadableStream = await this.eleven.textToSpeech.convert(this.config.voice, {
                enableLogging: false,
                outputFormat: 'mp3_44100_128',
                text,
                previousText: this.previousText,
                modelId: this.config.model,
            }) as unknown as ReadableStream;

            const fileStream = fs.createWriteStream(tempOutputPath);
            // const nodeStream = Readable.fromWeb(audio as any);
            audio.pipe(fileStream); await new Promise<void>((resolve, reject) => {
                fileStream.on('finish', () => resolve());
                fileStream.on('error', reject);
            });

            // Apply speed factor if needed
            if (this.config.speedFactor !== 1.0) {
                await this.applySpeedFactor(tempOutputPath, outputPath, this.config.speedFactor);
                fs.unlinkSync(tempOutputPath);
            } else {
                fs.renameSync(tempOutputPath, outputPath);
            }

            const audioDuration = await VideoService.getDuration(outputPath);

            this.previousText = text;
            
            return {
                duration: audioDuration,
                cost: text.length
            };
        } catch (error) {
            console.error(`Error generating speech with ElevenLabs: ${error}`);
            throw new Error(`Error generating speech with ElevenLabs: ${error}`);
        }
    }
}
