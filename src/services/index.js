const { ElevenLabsClient, play } = require("elevenlabs");
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Load environment variables
dotenv.config();

// Default configuration options
const defaultConfig = {
  captureIntervalSeconds: 10,
  contextWindowSize: 5,
  defaultPrompt: "Describe this frame from a video in 1-2 sentences for someone who cannot see it. Focus on key visual elements. Avoid using terms like 'in this frame', simply describe the actual frame. Keep sentences short and concise, as this will be used to generate an audio track which is overlayed on the video.",
  changePrompt: "Describe what has changed between these frames in 1-2 sentences for someone who cannot see the video. Focus on significant visual changes only. Avoid talking about meta information such as 'in this frame', or 'the significant change is', and merely describe the actual change taking place. Only describe the changes relevant to the last frame. The previous frames are attached for you to build context and build situational awareness. Keep it short and concise, as your text will be used to generate audio description tracks to be played with the video.",
  batchPrompt: "Describe the sequence of frames in this batch over time for someone who cannot see it. Focus on what happens, changes, or stands out visually during these seconds. Keep it to 1-3 concise sentences, avoiding words like 'in these frames'—just describe what's happening. Use context from the previous batch if relevant. Keep sentences short and concise. Avoid speculation or overly verbose or unnecessary sentences. Try not to use nested sentences and keep sentences short to help flow. This will be used for audio description and mixed back in with the video file later, so we need to maintain consistency and quick pacing. Avoid using phrases such as 'as evidenced by' or 'suggesting'. Only focus on describing the visual scene. Do not repeat information given in the previous prompt, and focus only on what has changed since that description. Avoid talking about the scene or sequence, simply focus on the action within these frames. The listener knows that this is a video, so we do not need to remind them. Also avoid overusing phrases such as 'the scene shifts', the shifting or perspective change should be evident from the description of the sequence itself.",

  // Vision AI settings
  visionProvider: "openai",
  visionModel: "gpt-4o",
  visionProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o",
      maxTokens: 300
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.0-flash",
      maxTokens: 300
    }
    // Add other vision providers here
  },

  // TTS settings
  ttsProvider: "openai",
  ttsVoice: "alloy", // Voice option for TTS
  ttsSpeedFactor: 1.5, // Speed up audio by 50%
  ttsProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: "tts-1-hd",
      voice: "alloy"
    },
    // Add other TTS providers here
  },

  // Video processing settings
  outputDir: "/mnt/e/desc/output/",
  tempDir: "/mnt/e/desc/temp/",
  batchTimeMode: true,                // Whether to use the new batch time mode
  batchWindowDuration: 15,             // How many seconds each batch covers
  framesInBatch: 10,                   // How many frames to capture within each batch
};

let stats = {
  totalFrames: 0,
  totalBatches: 0,
  totalVisionInputCost: 0,
  totalVisionOutputCost: 0,
  totalTTSCost: 0,
  totalCost: 0
};

/**
 * Factory for creating vision AI providers
 */
class VisionProviderFactory {
  static getProvider(config) {
    const providerName = config.visionProvider;
    const providerConfig = config.visionProviders[providerName];

    if (!providerConfig) {
      throw new Error(`Vision provider "${providerName}" not configured.`);
    }

    switch (providerName) {
      case 'openai':
        return new OpenAIVisionProvider(providerConfig);
      case 'gemini':
        return new GeminiVisionProvider(providerConfig);
      // Add other providers here
      default:
        throw new Error(`Vision provider "${providerName}" not implemented.`);
    }
  }
}

/**
 * Factory for creating TTS providers
 */
class TTSProviderFactory {
  static getProvider(config) {
    const providerName = config.ttsProvider;
    const providerConfig = config.ttsProviders[providerName];

    if (!providerConfig) {
      throw new Error(`TTS provider "${providerName}" not configured.`);
    }

    switch (providerName) {
      case 'openai':
        return new OpenAITTSProvider(providerConfig);
      case 'eleven':
        return new ElevenLabsTTSProvider(providerConfig);

      // Add other providers here
      default:
        throw new Error(`TTS provider "${providerName}" not implemented.`);
    }
  }
}

/**
 * OpenAI Vision Provider Implementation
 */
