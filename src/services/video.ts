import ffmpeg from 'fluent-ffmpeg';
import { OpenAI } from 'openai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { Settings, VisionProviderSettings, TTSProviderSettings } from '../interfaces/settings';

// Types and interfaces
export interface ProcessingStats {
    totalFrames: number;
    totalBatches: number;
    totalVisionInputCost: number;
    totalVisionOutputCost: number;
    totalTTSCost: number;
    totalCost: number;
}

export interface AudioSegment {
    audioFile: string;
    startTime: number;
    duration: number;
    description: string;
}

export interface VisionResult {
    description: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

export interface TTSResult {
    duration: number;
    cost: number;
}

export interface ProcessingResult {
    videoFile: string;
    audioDescriptionFile: string;
    stats: ProcessingStats;
}

export interface BatchContext {
    lastDescription?: string;
    lastFramePaths?: string[];
}

// Abstract base classes for providers
export abstract class VisionProvider {
    protected config: VisionProviderSettings;

    constructor(config: VisionProviderSettings) {
        this.config = config;
    }

    abstract describeImage(imagePath: string, prompt: string): Promise<VisionResult>;
    abstract compareImages(image1Path: string, image2Path: string, prompt: string): Promise<VisionResult>;
    abstract describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult>;
}

export abstract class TTSProvider {
    protected config: TTSProviderSettings;

    constructor(config: TTSProviderSettings) {
        this.config = config;
    }

    abstract textToSpeech(text: string, outputPath: string): Promise<TTSResult>;
}

// OpenAI Vision Provider
export class OpenAIVisionProvider extends VisionProvider {
    private openai: OpenAI;

    constructor(config: VisionProviderSettings) {
        super(config);
        this.openai = new OpenAI({
            apiKey: config.apiKey,
        });
    }

    async describeImage(imagePath: string, prompt: string): Promise<VisionResult> {
        try {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                temperature: 1,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: this.config.maxTokens || 300
            });

