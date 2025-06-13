import { Settings } from '../interfaces/settings';
import ProcessingStats from '@interfaces/processing_stats';
import ProcessingResult from '@interfaces/processing_result';
import AudioSegment from '@interfaces/audio_segment';
import BatchContext from '@interfaces/batch_context';
import { VisionProviderFactory } from '@domain/vision_provider_factory';
import { TTSProviderFactory } from '@domain/tts_provider_factory';
import VisionResult from '@interfaces/vision_result';
import CliHelper from '@helpers/cli';
import { EventEmitter } from 'events';
import { VideoService } from '@services/video';

// const tempPath: string = await window.ipcRenderer.invoke('get-temp-path');
export class VideoProcessor {
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

    public async combineAudioSegments(segments: AudioSegment[], outputPath: string, videoDuration: number, tempDir: string): Promise<string> {
        const path = await import('path');
        const fs = await import('fs');
        const silentBasePath = path.join(tempDir, 'silent_base.wav');

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
    
    public async generateAudioDescription(
        videoFilePath: string,
        settings: Settings,
        tempDir: string,
        outputDir: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ProcessingResult> {
        const fs = await import('fs');
        const path = await import('path');

        // Ensure directories exist
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get video duration
        const videoDuration = await VideoService.getDuration(videoFilePath);
        onProgress?.(5, 'Got video duration');

        // Initialize providers
        const visionProvider = settings.visionProviders.find(p => p.name === settings.visionProvider);
        const ttsProvider = settings.ttsProviders.find(p => p.name === settings.ttsProvider);

        if (!visionProvider || !ttsProvider) {
            throw new Error('Vision or TTS provider not found in settings');
        }

        const vision = VisionProviderFactory.createProvider(settings.visionProvider, visionProvider);
        const tts = TTSProviderFactory.createProvider(settings.ttsProvider, ttsProvider);

        onProgress?.(10, 'Initialized providers');

        // Process in batch mode (simplified for Vue integration)
        const batchWindowDuration = settings.batchWindowDuration || 15;
        const framesInBatch = settings.framesInBatch || 10;
        const totalBatches = Math.floor(videoDuration / batchWindowDuration);

        const audioSegments: AudioSegment[] = [];
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

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchStart = batchIndex * batchWindowDuration;
            const batchEnd = batchStart + batchWindowDuration;

            if (batchEnd > videoDuration) break;

            onProgress?.(15 + (batchIndex / totalBatches) * 70, `Processing batch ${batchIndex + 1}/${totalBatches}`);

            // Capture frames for this batch
            const framePaths: string[] = [];
            for (let i = 0; i < framesInBatch; i++) {
                const t = batchStart + (i * batchWindowDuration) / framesInBatch;
                const frameFilePath = path.join(tempDir, `batch_${batchIndex}_frame_${i}.jpg`);
                await this.captureFrame(videoFilePath, t, frameFilePath);
                framePaths.push(frameFilePath);
            }

            // Get description from vision AI
            const visionResult: VisionResult = await vision.describeBatch(framePaths, lastBatchContext, settings.batchPrompt);

            // Update stats
            stats.totalVisionInputCost += visionResult.usage.inputTokens;
            stats.totalVisionOutputCost += visionResult.usage.outputTokens;
            stats.totalCost += visionResult.usage.totalTokens;

            // Generate TTS
            const audioFilePath = path.join(tempDir, `batch_audio_${batchIndex}.mp3`);
            const ttsResult = await tts.textToSpeech(visionResult.description, audioFilePath);

            stats.totalTTSCost += ttsResult.cost;

            // Store segment
            audioSegments.push({
                audioFile: audioFilePath,
                startTime: currentTimePosition,
                duration: ttsResult.duration,
                description: visionResult.description
            });

            // Update positions and context
            currentTimePosition += ttsResult.duration + 0.5; // 0.5s buffer
            lastBatchContext = {
                lastDescription: visionResult.description,
                lastFramePaths: framePaths.slice(-2)
            };

            // Clean up frame files
            framePaths.forEach(fp => {
                if (fs.existsSync(fp)) {
                    fs.unlinkSync(fp);
                }
            });
        }

        onProgress?.(85, 'Combining audio segments');

        // Combine audio segments
        const outputAudioPath = path.join(outputDir, `${path.basename(videoFilePath, path.extname(videoFilePath))}_description.mp3`);
        await this.combineAudioSegments(audioSegments, outputAudioPath, videoDuration, tempDir);

        onProgress?.(100, 'Audio description complete');

        return {
            videoFile: videoFilePath,
            audioDescriptionFile: outputAudioPath,
            stats
        };
    }
}