class OpenAIVisionProvider {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  /**
   * Describe a single image
   * @param {string} imagePath - Path to the image file
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async describeImage(imagePath, prompt) {
    try {
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        temperature: 0.1,
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
        description: response.choices[0].message.content.trim(),
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
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

  /**
   * Compare two images and describe the differences
   * @param {string} image1Path - Path to the first image
   * @param {string} image2Path - Path to the second image
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async compareImages(image1Path, image2Path, prompt) {
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
        description: response.choices[0].message.content.trim(),
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        }
      };
    } catch (error) {
      console.error("Error comparing images:", error);
      return {
        description: "Unable to describe the differences between these images.",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      };
    }
  }

  /**
   * Describe a batch of images
   * @param {string[]} imagePaths - Array of paths to the images
   * @param {object} lastBatchContext - Context from the previous batch
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async describeBatch(imagePaths, lastBatchContext, prompt) {
    try {
      // Convert images to base64
      const imagesBase64 = imagePaths.map(fp => {
        const imageData = fs.readFileSync(fp);
        return imageData.toString('base64');
      });

      // Build the messages array for the chat completion
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt }
          ]
        }
      ];

      // If we have some text context from the last batch, inject that as well
      if (lastBatchContext && lastBatchContext.lastDescription) {
        messages.unshift({
          role: "system",
          content: `Previous batch summary: ${lastBatchContext.lastDescription}`
        });
      }

      // Append each image in the new batch
      imagesBase64.forEach(base64 => {
        messages[messages.length - 1].content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64}`
          }
        });
      });

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens || 300
      });

      return {
        description: response.choices[0].message.content.trim(),
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
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

/**
 * Google Gemini Vision Provider Implementation
 */
class GeminiVisionProvider {
  constructor(config) {
    this.config = config;

    // Import the Google Generative AI SDK
    const { GoogleGenerativeAI } = require("@google/generative-ai");

    // Initialize the API
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.model });
  }

  /**
   * Describe a single image
   * @param {string} imagePath - Path to the image file
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async describeImage(imagePath, prompt) {
    try {
      const imageData = fs.readFileSync(imagePath);
      const mimeType = 'image/jpeg'; // Assuming JPEG, could be detected based on file extension

      // Create a file part for the image
      const imagePart = {
        inlineData: {
          data: imageData.toString('base64'),
          mimeType
        }
      };

      // Generate content using Gemini
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Gemini doesn't provide token usage information in the same way as OpenAI
      // We'll estimate based on prompt length and response length
      const inputTokens = Math.ceil(prompt.length / 4) + 1000; // rough estimate for image
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

  /**
   * Compare two images and describe the differences
   * @param {string} image1Path - Path to the first image
   * @param {string} image2Path - Path to the second image
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async compareImages(image1Path, image2Path, prompt) {
    try {
      const image1Data = fs.readFileSync(image1Path);
      const image2Data = fs.readFileSync(image2Path);
      const mimeType = 'image/jpeg'; // Assuming JPEG, could be detected based on file extension

      // Create file parts for both images
      const image1Part = {
        inlineData: {
          data: image1Data.toString('base64'),
          mimeType
        }
      };

      const image2Part = {
        inlineData: {
          data: image2Data.toString('base64'),
          mimeType
        }
      };

      // Generate content using Gemini with both images
      const result = await this.model.generateContent([prompt, image1Part, image2Part]);
      const response = await result.response;
      const text = response.text();

      // Estimate token usage
      const inputTokens = Math.ceil(prompt.length / 4) + 2000; // rough estimate for two images
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

  /**
   * Describe a batch of images
   * @param {string[]} imagePaths - Array of paths to the images
   * @param {object} lastBatchContext - Context from the previous batch
   * @param {string} prompt - Prompt for the AI
   * @returns {Promise<{description: string, usage: object}>} Description and usage stats
   */
  async describeBatch(imagePaths, lastBatchContext, prompt) {
    try {
      // Create a prompt that includes context from the last batch if available
      let contextualPrompt = prompt;
      if (lastBatchContext && lastBatchContext.lastDescription) {
        contextualPrompt = `Previous batch summary: ${lastBatchContext.lastDescription}\n\n${prompt}`;
      }

      // Create content parts array starting with the prompt
      const contentParts = [contextualPrompt];

      // Add all images to the content parts
      for (const imagePath of imagePaths) {
        const imageData = fs.readFileSync(imagePath);
        const mimeType = 'image/jpeg'; // Assuming JPEG, could be detected based on file extension

        contentParts.push({
          inlineData: {
            data: imageData.toString('base64'),
            mimeType
          }
        });
      }

      // Generate content using Gemini with all images
      const result = await this.model.generateContent(contentParts);
      const response = await result.response;
      const text = response.text();

      // Estimate token usage
      const inputTokens = Math.ceil(contextualPrompt.length / 4) + (1000 * imagePaths.length); // rough estimate
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

/**
 * OpenAI TTS Provider Implementation
 */
class OpenAITTSProvider {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  /**
   * Convert text to speech
   * @param {string} text - Text to convert to speech
   * @param {string} outputPath - Output path for the audio file
   * @param {object} options - Additional options
   * @returns {Promise<{duration: number, cost: number}>} Duration of the generated audio in seconds and cost
   */
  async textToSpeech(text, outputPath, options = {}) {
    try {
      // Get the options, with defaults from config
      const voice = options.voice || this.config.voice;
      const model = options.model || this.config.model;
      const speedFactor = options.speedFactor || 1.0;

      // Generate the initial TTS output
      const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');

      const mp3 = await this.openai.audio.speech.create({
        model: model,
        voice: voice,
        input: text
      });

      // Cost calculation is based on character count
      const cost = text.length;

      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(tempOutputPath, buffer);

      // Speed up the audio using FFmpeg if needed
      if (speedFactor !== 1.0) {
        execSync(`ffmpeg -v error -i "${tempOutputPath}" -filter:a "atempo=${speedFactor}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
        // Clean up temporary file
        fs.unlinkSync(tempOutputPath);
      } else {
        // Just use the file as is
        fs.renameSync(tempOutputPath, outputPath);
      }

      // Get actual audio duration for accurate timing
      const audioDuration = getAudioDuration(outputPath);

      return {
        duration: audioDuration,
        cost: cost
      };
    } catch (error) {
      console.error("Error generating speech:", error);
      // Create a silent audio file if TTS fails
      execSync(`ffmpeg -v error -f lavfi -i anullsrc=r=24000:cl=mono -t 1 -q:a 9 -acodec libmp3lame "${outputPath}" -y`);
      return {
        duration: 1,
        cost: 0
      };
    }
  }
}
class ElevenLabsTTSProvider {
  constructor(config) {
    this.config = config;
    this.eleven = new ElevenLabsClient({
      apiKey: config.apiKey,
    });
  }

  /**
   * Convert text to speech
   * @param {string} text - Text to convert to speech
   * @param {string} outputPath - Output path for the audio file
   * @param {object} options - Additional options
   * @returns {Promise<{duration: number, cost: number}>} Duration of the generated audio in seconds and cost
   */
  async textToSpeech(text, outputPath, options = {}) {
    // Get the options, with defaults from config
    const voice = options.voice || this.config.voice;
    const model = options.model || this.config.model;

    // Generate the initial TTS output
    const tempOutputPath = outputPath.replace(/\.\w+$/, '_temp$&');
    const speedFactor = options.speedFactor || 1.0;

    try {
      const audio = await this.eleven.textToSpeech.convert(voice, {
        enable_logging: false,
        output_format: 'mp3_44100_128',
        text,
        model_id: model,
      });

      const fileName = tempOutputPath;

      const fileStream = fs.createWriteStream(fileName);
      audio.pipe(fileStream);

      await new Promise((resolve, reject) => {
        fileStream.on('finish', () => resolve(fileName)); // Resolve with the fileName
        fileStream.on('error', reject);
      });

      // Cost calculation is based on character count
      const cost = text.length;


      // Speed up the audio using FFmpeg if needed
      if (speedFactor !== 1.0) {
        execSync(`ffmpeg -v error -i "${tempOutputPath}" -filter:a "atempo=${speedFactor}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
        // Clean up temporary file
        fs.unlinkSync(tempOutputPath);
      } else {
        // Just use the file as is
        fs.renameSync(tempOutputPath, outputPath);
      }

      // Get actual audio duration for accurate timing
      const audioDuration = getAudioDuration(outputPath);

      return {
        duration: audioDuration,
        cost: cost
      };
    } catch (error) {
      console.error("Error generating speech:", error);
      // Create a silent audio file if TTS fails
      execSync(`ffmpeg -v error -f lavfi -i anullsrc=r=24000:cl=mono -t 1 -q:a 9 -acodec libmp3lame "${outputPath}" -y`);
      return {
        duration: 1,
        cost: 0
      };
    }
  }
}

/**
 * Parse command line arguments
 */
function parseCommandLineArgs() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 <video_file_path> [options]')
    .positional('video_file_path', {
      describe: 'Path to the input video file',
      type: 'string'
    })
    .option('captureIntervalSeconds', {
      alias: 'i',
      describe: 'Interval in seconds between frame captures',
      type: 'number'
    })
    .option('contextWindowSize', {
      alias: 'c',
      describe: 'Number of frames to keep in context',
      type: 'number'
    })
    // Vision provider options
    .option('visionProvider', {
      describe: 'Provider to use for vision AI',
      type: 'string'
    })
    .option('visionModel', {
      describe: 'Model to use for vision AI',
      type: 'string'
    })
    // TTS provider options
    .option('ttsProvider', {
      describe: 'Provider to use for text-to-speech',
      type: 'string'
    })
    .option('ttsModel', {
      alias: 'm',
      describe: 'TTS model to use',
      type: 'string'
    })
    .option('ttsVoice', {
      alias: 'v',
      describe: 'Voice to use for text-to-speech',
      type: 'string'
    })
    .option('ttsSpeedFactor', {
      alias: 's',
      describe: 'Speed factor for the audio playback',
      type: 'number'
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Directory for output files',
      type: 'string'
    })
    .option('tempDir', {
      alias: 't',
      describe: 'Directory for temporary files',
      type: 'string'
    })
    .option('batchTimeMode', {
      alias: 'b',
      describe: 'Use batch time mode for processing',
      type: 'boolean'
    })
    .option('batchWindowDuration', {
      describe: 'Duration in seconds for each batch window',
      type: 'number'
    })
    .option('framesInBatch', {
      describe: 'Number of frames to capture within each batch',
      type: 'number'
    })
    .option('defaultPrompt', {
      describe: 'Prompt for describing individual frames',
      type: 'string'
    })
    .option('changePrompt', {
      describe: 'Prompt for describing changes between frames',
      type: 'string'
    })
    .option('batchPrompt', {
      describe: 'Prompt for describing batches of frames',
      type: 'string'
    })
    .option('estimate', {
      alias: 'e',
      describe: 'Only estimate the cost without generating the audio description',
      type: 'boolean',
      default: false
    })
    .option('config', {
      alias: 'f',
      describe: 'Path to JSON config file',
      type: 'string'
    })
    .option('saveConfig', {
      describe: 'Save current configuration to specified JSON file',
      type: 'string'
    })
    .help()
    .alias('help', 'h')
    .example('$0 video.mp4', 'Process a video with default settings')
    .example('$0 video.mp4 --ttsVoice nova --visionProvider openai', 'Process with custom voice and vision provider')
    .example('$0 video.mp4 --estimate', 'Only estimate the processing cost')
    .example('$0 video.mp4 --config myconfig.json', 'Use settings from a config file')
    .example('$0 video.mp4 --saveConfig myconfig.json', 'Save current settings to a config file')
    .argv;
}

/**
 * Get the duration of a video file in seconds
 * @param {string} videoFilePath - Path to the video file
 * @returns {number} Duration in seconds
 */
function getVideoDuration(videoFilePath) {
  const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoFilePath}"`);
  return parseFloat(result.toString());
}

/**
 * Capture a frame from a video at a specific time position
 * @param {string} videoFilePath - Path to the video file
 * @param {number} timePosition - Time position in seconds
 * @param {string} outputPath - Output path for the captured frame
 * @param {boolean} [lowQuality=false] - If true, save screenshot in 360p resolution
 */
function captureVideoFrame(videoFilePath, timePosition, outputPath, lowQuality = true) {
  let command = `ffmpeg -v error -ss ${timePosition} -i "${videoFilePath}" -vframes 1 -q:v 2`;

  // Add resolution scaling for low quality option
  if (lowQuality) {
    command += ' -vf scale=-1:360'; // Scale to 360p height while maintaining aspect ratio
  }

  command += ` "${outputPath}" -y`;

  execSync(command);
}

/**
 * Get the duration of an audio file in seconds
 * @param {string} audioFilePath - Path to the audio file
 * @returns {number} Duration in seconds
 */
function getAudioDuration(audioFilePath) {
  const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`);
  return parseFloat(result.toString());
}

/**
 * Combine audio segments into a single audio track using lossless intermediates
 * @param {Array} segments - Array of audio segment information
 * @param {string} outputPath - Output path for the combined audio
 * @param {number} videoDuration - Duration of the video in seconds
 * @param {object} settings - Configuration settings
 */
function combineAudioSegments(segments, outputPath, videoDuration, settings) {
  console.log(`Combining ${segments.length} audio segments using lossless intermediates...`);

  try {
    // Create a silent base track with the full video duration (always WAV)
    const silentBasePath = path.join(settings.tempDir, 'silent_base.wav');
    execSync(`ffmpeg -v error -f lavfi -i anullsrc=r=44100:cl=stereo -t ${videoDuration} -c:a pcm_s16le "${silentBasePath}" -y`);

    // Sort segments by start time to process them in order
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

    // Process one segment at a time, building up the audio file
    let currentAudioPath = silentBasePath;

    for (let i = 0; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];
      const outputFile = path.join(settings.tempDir, `segment_${i}_output.wav`);

      // Convert the segment to a standard WAV format first to avoid compatibility issues
      // and ensure we're always working with lossless audio
      const standardizedSegment = path.join(settings.tempDir, `segment_${i}_std.wav`);
      execSync(`ffmpeg -v error -i "${segment.audioFile}" -ar 44100 -ac 2 -c:a pcm_s16le "${standardizedSegment}" -y`);

      // Calculate the position for this segment
      const timestamp = segment.startTime.toFixed(3);

      // Create a filter script for this segment
      const filterPath = path.join(settings.tempDir, `filter_${i}.txt`);

      // Use a filter that preserves the audio quality and positions correctly
      const filterContent =
        `[1:a]adelay=${Math.round(segment.startTime * 1000)}|${Math.round(segment.startTime * 1000)}[delayed];\n` +
        `[0:a][delayed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`;

      fs.writeFileSync(filterPath, filterContent);

      // Execute FFmpeg with the filter script
      execSync(`ffmpeg -v error -i "${currentAudioPath}" -i "${standardizedSegment}" -filter_complex_script "${filterPath}" -map "[out]" -c:a pcm_s16le "${outputFile}" -y`);

      // Clean up previous file if not the original
      if (currentAudioPath !== silentBasePath) {
        fs.unlinkSync(currentAudioPath);
      }

      // Clean up standardized segment and filter
      fs.unlinkSync(standardizedSegment);
      fs.unlinkSync(filterPath);

      // Update current audio path for next iteration
      currentAudioPath = outputFile;

      console.log(`Added segment ${i + 1}/${sortedSegments.length} at position ${timestamp}s`);
    }

    // Only at the very end, convert to the requested output format
    if (path.extname(outputPath).toLowerCase() === '.mp3') {
      console.log(`Converting final lossless WAV to MP3: ${outputPath}`);
      execSync(`ffmpeg -v error -i "${currentAudioPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
    } else {
      fs.copyFileSync(currentAudioPath, outputPath);
    }

    console.log(`Audio description track created: ${outputPath}`);

    // Clean up the last temp file
    if (currentAudioPath !== silentBasePath) {
      fs.unlinkSync(currentAudioPath);
    }

    if (fs.existsSync(silentBasePath)) {
      fs.unlinkSync(silentBasePath);
    }

    return outputPath;

  } catch (error) {
    console.error("Error in lossless audio combination:", error.message);

    try {
      console.log("Trying alternative approach with single-step filter...");

      // Create a silent base track (always WAV)
      const silentBasePath = path.join(settings.tempDir, 'silent_base.wav');
      execSync(`ffmpeg -v error -f lavfi -i anullsrc=r=44100:cl=stereo -t ${videoDuration} -c:a pcm_s16le "${silentBasePath}" -y`);

      // Create a complex filter to overlay all audio files at their specific timestamps
      const filterScriptPath = path.join(settings.tempDir, 'overlay_filter.txt');
      let filterScript = '';

      // Sort segments by start time
      const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

      // Standardize all segments to WAV first
      const standardizedSegments = [];
      for (let i = 0; i < sortedSegments.length; i++) {
        const segment = sortedSegments[i];
        const stdPath = path.join(settings.tempDir, `std_${i}.wav`);
        execSync(`ffmpeg -v error -i "${segment.audioFile}" -ar 44100 -ac 2 -c:a pcm_s16le "${stdPath}" -y`);
        standardizedSegments.push({
          path: stdPath,
          startTime: segment.startTime
        });
      }

      // Build the FFmpeg command with all standardized inputs
      let ffmpegCmd = `ffmpeg -v error -i "${silentBasePath}" `;

      // Add all standardized segments as inputs and create the filter script
      for (let i = 0; i < standardizedSegments.length; i++) {
        // Add as input
        ffmpegCmd += `-i "${standardizedSegments[i].path}" `;

        // Add to filter script - the input index starts at 1 because 0 is the silent base
        const inputIndex = i + 1;
        const delay = Math.round(standardizedSegments[i].startTime * 1000);

        // Add this input to filter script with proper delay
        filterScript += `[${inputIndex}:a]adelay=${delay}|${delay}[a${i}];\n`;
      }

      // Complete the filter script to merge all streams
      filterScript += '[0:a]'; // Start with base
      for (let i = 0; i < standardizedSegments.length; i++) {
        filterScript += `[a${i}]`;
      }
      // Use amix with normalize=0 to preserve volumes
      filterScript += `amix=inputs=${standardizedSegments.length + 1}:normalize=0:duration=first[aout]`;

      // Write the filter script
      fs.writeFileSync(filterScriptPath, filterScript);

      // Use an intermediate WAV for the output to maintain quality
      const intermediatePath = path.join(settings.tempDir, 'intermediate_output.wav');

      // Complete the FFmpeg command - always output to WAV first
      ffmpegCmd += `-filter_complex_script "${filterScriptPath}" -map "[aout]" -c:a pcm_s16le "${intermediatePath}" -y`;

      // Execute the command
      execSync(ffmpegCmd);

      // Convert to the requested format only at the end
      if (path.extname(outputPath).toLowerCase() === '.mp3') {
        console.log(`Converting final audio to MP3...`);
        execSync(`ffmpeg -v error -i "${intermediatePath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
      } else {
        fs.copyFileSync(intermediatePath, outputPath);
      }

      console.log(`Audio description track created with alternative method: ${outputPath}`);

      // Clean up temp files
      if (fs.existsSync(filterScriptPath)) {
        fs.unlinkSync(filterScriptPath);
      }

      if (fs.existsSync(silentBasePath)) {
        fs.unlinkSync(silentBasePath);
      }

      if (fs.existsSync(intermediatePath)) {
        fs.unlinkSync(intermediatePath);
      }

      // Clean up standardized segments
      standardizedSegments.forEach(seg => {
        if (fs.existsSync(seg.path)) {
          fs.unlinkSync(seg.path);
        }
      });

      return outputPath;

    } catch (secondError) {
      console.error("Alternative approach failed:", secondError.message);

      // Last resort: Generate a command file with the proper syntax
      const cmdFilePath = outputPath.replace(/\.\w+$/, '_ffmpeg_cmd.sh');
      let cmdContent = `#!/bin/bash\n\n# FFmpeg command to combine audio segments\n\n`;

      // Add commands to convert all segments to WAV first
      cmdContent += `# First convert all segments to standard WAV format\n`;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const stdPath = `"${settings.tempDir}/std_${i}.wav"`;
        cmdContent += `ffmpeg -i "${segment.audioFile}" -ar 44100 -ac 2 -c:a pcm_s16le ${stdPath} -y\n`;
      }

      // Create silent base
      cmdContent += `\n# Create silent base track\n`;
      cmdContent += `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${videoDuration} -c:a pcm_s16le "${settings.tempDir}/silent_base.wav" -y\n\n`;

      // Create filter file
      cmdContent += `# Create filter file\n`;
      cmdContent += `cat > "${settings.tempDir}/filter.txt" << EOL\n`;

      // Add delay filters for each segment
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const delay = Math.round(segment.startTime * 1000);
        cmdContent += `[${i + 1}:a]adelay=${delay}|${delay}[a${i}];\n`;
      }

      // Mix all streams
      cmdContent += `[0:a]`;
      for (let i = 0; i < segments.length; i++) {
        cmdContent += `[a${i}]`;
      }
      cmdContent += `amix=inputs=${segments.length + 1}:normalize=0:duration=first[aout]\nEOL\n\n`;

      // Final command
      cmdContent += `# Run final FFmpeg command\n`;
      cmdContent += `ffmpeg -i "${settings.tempDir}/silent_base.wav" `;

      // Add all segments as inputs
      for (let i = 0; i < segments.length; i++) {
        cmdContent += `-i "${settings.tempDir}/std_${i}.wav" `;
      }

      // Complete command
      cmdContent += `-filter_complex_script "${settings.tempDir}/filter.txt" -map "[aout]" `;

      if (path.extname(outputPath).toLowerCase() === '.mp3') {
        cmdContent += `-c:a libmp3lame -q:a 2 `;
      } else {
        cmdContent += `-c:a pcm_s16le `;
      }

      cmdContent += `"${outputPath}" -y\n\n`;

      // Add cleanup
      cmdContent += `# Clean up temp files\n`;
      cmdContent += `rm "${settings.tempDir}/silent_base.wav" "${settings.tempDir}/filter.txt"\n`;
      for (let i = 0; i < segments.length; i++) {
        cmdContent += `rm "${settings.tempDir}/std_${i}.wav"\n`;
      }

      // Make the file executable
      fs.writeFileSync(cmdFilePath, cmdContent);
      execSync(`chmod +x "${cmdFilePath}"`);

      console.log(`\nCreated executable script with proper FFmpeg commands: ${cmdFilePath}`);
      console.log(`Run this script to generate the audio file.`);

      return {
        commandFile: cmdFilePath
      };
    }
  }
}

