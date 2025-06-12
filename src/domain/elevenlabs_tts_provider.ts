export class ElevenLabsTTSProvider extends TTSProvider {
    private eleven: ElevenLabsClient;

    constructor(config: TTSProviderSettings) {
        super(config);
        this.eleven = new ElevenLabsClient({
            apiKey: config.apiKey,
        });
    }

    async textToSpeech(text: string, outputPath: string): Promise<TTSResult> {
        try {
            const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');

            const audio = await this.eleven.textToSpeech.convert(this.config.voice, {
                enableLogging: false,
                outputFormat: 'mp3_44100_128',
                text,
                modelId: this.config.model,
            });

            const fileStream = fs.createWriteStream(tempOutputPath);
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

            const audioDuration = await this.getAudioDuration(outputPath);

            return {
                duration: audioDuration,
                cost: text.length
            };
        } catch (error) {
            console.error("Error generating speech with ElevenLabs:", error);
            await this.createSilentAudio(outputPath, 1);
            return {
                duration: 1,
                cost: 0
            };
        }
    }

    private async applySpeedFactor(inputPath: string, outputPath: string, speedFactor: number): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioFilters(`atempo=${speedFactor}`)
                .audioCodec('libmp3lame')
                .audioQuality(2)
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    private async getAudioDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err || !metadata?.format?.duration) {
                    reject(err || new Error('No duration found'));
                    return;
                }
                resolve(metadata.format.duration);
            });
        });
    }

    private async createSilentAudio(outputPath: string, duration: number): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('anullsrc=r=24000:cl=mono')
                .inputFormat('lavfi')
                .duration(duration)
                .audioQuality(9)
                .audioCodec('libmp3lame')
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }
}
