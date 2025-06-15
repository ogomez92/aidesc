import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { inspect } from 'util';
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

            const audio = await this.eleven.textToSpeech.convert(this.config.voice, {
                enableLogging: false,
                outputFormat: 'mp3_44100_128',
                text,
                previousText: this.previousText,
                modelId: this.config.model,
            });

            const fileStream = fs.createWriteStream(tempOutputPath);
            console.log(inspect(audio));
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
            throw new Error(`Error generating speech with ElevenLabs: ${error}`);
        }
    }
}
