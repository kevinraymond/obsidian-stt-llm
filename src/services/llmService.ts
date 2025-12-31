import { requestUrl } from "obsidian";

interface LlmSettings {
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature: number;
	maxTokens: number;
}

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface ChatCompletionResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
}

export class LlmService {
	constructor(private getSettings: () => LlmSettings) {}

	async complete(userPrompt: string, systemPrompt?: string): Promise<string> {
		const settings = this.getSettings();

		const messages: ChatMessage[] = [];

		if (systemPrompt) {
			messages.push({ role: "system", content: systemPrompt });
		}

		messages.push({ role: "user", content: userPrompt });

		// Determine if this is Ollama (different endpoint) or standard OpenAI-compatible
		const isOllama = settings.baseUrl.includes("11434");
		const endpoint = isOllama
			? `${settings.baseUrl}/v1/chat/completions`
			: `${settings.baseUrl}/v1/chat/completions`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (settings.apiKey) {
			headers["Authorization"] = `Bearer ${settings.apiKey}`;
		}

		const body = {
			model: settings.model,
			messages,
			temperature: settings.temperature,
			max_tokens: settings.maxTokens,
		};

		try {
			const response = await requestUrl({
				url: endpoint,
				method: "POST",
				headers,
				body: JSON.stringify(body),
				throw: false,
			});

			if (response.status !== 200) {
				const errorText = response.text || `HTTP ${response.status}`;
				throw new Error(`LLM request failed: ${errorText}`);
			}

			const data = response.json as ChatCompletionResponse;

			if (!data.choices || data.choices.length === 0) {
				throw new Error("No response from LLM");
			}

			return data.choices[0].message.content;
		} catch (error) {
			if (error instanceof Error) {
				// Check for common connection errors
				if (error.message.includes("ECONNREFUSED")) {
					throw new Error(
						`Cannot connect to LLM server at ${settings.baseUrl}. Is the server running?`
					);
				}
				throw error;
			}
			throw new Error("Unknown error occurred");
		}
	}

	async correctTranscription(rawText: string, correctionPrompt: string): Promise<string> {
		const prompt = correctionPrompt.replace("{{text}}", rawText);
		return this.complete(prompt);
	}
}
