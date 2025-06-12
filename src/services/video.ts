import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../interfaces/settings';
import ProcessingStats from '@interfaces/processing_stats';
import ProcessingResult from '@interfaces/processing_result';
import AudioSegment from '@interfaces/audio_segment';
import BatchContext from '@interfaces/batch_context';
import { VisionProviderFactory } from '@domain/vision_provider_factory';
import { TTSProviderFactory } from '@domain/tts_provider_factory';
import VisionResult from '@interfaces/vision_result';

// Main VideoService class
export class VideoService {
    public static async getDuration(filePath: string): Promise<number> {
        try {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err || !metadata || !metadata.format || !metadata.format.duration) {
                        reject(new Error('Unable to get video duration'));
                        return;
                    }
                    resolve(metadata.format.duration);
                });
            });
        } catch (error) {
            console.error(`Error getting video duration: ${error}`);
            throw error;
        }
    }

    public static async captureFrame(videoFilePath: string, timePosition: number, outputPath: string, lowQuality: boolean = true): Promise<void> {
        return new Promise((resolve, reject) => {
            let command = ffmpeg(videoFilePath)
                .seekInput(timePosition)
                .frames(1)
                .videoCodec('mjpeg')
                .output(outputPath);

            if (lowQuality) {
                command = command.size('?x360'); // Scale to 360p height while maintaining aspect ratio
            }

            command
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    public static async combineAudioSegments(segments: AudioSegment[], outputPath: string, videoDuration: number, tempDir: string): Promise<string> {
        const silentBasePath = path.join(tempDir, 'silent_base.wav');

        // Create silent base track
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input('anullsrc=r=44100:cl=stereo')
                .inputFormat('lavfi')
                .duration(videoDuration)
                .audioCodec('pcm_s16le')
                .output(silentBasePath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
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
                ffmpeg(segment.audioFile)
                    .audioFrequency(44100)
                    .audioChannels(2)
                    .audioCodec('pcm_s16le')
                    .output(standardizedSegment)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            });

            // Mix with current audio
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(currentAudioPath)
                    .input(standardizedSegment)
                    .complexFilter([
                        `[1:a]adelay=${Math.round(segment.startTime * 1000)}|${Math.round(segment.startTime * 1000)}[delayed]`,
                        `[0:a][delayed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`
                    ])
                    .map('[out]')
                    .audioCodec('pcm_s16le')
                    .output(outputFile)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
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
                ffmpeg(currentAudioPath)
                    .audioCodec('libmp3lame')
                    .audioQuality(2)
                    .output(outputPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
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

    public static async generateAudioDescription(
        videoFilePath: string,
        settings: Settings,
        tempDir: string,
        outputDir: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ProcessingResult> {
        // Ensure directories exist
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get video duration
        const videoDuration = await this.getDuration(videoFilePath);
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

    public static async isFfmpegInstalled(): Promise<boolean> {
        // Check ffprobe
        await new Promise((resolve, reject) => {
            ffmpeg.ffprobe('-version', (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });

        // Check ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg.getAvailableFormats((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
        return true;
    }
}
