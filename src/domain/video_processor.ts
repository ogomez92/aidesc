import { Settings } from '../interfaces/settings';
import ProcessingStats from '@interfaces/processing_stats';
import VisionProcessingResult from '@interfaces/vision_processing_result';
import AudioSegment from '@interfaces/audio_segment';
import BatchContext from '@interfaces/batch_context';
import { VisionProviderFactory } from '@domain/vision_provider_factory';
import { TTSProviderFactory } from '@domain/tts_provider_factory';
import VisionResult from '@interfaces/vision_result';
import CliHelper from '@helpers/cli';
import { EventEmitter } from 'events';
import { VideoService } from '@services/video';
import VisionSegment from '@interfaces/vision_segment';
import TTSProcessingResult from '@interfaces/tts_processing_result';
import EventType from '@enums/event_type';

export class VideoProcessor extends EventEmitter {
    private settings: Settings;

    constructor(settings: Settings) {
        super();
        this.settings = settings;
    }
    public async captureFrame(videoFilePath: string, timePosition: number, outputPath: string, lowQuality: boolean = true): Promise<void> {
        const args: string[] = [
            '-ss', timePosition.toString(),
            '-i', videoFilePath,
            '-frames:v', '1',
            '-c:v', 'mjpeg',
        ];

        if (lowQuality) {
            args.push('-vf', 'scale=-2:360'); // Scale to 360p height while maintaining aspect ratio, -2 ensures even width
        }

        args.push(outputPath);

        const cliHelper = new CliHelper('ffmpeg', args);

        return new Promise((resolve, reject) => {
            try {
                cliHelper.executeSync(); // executeSync will throw on error
                resolve();
            } catch (error) {
                reject(new Error(`Failed to capture frame for file ${videoFilePath} at ${timePosition}s: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    public async combineAudioSegments(segments: AudioSegment[], outputPath: string): Promise<string> {
        const path = await import('path');
        const fs = await import('fs');

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc_temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc_outputs'));

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const videoDuration = segments.reduce((max, segment) => Math.max(max, segment.startTime + (segment.duration || 0)), 0);
        const silentBasePath = path.join(tempDir, 'silent_base.wav');
        this.emit(EventType.Progress, `Combining audio segments into ${outputPath}...`);
        // Create silent base track
        await new Promise<void>((resolve, reject) => {
            const args = [
                '-f', 'lavfi',
                '-i', `anullsrc=r=44100:cl=stereo`,
                '-t', videoDuration.toString(),
                '-c:a', 'pcm_s16le',
                silentBasePath
            ];

            try {
                const cliHelper = new CliHelper('ffmpeg', args);
                cliHelper.executeSync();
                resolve();
            } catch (error) {
                reject(new Error(`Failed to create silent base track: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

        // Sort segments by start time
        const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

        let currentAudioPath = silentBasePath;

        // Process segments one by one
        for (let i = 0; i < sortedSegments.length; i++) {
            const segment = sortedSegments[i];
            const outputFile = path.join(tempDir, `segment_${i}_output.wav`);
            const standardizedSegment = path.join(tempDir, `segment_${i}_std.wav`);

            // Standardize segment to WAV
            await new Promise<void>((resolve, reject) => {
                const args: string[] = [
                    '-i', segment.audioFile,
                    '-ar', '44100',
                    '-ac', '2',
                    '-c:a', 'pcm_s16le',
                    standardizedSegment
                ];
                try {
                    const cliHelper = new CliHelper('ffmpeg', args);
                    cliHelper.executeSync();
                    resolve();
                } catch (error) {
                    reject(new Error(`Failed to standardize segment ${segment.audioFile}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });

            // Mix with current audio
            await new Promise<void>((resolve, reject) => {
                const delayMs = Math.round(segment.startTime * 1000);
                const filterComplex = `[1:a]adelay=${delayMs}|${delayMs}[delayed];[0:a][delayed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`;
                const args = [
                    '-i', currentAudioPath,
                    '-i', standardizedSegment,
                    '-filter_complex', filterComplex,
                    '-map', '[out]',
                    '-c:a', 'pcm_s16le',
                    outputFile
                ];
                try {
                    const cliHelper = new CliHelper('ffmpeg', args);
                    cliHelper.executeSync();
                    resolve();
                } catch (error) {
                    reject(new Error(`Failed to mix audio segment ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });

            // Clean up
            if (currentAudioPath !== silentBasePath) {
                fs.unlinkSync(currentAudioPath);
            }
            fs.unlinkSync(standardizedSegment);

            currentAudioPath = outputFile;
        }

        // Convert to final format
        if (path.extname(outputPath).toLowerCase() === '.mp3') {
            await new Promise<void>((resolve, reject) => {
                const args = [
                    '-i', currentAudioPath,
                    '-c:a', 'libmp3lame',
                    '-q:a', '2', // Corresponds to -audioQuality(2) for libmp3lame
                    outputPath
                ];
                try {
                    const cliHelper = new CliHelper('ffmpeg', args);
                    cliHelper.executeSync();
                    resolve();
                } catch (error) {
                    reject(new Error(`Failed to convert final audio to MP3: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });
        } else {
            fs.copyFileSync(currentAudioPath, outputPath);
        }

        // Clean up temp files
        if (currentAudioPath !== silentBasePath) {
            fs.unlinkSync(currentAudioPath);
        }
        if (fs.existsSync(silentBasePath)) {
            fs.unlinkSync(silentBasePath);
        }

        return outputPath;
    }

    public async generateVisionSegments(
        videoFilePath: string,
    ): Promise<VisionProcessingResult> {
        const fs = await import('fs');
        const path = await import('path');

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc_temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc_outputs'));

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const videoDuration = await VideoService.getDuration(videoFilePath);

        const visionProvider = this.settings.visionProviders.find(p => p.name === this.settings.visionProvider);

        if (!visionProvider) {
            throw new Error('Could not initialize vision provider');
        }

        const vision = VisionProviderFactory.createProvider(this.settings.visionProvider, visionProvider);

        const batchWindowDuration = this.settings.batchWindowDuration || 15;
        const framesInBatch = this.settings.framesInBatch || 10;
        const totalBatches = Math.ceil(videoDuration / batchWindowDuration);

        const visionSegments: VisionSegment[] = [];
        const stats: ProcessingStats = {
            totalFrames: 0,
            totalBatches: totalBatches,
            totalVisionInputCost: 0,
            totalVisionOutputCost: 0,
            totalTTSCost: 0,
            totalCost: 0
        };

        let lastBatchContext: BatchContext | null = null;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchStart = batchIndex * batchWindowDuration;
            const batchEnd = Math.min(batchStart + batchWindowDuration, videoDuration);

            this.emit(EventType.Progress, `Processing segment ${batchIndex + 1} of ${totalBatches}...`);

            // Capture frames for this batch
            const framePaths: string[] = [];
            for (let i = 0; i < framesInBatch; i++) {
                const t = batchStart + (i * (batchEnd - batchStart)) / framesInBatch;
                const frameFilePath = path.join(tempDir, `batch_${batchIndex}_frame_${i}.jpg`);
                await this.captureFrame(videoFilePath, t, frameFilePath);
                framePaths.push(frameFilePath);
            }

            const visionResult: VisionResult = await vision.describeBatch(framePaths, lastBatchContext, this.settings.batchPrompt);

            stats.totalVisionInputCost += visionResult.usage.inputTokens;
            stats.totalVisionOutputCost += visionResult.usage.outputTokens;
            stats.totalCost += visionResult.usage.totalTokens;

            visionSegments.push({
                startTime: batchStart,
                description: visionResult.description,
            });


            // Update positions and context
            lastBatchContext = {
                lastDescription: visionResult.description,
                lastFramePaths: framePaths.slice(-2)
            };
        }

        const result: VisionProcessingResult = {
            segments: visionSegments,
            stats
        }

        this.emit(EventType.Complete, result);

        return result;
    }


    public async generateTtsSegments(
        visionSegments: VisionSegment[],
    ): Promise<TTSProcessingResult> {
        const fs = await import('fs');
        const path = await import('path');

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc_temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc_outputs'));

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const ttsProvider = this.settings.ttsProviders.find(p => p.name === this.settings.ttsProvider);

        if (!ttsProvider) {
            throw new Error('Could not initialize tts provider');
        }

        const tts = TTSProviderFactory.createProvider(this.settings.ttsProvider, ttsProvider);

        const audioSegments: AudioSegment[] = [];
        const stats: ProcessingStats = {
            totalFrames: 0,
            totalBatches: 0,
            totalVisionInputCost: 0,
            totalVisionOutputCost: 0,
            totalTTSCost: 0,
            totalCost: 0
        };

        let batchIndex = -1;
        for (const segment of visionSegments) {
            batchIndex++;
            const audioFilePath = path.join(tempDir, `batch_audio_${batchIndex}.mp3`);
            this.emit(EventType.Progress, `Generating TTS for segment ${batchIndex + 1} of ${visionSegments.length}...`);
            const ttsResult = await tts.textToSpeech(segment.description, audioFilePath);

            stats.totalTTSCost += segment.description.length;

            // Store segment
            audioSegments.push({
                audioFile: audioFilePath,
                startTime: segment.startTime,
                duration: ttsResult.duration,
                description: segment.description
            });
        }

        const outputAudioPath = path.join(outputDir, 'combined_audio_segments.mp3');
        await this.combineAudioSegments(audioSegments, outputAudioPath);
        const result: TTSProcessingResult = {
            audioDescriptionFilePath: outputAudioPath,
            audioSegments: audioSegments,
            stats
        }
        this.emit(EventType.Complete, result);

        return result;
    }
}