/**
 * Clean up temporary files
 * @param {string} tempDir - Directory containing temporary files
 */
function cleanupTempFiles(tempDir) {
  const files = fs.readdirSync(tempDir);
  for (const file of files) {
    fs.unlinkSync(path.join(tempDir, file));
  }
}

/**
 * Generate audio description for a video
 * @param {string} videoFilePath - Path to the input video file
 * @param {object} options - Optional configuration overrides
 * @returns {Promise<object>} Result of the operation
 */
async function generateAudioDescription(videoFilePath, options = {}) {
  // Merge provided options with defaults
  const settings = { ...defaultConfig, ...options };

  // Initialize providers
  const visionProvider = VisionProviderFactory.getProvider(settings);
  const ttsProvider = TTSProviderFactory.getProvider(settings);

  // Ensure temporary and output directories exist
  if (!fs.existsSync(settings.tempDir)) {
    fs.mkdirSync(settings.tempDir, { recursive: true });
  }
  if (!fs.existsSync(settings.outputDir)) {
    fs.mkdirSync(settings.outputDir, { recursive: true });
  }

  // Get video duration
  const videoDuration = getVideoDuration(videoFilePath);
  stats.totalFrames = Math.floor(videoDuration / settings.captureIntervalSeconds);
  console.log(`Video duration: ${videoDuration} seconds`);

  // If batchTimeMode is enabled, use the new approach
  if (settings.batchTimeMode) {
    return await generateAudioDescriptionBatch(videoFilePath, videoDuration, settings, visionProvider, ttsProvider);
  }

  // Calculate the number of frames to capture
  const totalFrames = Math.floor(videoDuration / settings.captureIntervalSeconds);
  console.log(`Will capture ${totalFrames} frames at ${settings.captureIntervalSeconds} second intervals`);

  // Context window to store previous frames
  const frameContext = [];

  // Array to store audio segment information
  const audioSegments = [];

  // Track our current time position (will be adjusted for audio overlap)
  let currentTimePosition = 0;

  // Track drift from the original schedule
  let timelineDrift = 0;
  const maxAllowableDrift = settings.captureIntervalSeconds * 2; // Maximum drift before warning

  // Process each frame
  for (let i = 0; i < totalFrames; i++) {
    // Calculate the ideal time position based on the original schedule
    const idealTimePosition = i * settings.captureIntervalSeconds;

    // Use the adjusted time position that accounts for previous audio durations
    const timePosition = currentTimePosition;

    // Calculate drift from the original schedule
    timelineDrift = timePosition - idealTimePosition;

    // Log if drift is becoming significant
    if (Math.abs(timelineDrift) > maxAllowableDrift) {
      console.warn(`WARNING: Timeline drift at frame ${i} is ${timelineDrift.toFixed(2)} seconds.`);
    }

    const frameFilePath = path.join(settings.tempDir, `frame_${i.toString().padStart(5, '0')}.jpg`);

    // Capture frame at current time position (use the ideal time to capture the frame)
    captureVideoFrame(videoFilePath, idealTimePosition, frameFilePath);
    console.log(`Captured frame at ${idealTimePosition} seconds (scheduled at ${timePosition.toFixed(2)} seconds)`);

    // Add current frame to context
    const currentFrame = {
      index: i,
      path: frameFilePath,
      timePosition
    };

    frameContext.push(currentFrame);

    // Keep context window at specified size
    if (frameContext.length > settings.contextWindowSize) {
      frameContext.shift();
    }

    // Generate description
    let description;
    let usageStats;

    if (frameContext.length === 1) {
      // First frame - just describe what's in it
      const result = await visionProvider.describeImage(frameFilePath, settings.defaultPrompt);
      description = result.description;
      usageStats = result.usage;
    } else {
      // Compare with previous frame
      const previousFrame = frameContext[frameContext.length - 2];
      const result = await visionProvider.compareImages(previousFrame.path, frameFilePath, settings.changePrompt);
      description = result.description;
      usageStats = result.usage;
    }

    // Update stats
    stats.totalVisionInputCost += usageStats.inputTokens;
    stats.totalVisionOutputCost += usageStats.outputTokens;
    stats.totalCost += usageStats.totalTokens;

    console.log(`Description: ${description}`);

    // Generate speech from description
    const audioFilePath = path.join(settings.tempDir, `audio_${i.toString().padStart(5, '0')}.mp3`);

    const ttsResult = await ttsProvider.textToSpeech(description, audioFilePath, {
      voice: settings.ttsVoice,
      model: settings.ttsProviders[settings.ttsProvider].model,
      speedFactor: settings.ttsSpeedFactor
    });

    const audioDuration = ttsResult.duration;
    stats.totalTTSCost += ttsResult.cost;

    console.log(`Audio duration: ${audioDuration} seconds`);

    // Store segment information
    audioSegments.push({
      audioFile: audioFilePath,
      startTime: timePosition,
      duration: audioDuration,
      description
    });

    // Update the time position for the next iteration
    // Add a small buffer (0.25 sec) between descriptions to prevent hard cuts
    const bufferTime = 0.25;
    currentTimePosition = timePosition + audioDuration + bufferTime;

    // If we've fallen behind schedule, try to catch up (but don't skip content)
    const nextIdealPosition = (i + 1) * settings.captureIntervalSeconds;
    if (currentTimePosition < nextIdealPosition) {
      console.log(`Audio finished before next scheduled frame. Catching up with timeline.`);
      currentTimePosition = nextIdealPosition;
      timelineDrift = 0; // Reset drift since we've caught up
    }
  }

  // Combine audio segments into final audio description track
  const outputAudioPath = path.join(settings.outputDir, `${path.basename(videoFilePath, path.extname(videoFilePath))}_description.mp3`);
  combineAudioSegments(audioSegments, outputAudioPath, videoDuration, settings);

  // Clean up temporary files if desired
  // cleanupTempFiles(settings.tempDir);

  console.log(`\nAudio description generated: ${outputAudioPath}`);
  console.log(`To play with video, use: ffplay -i ${videoFilePath} -i ${outputAudioPath} -map 0:v -map 1:a`);
  printStats(stats, settings);

  return {
    videoFile: videoFilePath,
    audioDescriptionFile: outputAudioPath
  };
}

