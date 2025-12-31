export interface SttLlmSettings {
	// STT Server Settings
	stt: {
		serverUrl: string;
		language: string;
	};

	// Voice Activity Detection Settings
	vad: {
		enabled: boolean;
		silenceThreshold: number; // 0-100, audio level below this = silence
		silenceDuration: number; // seconds of silence before auto-stop
	};

	// STT Correction Settings
	correction: {
		enabled: boolean;
		prompt: string;
	};

	// LLM Settings
	llm: {
		baseUrl: string;
		apiKey: string;
		model: string;
		temperature: number;
		maxTokens: number;
	};

	// Summarization Settings
	summarization: {
		prompt: string;
	};

	// Auto-tagging Settings
	tagging: {
		preferExistingTags: boolean;
		maxNewTags: number;
		prompt: string;
	};

	// Custom Prompt Settings
	customPrompt: {
		defaultPrompt: string;
	};
}

export const DEFAULT_SETTINGS: SttLlmSettings = {
	stt: {
		serverUrl: "ws://localhost:8765",
		language: "en",
	},
	vad: {
		enabled: true,
		silenceThreshold: 15, // 0-100 scale
		silenceDuration: 1.5, // seconds
	},
	correction: {
		enabled: false,
		prompt: `Fix any transcription errors in the following text. Correct grammar, punctuation, and obvious word mistakes. Keep the original meaning and style. Only output the corrected text, nothing else.

Text: {{text}}`,
	},
	llm: {
		baseUrl: "http://localhost:11434",
		apiKey: "",
		model: "llama3.2",
		temperature: 0.7,
		maxTokens: 2048,
	},
	summarization: {
		prompt: `Provide a single, concise summary of the following text. Focus on the key points and main ideas. Output ONLY the summary paragraph(s) - no headers, labels, or multiple versions.

Text:
{{text}}`,
	},
	tagging: {
		preferExistingTags: true,
		maxNewTags: 5,
		prompt: `Analyze the following content and suggest relevant tags for organizing this note.

{{#if existingTags}}
Prefer tags from this existing list when appropriate: {{existingTags}}
You may also suggest new tags if none of the existing ones fit well.
{{/if}}

Content:
{{content}}

Return ONLY a JSON array of tag strings (without # prefix), e.g., ["tag1", "tag2"]. No other text.`,
	},
	customPrompt: {
		defaultPrompt: "",
	},
};
