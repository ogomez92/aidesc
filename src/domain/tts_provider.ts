import { TTSProviderSettings } from "@interfaces/settings";
import TTSResult from "@interfaces/tts_result";
import CliHelper from "@helpers/cli";

export abstract class TTSProvider {
    protected config: TTSProviderSettings;

    constructor(config: TTSProviderSettings) {
        this.config = config;
    }

    abstract textToSpeech(text: string, outputPath: string): Promise<TTSResult>;

    async applySpeedFactor(inputPath: string, outputPath: string, speedFactor: number): Promise<void> {
        const args = [
            '-i', inputPath,
            '-af', `atempo=${speedFactor}`,
            '-c:a', 'libmp3lame',
            '-q:a', '2',
            outputPath
        ];

        const cliHelper = new CliHelper('ffmpeg', args);

        return new Promise((resolve) => {
            cliHelper.on('success', resolve);
            cliHelper.execute();
        });
    }

    async createSilentAudio(outputPath: string, duration: number): Promise<void> {
        const args = [
            '-f', 'lavfi',
            '-i', 'anullsrc=r=24000:cl=mono',
            '-t', duration.toString(),
            '-c:a', 'libmp3lame',
            '-q:a', '9',
            outputPath
        ];

        const cliHelper = new CliHelper('ffmpeg', args);

        return new Promise((resolve, reject) => {
            cliHelper.on('success', resolve);
            cliHelper.on('error', reject);
            cliHelper.execute();
        });
    }
}