/**
 * Generate audio description using the "batch time" mode with overlap prevention.
 * @param {string} videoFilePath - Path to the input video file
 * @param {number} videoDuration - Duration of the video in seconds
 * @param {object} settings - The merged config and user options
 * @param {object} visionProvider - The vision provider instance
 * @param {object} ttsProvider - The TTS provider instance
 */
async function generateAudioDescriptionBatch(videoFilePath, videoDuration, settings, visionProvider, ttsProvider) {
  const totalBatches = Math.floor(videoDuration / settings.batchWindowDuration);
  console.log(`Using batchTimeMode. Total batches: ${totalBatches} (each covers ${settings.batchWindowDuration} sec)`);

  // We'll hold the last batch's frames or last batch's description for context
  let lastBatchContext = [];

  const audioSegments = [];

  // Track our current time position (will be adjusted for audio overlap)
  let currentTimePosition = 0;

  // Track drift from the original schedule
  let timelineDrift = 0;
  const maxAllowableDrift = settings.batchWindowDuration * 0.5; // Maximum drift of 50% of batch window

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    // Calculate ideal batch timing based on configuration
    const idealBatchStart = batchIndex * settings.batchWindowDuration;

    // Use adjusted time position that accounts for previous audio durations
    const batchStart = currentTimePosition;

    // Calculate drift from the original schedule
    timelineDrift = batchStart - idealBatchStart;

    // Log if drift is becoming significant
    if (Math.abs(timelineDrift) > maxAllowableDrift) {
      console.warn(`WARNING: Timeline drift at batch ${batchIndex} is ${timelineDrift.toFixed(2)} seconds.`);
    }

    const batchEnd = idealBatchStart + settings.batchWindowDuration;
    if (batchEnd > videoDuration) break; // Safety check

    console.log(`Processing batch #${batchIndex}: Original time window ${idealBatchStart}-${batchEnd} sec, scheduled at ${batchStart.toFixed(2)} sec`);

    // Capture frames for this batch - use the ideal timing for frame capture
    const framePaths = [];
    for (let i = 0; i < settings.framesInBatch; i++) {
      const t = idealBatchStart + (i * settings.batchWindowDuration) / settings.framesInBatch;
      const frameFilePath = path.join(settings.tempDir, `batch_${batchIndex}_frame_${i}.jpg`);
      captureVideoFrame(videoFilePath, t, frameFilePath);
      framePaths.push(frameFilePath);
    }

    // Use AI to describe this batch of frames, possibly providing some context
    const result = await visionProvider.describeBatch(
      framePaths,
      lastBatchContext,
      settings.batchPrompt
    );

    const description = result.description;
    const usageStats = result.usage;

    // Update stats
    stats.totalVisionInputCost += usageStats.inputTokens;
    stats.totalVisionOutputCost += usageStats.outputTokens;
    stats.totalCost += usageStats.totalTokens;

    console.log(`Batch #${batchIndex} description:\n${description}\n`);

    // Convert description to TTS
    const audioFilePath = path.join(settings.tempDir, `batch_audio_${batchIndex}.mp3`);

    const ttsResult = await ttsProvider.textToSpeech(description, audioFilePath, {
      voice: settings.ttsVoice,
      model: settings.ttsProviders[settings.ttsProvider].model,
      speedFactor: settings.ttsSpeedFactor
    });

    const audioDuration = ttsResult.duration;
    stats.totalTTSCost += ttsResult.cost;

    console.log(`Batch #${batchIndex} audio duration: ${audioDuration} seconds`);

    // Store segment info with the adjusted start time
    audioSegments.push({
      audioFile: audioFilePath,
      startTime: batchStart,
      duration: audioDuration,
      description
    });

    // Update the time position for the next iteration
    // Add a small buffer (0.5 sec) between descriptions
    const bufferTime = 0.5;
    currentTimePosition = batchStart + audioDuration + bufferTime;

    // If we've fallen behind schedule, try to catch up (but don't skip content)
    const nextIdealPosition = (batchIndex + 1) * settings.batchWindowDuration;
    if (currentTimePosition < nextIdealPosition) {
      console.log(`Batch audio finished before next scheduled batch. Catching up with timeline.`);
      currentTimePosition = nextIdealPosition;
      timelineDrift = 0; // Reset drift since we've caught up
    }

    // Update lastBatchContext so the next batch can keep track of what's previously seen
    lastBatchContext = {
      lastDescription: description,
      lastFramePaths: framePaths.slice(-2)   // keep the last 2 frames from this batch
    };
  }

  // Combine all the audio segments into one track
  const outputAudioPath = path.join(
    settings.outputDir,
    `${path.basename(videoFilePath, path.extname(videoFilePath))}_description_batch.mp3`
  );
  combineAudioSegments(audioSegments, outputAudioPath, videoDuration, settings);

  console.log(`\nBatch audio description generated: ${outputAudioPath}`);
  console.log(`To play with video, use: ffplay -i ${videoFilePath} -i ${outputAudioPath} -map 0:v -map 1:a`);
  printStats(stats, settings);

  return {
    videoFile: videoFilePath,
    audioDescriptionFile: outputAudioPath
  };
}

