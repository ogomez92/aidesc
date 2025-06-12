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
