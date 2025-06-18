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
import TTSResult from '@interfaces/tts_result';

export class VideoProcessor extends EventEmitter {
    private settings: Settings;

    constructor(settings: Settings) {
        super();
        this.settings = settings;
    }
    public async captureFrame(videoFilePath: string, timePosition: number, outputPath: string, lowQuality: boolean = true): Promise<void> {
        const args: string[] = [
            '-y',
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

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc-temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc-outputs'));

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
                '-y',
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
                    '-y',
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
                    console.error(`Failed to standardize segment ${segment.audioFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    reject(new Error(`Failed to standardize segment ${segment.audioFile}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });

            // Mix with current audio
            await new Promise<void>((resolve, reject) => {
                const delayMs = Math.round(segment.startTime * 1000);
                const filterComplex = `[1:a]adelay=${delayMs}|${delayMs}[delayed];[0:a][delayed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`;
                const args = [
                    '-y',
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
                    console.error(`Failed to mix audio segment ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                    '-y',
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
                    console.error(`Failed to convert final audio to MP3: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc-temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc-outputs'));

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
        let currentTimePosition = 0;
        let timelineDrift = 0;
        const maxAllowableDrift = this.settings.batchWindowDuration * 0.5; // Maximum drift of 50% of batch window

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const idealBatchStart = batchIndex * this.settings.batchWindowDuration;
            const batchStart = currentTimePosition;
            timelineDrift = batchStart - idealBatchStart;
            if (Math.abs(timelineDrift) > maxAllowableDrift) {
                this.emit(EventType.Progress, `WARNING: Timeline drift at batch ${batchIndex} is ${timelineDrift.toFixed(2)} seconds.`);
            }

            const batchEnd = Math.min(idealBatchStart + this.settings.batchWindowDuration, videoDuration);

            if (batchStart >= videoDuration) break;

            this.emit(EventType.Progress, `Processing batch #${batchIndex + 1} of ${totalBatches}...`);

            // Capture frames for this batch
            const framePaths: string[] = [];
            for (let i = 0; i < framesInBatch; i++) {
                const t = idealBatchStart + (i * this.settings.batchWindowDuration) / this.settings.framesInBatch;
                if (t > videoDuration) break; // safety check
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
            currentTimePosition = batchEnd;
            const nextIdealPosition = (batchIndex + 1) * this.settings.batchWindowDuration;
            if (currentTimePosition < nextIdealPosition) {
                console.log(`Batch audio finished before next scheduled batch. Catching up with timeline.`);
                currentTimePosition = nextIdealPosition;
                timelineDrift = 0; // Reset drift since we've caught up
            }
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

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc-temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc-outputs'));

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
        let lastSegmentEndTime = -1;
        for (const visionSegment of visionSegments) {
            batchIndex++;
            const audioFilePath = path.join(tempDir, `batch_audio_${batchIndex}.mp3`);
            this.emit(EventType.Progress, `Generating TTS for batch ${batchIndex + 1} of ${visionSegments.length}...`);
            const ttsResult: TTSResult = await tts.textToSpeech(visionSegment.description, audioFilePath);

            stats.totalTTSCost += ttsResult.cost;


            // Store segment
            audioSegments.push({
                audioFile: audioFilePath,
                startTime: Math.max(visionSegment.startTime, lastSegmentEndTime),
                duration: ttsResult.duration,
                description: visionSegment.description
            });
            lastSegmentEndTime = ttsResult.duration;
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

    public async combineAudioWithVideo(videoFilePath: string, audioFilePath: string): Promise<string> {
        const path = await import('path');
        const fs = await import('fs');

        const tempDir: string = await window.ipcRenderer.invoke('get-temp-path', 'aidesc-temp');
        const outputDir: string = path.join(await window.ipcRenderer.invoke('get-temp-path', 'aidesc-outputs'));

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, 'combined_video_with_audio.mp4');

        if (!fs.existsSync(videoFilePath)) {
            throw new Error(`Video file does not exist: ${videoFilePath}`);
        }
        if (!fs.existsSync(audioFilePath)) {
            throw new Error(`Audio file does not exist: ${audioFilePath}`);
        }

        /* const args: string[] = [
            '-y',
            '-i', videoFilePath,
            '-i', audioFilePath,
            '-filter_complex', '[0:a]volume=[a1];[1:a]volume=0.8[a2];[a1][a2]amix=inputs=2:duration=longest[aout]',
            '-map', '0:v',  // Map the video stream from the first input
            '-map', '[aout]', // Map the mixed audio created in the filter complex
            '-c:v', 'copy',
            '-c:a', 'aac',
            outputPath
        ];*/


        const args: string[] = [
            '-y',
            '-i', videoFilePath, // Input 1: video file with audio
            '-i', audioFilePath, // Input 2: additional audio file
            '-filter_complex',
            '[0:a]volume=1[a1];' + // Base volume for main audio
            '[1:a]volume=1[a2];' + // Base volume for secondary audio
            '[a1][a2]sidechaincompress=threshold=0.1:ratio=10:attack=5:release=100[aout]', // Apply sidechain compression
            '-map', '0:v', // Map the video stream from the first input
            '-map', '[aout]', // Map the sidechain compressed audio
            '-c:v', 'copy', // Copy the video codec
            '-c:a', 'aac', // Set audio codec to AAC
            outputPath
        ];

        const cliHelper = new CliHelper('ffmpeg', args);

        return new Promise((resolve, reject) => {
            try {
                cliHelper.executeSync(); // executeSync will throw on error
                resolve(outputPath);
            } catch (error) {
                reject(new Error(`Failed to combine video ${videoFilePath} with audio ${audioFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }
}