/**
 * Print out statistics
 * @param {object} stats - Statistics object
 * @param {object} settings - Configuration settings
 */
function printStats(stats, settings) {
  // Pricing constants (as of March 2025, update as needed)
  const pricing = {
    // Get pricing based on vision provider
    vision: {
      openai: {
        'gpt-4o': {
          input: 0.0025,  // per 1K input tokens
          output: 0.01    // per 1K output tokens
        }
        // Add other OpenAI models here
      },
      gemini: {
        'gemini-pro-vision': {
          input: 0.0025,  // per 1K input tokens
          output: 0.0025   // per 1K output tokens
        }
      }
      // Add other vision providers here
    },
    // Get pricing based on TTS provider
    tts: {
      openai: {
        'tts-1': 0.015,      // per 1K characters
        'tts-1-hd': 0.030    // per 1K characters
      },
      eleven: {
        'eleven_multilingual_v2': 0.0733,      // per 1K characters
      }
      // Add other TTS providers here
    }
  };

  // Get the pricing for the selected providers
  const visionProvider = settings.visionProvider;
  const visionModel = settings.visionProviders[visionProvider].model;
  const ttsProvider = settings.ttsProvider;
  const ttsModel = settings.ttsProviders[ttsProvider].model;

  // Check if the pricing data exists
  const visionPricing = pricing.vision[visionProvider]?.[visionModel];
  const ttsPricing = pricing.tts[ttsProvider]?.[ttsModel];

  if (!visionPricing) {
    console.warn(`Warning: No pricing data for vision provider "${visionProvider}" and model "${visionModel}".`);
  }

  if (!ttsPricing) {
    console.warn(`Warning: No pricing data for TTS provider "${ttsProvider}" and model "${ttsModel}".`);
  }

  // Calculate prices using available pricing data
  const visionInputCost = visionPricing ? (stats.totalVisionInputCost * visionPricing.input / 1000) : 0;
  const visionOutputCost = visionPricing ? (stats.totalVisionOutputCost * visionPricing.output / 1000) : 0;
  const ttsCost = ttsPricing ? (stats.totalTTSCost * ttsPricing / 1000) : 0;
  const totalCost = visionInputCost + visionOutputCost + ttsCost;

  // Print out the stats
  console.log('\n=== STATISTICS ===');
  console.log(`Vision provider: ${visionProvider}, Model: ${visionModel}`);
  console.log(`TTS provider: ${ttsProvider}, Model: ${ttsModel}`);
  console.log(`Total vision input cost: ${visionInputCost.toFixed(4)}`);
  console.log(`Total vision output cost: ${visionOutputCost.toFixed(4)}`);
  console.log(`Total TTS cost: ${ttsCost.toFixed(4)}`);
  console.log(`Total cost: ${totalCost.toFixed(4)}`);
}