            return {
                description: response.choices[0].message.content?.trim() || "Unable to describe this image.",
                usage: {
                    inputTokens: response.usage?.prompt_tokens || 0,
                    outputTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        } catch (error) {
            console.error("Error describing image:", error);
            return {
                description: "Unable to describe this image.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }

    async compareImages(image1Path: string, image2Path: string, prompt: string): Promise<VisionResult> {
        try {
            const image1Data = fs.readFileSync(image1Path);
            const image2Data = fs.readFileSync(image2Path);
            const base64Image1 = image1Data.toString('base64');
            const base64Image2 = image2Data.toString('base64');

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image1}`
                                }
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image2}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: this.config.maxTokens || 300
            });

            return {
                description: response.choices[0].message.content?.trim() || "Unable to describe the differences.",
                usage: {
                    inputTokens: response.usage?.prompt_tokens || 0,
                    outputTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        } catch (error) {
            console.error("Error comparing images:", error);
            return {
                description: "Unable to describe the differences between these images.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    } async describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult> {
        try {
            const imagesBase64 = imagePaths.map(fp => {
                const imageData = fs.readFileSync(fp);
                return imageData.toString('base64');
            });

            const messages: Array<{
                role: 'system' | 'user' | 'assistant';
                content: Array<{
                    type: 'text' | 'image_url';
                    text?: string;
                    image_url?: { url: string };
                }> | string;
            }> = [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt }
                        ]
                    }
                ];

            if (lastBatchContext?.lastDescription) {
                messages.unshift({
                    role: "system",
                    content: `Previous batch summary: ${lastBatchContext.lastDescription}`
                });
            }

            imagesBase64.forEach(base64 => {
                const lastMessage = messages[messages.length - 1];
                if (Array.isArray(lastMessage.content)) {
                    lastMessage.content.push({
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64}`
                        }
                    });
                }
            });

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: messages as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                max_tokens: this.config.maxTokens || 300
            });

            return {
                description: response.choices[0].message.content?.trim() || "Unable to describe this batch.",
                usage: {
                    inputTokens: response.usage?.prompt_tokens || 0,
                    outputTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        } catch (error) {
            console.error("Error describing batch of images:", error);
            return {
                description: "Unable to describe this batch of images.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }
}

// Gemini Vision Provider
export class GeminiVisionProvider extends VisionProvider {
    private genAI: GoogleGenerativeAI;
    private model: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    constructor(config: VisionProviderSettings) {
        super(config);
        this.genAI = new GoogleGenerativeAI(config.apiKey || '');
        this.model = this.genAI.getGenerativeModel({ model: config.model });
    }

    async describeImage(imagePath: string, prompt: string): Promise<VisionResult> {
        try {
            const imageData = fs.readFileSync(imagePath);
            const imagePart = {
                inlineData: {
                    data: imageData.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };

            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            const inputTokens = Math.ceil(prompt.length / 4) + 1000;
            const outputTokens = Math.ceil(text.length / 4);

            return {
                description: text,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens
                }
            };
        } catch (error) {
            console.error("Error describing image with Gemini:", error);
            return {
                description: "Unable to describe this image.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }

    async compareImages(image1Path: string, image2Path: string, prompt: string): Promise<VisionResult> {
        try {
            const image1Data = fs.readFileSync(image1Path);
            const image2Data = fs.readFileSync(image2Path);

            const image1Part = {
                inlineData: {
                    data: image1Data.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };

            const image2Part = {
                inlineData: {
                    data: image2Data.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };

            const result = await this.model.generateContent([prompt, image1Part, image2Part]);
            const response = await result.response;
            const text = response.text();

            const inputTokens = Math.ceil(prompt.length / 4) + 2000;
            const outputTokens = Math.ceil(text.length / 4);

            return {
                description: text,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens
                }
            };
        } catch (error) {
            console.error("Error comparing images with Gemini:", error);
            return {
                description: "Unable to describe the differences between these images.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }

    async describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult> {
        try {
            let contextualPrompt = prompt;
            if (lastBatchContext?.lastDescription) {
                contextualPrompt = `Previous batch summary: ${lastBatchContext.lastDescription}\n\n${prompt}`;
            }

            const contentParts: Array<string | { inlineData: { data: string; mimeType: string } }> = [contextualPrompt];

            for (const imagePath of imagePaths) {
                const imageData = fs.readFileSync(imagePath);
                contentParts.push({
                    inlineData: {
                        data: imageData.toString('base64'),
                        mimeType: 'image/jpeg'
                    }
                });
            }

            const result = await this.model.generateContent(contentParts);
            const response = await result.response;
            const text = response.text();

            const inputTokens = Math.ceil(contextualPrompt.length / 4) + (1000 * imagePaths.length);
            const outputTokens = Math.ceil(text.length / 4);

            return {
                description: text,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens
                }
            };
        } catch (error) {
            console.error("Error describing batch of images with Gemini:", error);
            return {
                description: "Unable to describe this batch of images.",
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }
}

// OpenAI TTS Provider
export class OpenAITTSProvider extends TTSProvider {
    private openai: OpenAI;

    constructor(config: TTSProviderSettings) {
        super(config);
        this.openai = new OpenAI({
            apiKey: config.apiKey,
        });
    }

    async textToSpeech(text: string, outputPath: string): Promise<TTSResult> {
        try {
            const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&'); const mp3 = await this.openai.audio.speech.create({
                model: this.config.model,
                voice: this.config.voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
                input: text
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

            const audioDuration = await this.getAudioDuration(outputPath);

            return {
                duration: audioDuration,
                cost: text.length // Cost based on character count
            };
        } catch (error) {
            console.error("Error generating speech:", error);
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

// ElevenLabs TTS Provider
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

// Factory classes
export class VisionProviderFactory {
    static createProvider(providerName: string, config: VisionProviderSettings): VisionProvider {
        switch (providerName.toLowerCase()) {
            case 'openai':
                return new OpenAIVisionProvider(config);
            case 'gemini':
                return new GeminiVisionProvider(config);
            default:
                throw new Error(`Vision provider "${providerName}" not implemented.`);
        }
    }
}

export class TTSProviderFactory {
    static createProvider(providerName: string, config: TTSProviderSettings): TTSProvider {
        switch (providerName.toLowerCase()) {
            case 'openai':
                return new OpenAITTSProvider(config);
            case 'eleven':
            case 'elevenlabs':
                return new ElevenLabsTTSProvider(config);
            default:
                throw new Error(`TTS provider "${providerName}" not implemented.`);
        }
    }
}

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
            const visionResult = await vision.describeBatch(framePaths, lastBatchContext, settings.batchPrompt);

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
