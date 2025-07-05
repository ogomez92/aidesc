import { VisionProviderSettings } from "@interfaces/settings";
import VisionProvider from "./vision_provider";
import { OpenAI } from 'openai';
import VisionResult from "@interfaces/vision_result";
import BatchContext from "@interfaces/batch_context";

export class OpenAIVisionProvider extends VisionProvider {
    private openai: OpenAI;
    public static names = ['openai', 'openailike'];

    constructor(config: VisionProviderSettings) {
        super(config);
        this.openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            baseURL: config.baseURL ? config.baseURL : null,
            apiKey: config.apiKey,
        });
    }

    public async describeImage(imagePath: string, prompt: string, lastDescription: string): Promise<VisionResult> {
        const fs = await import('fs');

        try {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "text", text: `last description provided: ${lastDescription} ` },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: this.config.maxTokens || 3000
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
                description: `Unable to describe this image. ${error}`,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
        }
    }


    public async describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult> {
        const fs = await import('fs');

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
            throw new Error(`Error describing batch of images: ${error}`);
        }
    }
}