/**
 * Estimate the cost of generating audio descriptions for a video
 * @param {string} videoFilePath - Path to the input video file
 * @param {object} options - Optional configuration overrides
 * @returns {object} Cost estimation breakdown
 */
async function estimateCost(videoFilePath, options = {}) {
  // Merge provided options with defaults
  const settings = { ...defaultConfig, ...options };

  // Get video duration
  const videoDuration = getVideoDuration(videoFilePath);
  console.log(`Video duration: ${videoDuration} seconds`);

  // Calculate the number of frames or batches to process
  let totalUnits;
  let unitCostMultiplier;
  let unitType;

  if (settings.batchTimeMode) {
    totalUnits = Math.floor(videoDuration / settings.batchWindowDuration);
    unitCostMultiplier = settings.framesInBatch; // Cost multiplier for batch mode
    unitType = "batches";
  } else {
    totalUnits = Math.floor(videoDuration / settings.captureIntervalSeconds);
    unitCostMultiplier = 1; // No multiplier for normal mode
    unitType = "frames";
  }

  console.log(`Will process ${totalUnits} ${unitType}`);

  // Pricing constants (as of March 2025, update as needed)
  const pricing = {
    // Get pricing based on vision provider
    vision: {
      openai: {
        'gpt-4o': {
          input: 0.0025,  // per 1K input tokens
          output: 0.01    // per 1K output tokens
        }
        // Add other OpenAI models here
      },
      gemini: {
        'gemini-pro-vision': {
          input: 0.0025,  // per 1K input tokens
          output: 0.0025   // per 1K output tokens
        }
      }
      // Add other vision providers here
    },
    // Get pricing based on TTS provider
    tts: {
      openai: {
        'tts-1': 0.015,      // per 1K characters
        'tts-1-hd': 0.030    // per 1K characters
      }
      // Add other TTS providers here
    }
  };

  // Get the pricing for the selected providers
  const visionProvider = settings.visionProvider;
  const visionModel = settings.visionProviders[visionProvider].model;
  const ttsProvider = settings.ttsProvider;
  const ttsModel = settings.ttsProviders[ttsProvider].model;

  // Check if the pricing data exists
  const visionPricing = pricing.vision[visionProvider]?.[visionModel];
  const ttsPricing = pricing.tts[ttsProvider]?.[ttsModel];

  if (!visionPricing) {
    console.warn(`Warning: No pricing data for vision provider "${visionProvider}" and model "${visionModel}".`);
  }

  if (!ttsPricing) {
    console.warn(`Warning: No pricing data for TTS provider "${ttsProvider}" and model "${ttsModel}".`);
  }

  // Estimated token counts
  const estimatedVisionInputTokens = 1000 * unitCostMultiplier; // Base tokens for the vision input
  const estimatedPromptTokens = 100; // Tokens for the prompt text
  const estimatedOutputTokensPerUnit = 75; // Average tokens for description output

  // Estimated character counts for TTS
  const estimatedCharsPerDescription = 200; // Average characters per description

  // Calculate estimated costs for first unit
  const firstUnitCost = {
    visionInput: (estimatedVisionInputTokens + estimatedPromptTokens) * (visionPricing?.input || 0) / 1000,
    visionOutput: estimatedOutputTokensPerUnit * (visionPricing?.output || 0) / 1000,
    tts: estimatedCharsPerDescription * (ttsPricing || 0) / 1000
  };

  // For subsequent units, we need context (e.g., previous frames)
  const contextMultiplier = settings.batchTimeMode ? 1.2 : 2; // Less overhead in batch mode

  const subsequentUnitCost = {
    visionInput: (estimatedVisionInputTokens * contextMultiplier + estimatedPromptTokens) * (visionPricing?.input || 0) / 1000,
    visionOutput: estimatedOutputTokensPerUnit * (visionPricing?.output || 0) / 1000,
    tts: estimatedCharsPerDescription * (ttsPricing || 0) / 1000
  };

  // Calculate total costs
  const totalVisionInputCost =
    firstUnitCost.visionInput +
    (totalUnits - 1) * subsequentUnitCost.visionInput;

  const totalVisionOutputCost =
    firstUnitCost.visionOutput +
    (totalUnits - 1) * subsequentUnitCost.visionOutput;

  const totalTTSCost =
    firstUnitCost.tts +
    (totalUnits - 1) * subsequentUnitCost.tts;

  const totalCost = totalVisionInputCost + totalVisionOutputCost + totalTTSCost;

  // Create cost breakdown
  const costBreakdown = {
    videoInfo: {
      duration: videoDuration,
      totalUnits: totalUnits,
      unitType: unitType,
      processingInterval: settings.batchTimeMode ? settings.batchWindowDuration : settings.captureIntervalSeconds
    },
    providerInfo: {
      visionProvider: visionProvider,
      visionModel: visionModel,
      ttsProvider: ttsProvider,
      ttsModel: ttsModel
    },
    apiCosts: {
      visionInput: totalVisionInputCost.toFixed(4),
      visionOutput: totalVisionOutputCost.toFixed(4),
      tts: totalTTSCost.toFixed(4),
      total: totalCost.toFixed(4)
    },
    estimates: {
      totalAPICallsToProviders: totalUnits * 2, // Vision + TTS for each unit
      estimatedProcessingTimeMinutes: (totalUnits * 3) / 60 // rough estimate, 3 seconds per unit
    }
  };

  return costBreakdown;
}

