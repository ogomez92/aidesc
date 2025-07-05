import { VisionProviderSettings } from "@interfaces/settings";
import VisionProvider from "./vision_provider";
import { GoogleGenerativeAI } from "@google/generative-ai";
import VisionResult from "@interfaces/vision_result";
import BatchContext from "@interfaces/batch_context";

export class GeminiVisionProvider extends VisionProvider {
    private genAI: GoogleGenerativeAI;
    private model: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    public static names = ['gemini'];

    constructor(config: VisionProviderSettings) {
        super(config);
        this.genAI = new GoogleGenerativeAI(config.apiKey || '');
        this.model = this.genAI.getGenerativeModel({ model: config.model });
    }

    async describeImage(imagePath: string, prompt: string, lastDescription: string): Promise<VisionResult> {
        const fs = await import('fs');
        try {
            const promptWithLastDescription = `${prompt}\n\nLast description provided: ${lastDescription}`
            const imageData = fs.readFileSync(imagePath);
            const imagePart = {
                inlineData: {
                    data: imageData.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };

            const result = await this.model.generateContent([promptWithLastDescription, imagePart]);
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


    async describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult> {
        const fs = await import('fs');
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
            throw new Error(`Error describing batch of images with Gemini: ${error}`);
        }
    }
}