/**
 * Load configuration from a JSON file
 * @param {string} filePath - Path to the configuration file
 * @returns {object} Configuration object
 */
function loadConfigFromFile(filePath) {
  try {
    const configFile = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(configFile);
    console.log(`Loaded configuration from ${filePath}`);
    return config;
  } catch (error) {
    console.error(`Error loading config from ${filePath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Save configuration to a JSON file
 * @param {string} filePath - Path to save the configuration file
 * @param {object} config - Configuration object to save
 */
function saveConfigToFile(filePath, config) {
  try {
    // Filter out non-configuration properties
    const configToSave = { ...config };
    const keysToExclude = ['_', '$0', 'video_file_path', 'estimate', 'config', 'saveConfig', 'help', 'version', 'h'];
    keysToExclude.forEach(key => delete configToSave[key]);

    fs.writeFileSync(filePath, JSON.stringify(configToSave, null, 2), 'utf8');
    console.log(`Configuration saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving config to ${filePath}:`, error.message);
  }
}

// Main execution
if (require.main === module) {
  // Parse command line arguments
  const argv = parseCommandLineArgs();

  // Start with default config
  let config = { ...defaultConfig };

  // If a config file is specified, load it
  if (argv.config) {
    const fileConfig = loadConfigFromFile(argv.config);
    config = { ...config, ...fileConfig };
  }

  // Override with any command line arguments
  Object.keys(argv).forEach(key => {
    if (key !== '_' && key !== '$0' && key !== 'config' && key !== 'saveConfig' &&
      key !== 'estimate' && key !== 'help' && key !== 'version' &&
      argv[key] !== undefined) {
      config[key] = argv[key];
    }
  });

  // Handle nested provider configurations
  if (argv.visionModel) {
    if (!config.visionProviders[config.visionProvider]) {
      config.visionProviders[config.visionProvider] = {};
    }
    config.visionProviders[config.visionProvider].model = argv.visionModel;
  }

  if (argv.ttsModel) {
    if (!config.ttsProviders[config.ttsProvider]) {
      config.ttsProviders[config.ttsProvider] = {};
    }
    config.ttsProviders[config.ttsProvider].model = argv.ttsModel;
  }

  if (argv.ttsVoice) {
    if (!config.ttsProviders[config.ttsProvider]) {
      config.ttsProviders[config.ttsProvider] = {};
    }
    config.ttsProviders[config.ttsProvider].voice = argv.ttsVoice;
  }

  // Save configuration if requested
  if (argv.saveConfig) {
    saveConfigToFile(argv.saveConfig, config);
  }

  // Check if a video file is provided
  if (argv._.length < 1) {
    console.error('Error: No video file specified');
    console.log('Usage: node script.js <video_file_path> [options]');
    console.log('Use --help for more information');
    process.exit(1);
  }

  const videoFilePath = argv._[0];

  // Run estimation or full processing
  if (argv.estimate) {
    estimateCost(videoFilePath, config)
      .then(costBreakdown => {
        console.log('\n=== COST ESTIMATION ===');
        console.log(JSON.stringify(costBreakdown, null, 2));
        console.log(`\nEstimated total cost: ${costBreakdown.apiCosts.total}`);
        console.log(`Estimated processing time: ${costBreakdown.estimates.estimatedProcessingTimeMinutes.toFixed(1)} minutes`);
        console.log('Note: Actual costs may vary based on image complexity and actual response lengths.');
      })
      .catch(err => {
        console.error('Error estimating costs:', err);
      });
  } else {
    // Run the full generator
    generateAudioDescription(videoFilePath, config).catch(err => {
      console.error('Error generating audio description:', err);
    });
  }
}

// Export functions for use as a module
module.exports = {
  generateAudioDescription,
  estimateCost,
  config: defaultConfig,
  VisionProviderFactory,
  TTSProviderFactory
};