// Common language options for the dropdown
export const LANGUAGE_OPTIONS: { code: string; name: string }[] = [
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "it", name: "Italian" },
	{ code: "pt", name: "Portuguese" },
	{ code: "ru", name: "Russian" },
	{ code: "zh", name: "Chinese" },
	{ code: "ja", name: "Japanese" },
	{ code: "ko", name: "Korean" },
	{ code: "ar", name: "Arabic" },
	{ code: "hi", name: "Hindi" },
	{ code: "nl", name: "Dutch" },
	{ code: "pl", name: "Polish" },
	{ code: "tr", name: "Turkish" },
	{ code: "vi", name: "Vietnamese" },
	{ code: "th", name: "Thai" },
	{ code: "id", name: "Indonesian" },
	{ code: "uk", name: "Ukrainian" },
	{ code: "cs", name: "Czech" },
	{ code: "auto", name: "Auto-detect" },
];

// Voice Command Types
export type VoiceCommandType =
	| "bold"
	| "italic"
	| "strikethrough"
	| "code_inline"
	| "code_block"
	| "blockquote"
	| "heading_1"
	| "heading_2"
	| "heading_3"
	| "heading_4"
	| "heading_5"
	| "heading_6"
	| "bullet_list"
	| "numbered_list"
	| "checkbox"
	| "link"
	| "new_line"
	| "new_paragraph";

export interface VoiceCommand {
	type: VoiceCommandType;
	startTrigger: string; // Phrase to start/open (e.g., "start bold")
	endTrigger?: string; // Phrase to end/close - undefined for single commands
	markdownStart: string; // Markdown to insert at start (e.g., "**")
	markdownEnd?: string; // Markdown to insert at end - undefined for single commands
	isPaired: boolean; // true = requires open/close, false = single action
}

export interface VoiceCommandsSettings {
	enabled: boolean;
	commands: VoiceCommand[];
}

// Default voice command mappings
export const DEFAULT_VOICE_COMMANDS: VoiceCommand[] = [
	// Paired formatting commands
	{
		type: "bold",
		startTrigger: "start bold",
		endTrigger: "end bold",
		markdownStart: "**",
		markdownEnd: "**",
		isPaired: true,
	},
	{
		type: "italic",
		startTrigger: "start italic",
		endTrigger: "end italic",
		markdownStart: "*",
		markdownEnd: "*",
		isPaired: true,
	},
	{
		type: "strikethrough",
		startTrigger: "start strikethrough",
		endTrigger: "end strikethrough",
		markdownStart: "~~",
		markdownEnd: "~~",
		isPaired: true,
	},
	{
		type: "code_inline",
		startTrigger: "start code",
		endTrigger: "end code",
		markdownStart: "`",
		markdownEnd: "`",
		isPaired: true,
	},
	{
		type: "code_block",
		startTrigger: "start code block",
		endTrigger: "end code block",
		markdownStart: "\n```\n",
		markdownEnd: "\n```\n",
		isPaired: true,
	},
	{
		type: "blockquote",
		startTrigger: "start quote",
		endTrigger: "end quote",
		markdownStart: "\n> ",
		markdownEnd: "\n",
		isPaired: true,
	},
	{
		type: "link",
		startTrigger: "start link",
		endTrigger: "end link",
		markdownStart: "[",
		markdownEnd: "](url)",
		isPaired: true,
	},

	// Single-action commands - headings
	{
		type: "heading_1",
		startTrigger: "heading one",
		markdownStart: "\n# ",
		isPaired: false,
	},
	{
		type: "heading_2",
		startTrigger: "heading two",
		markdownStart: "\n## ",
		isPaired: false,
	},
	{
		type: "heading_3",
		startTrigger: "heading three",
		markdownStart: "\n### ",
		isPaired: false,
	},
	{
		type: "heading_4",
		startTrigger: "heading four",
		markdownStart: "\n#### ",
		isPaired: false,
	},
	{
		type: "heading_5",
		startTrigger: "heading five",
		markdownStart: "\n##### ",
		isPaired: false,
	},
	{
		type: "heading_6",
		startTrigger: "heading six",
		markdownStart: "\n###### ",
		isPaired: false,
	},

	// Single-action commands - lists
	{
		type: "bullet_list",
		startTrigger: "bullet point",
		markdownStart: "\n- ",
		isPaired: false,
	},
	{
		type: "numbered_list",
		startTrigger: "numbered item",
		markdownStart: "\n1. ",
		isPaired: false,
	},
	{
		type: "checkbox",
		startTrigger: "checkbox",
		markdownStart: "\n- [ ] ",
		isPaired: false,
	},

	// Single-action commands - whitespace
	{
		type: "new_line",
		startTrigger: "new line",
		markdownStart: "\n",
		isPaired: false,
	},
	{
		type: "new_paragraph",
		startTrigger: "new paragraph",
		markdownStart: "\n\n",
		isPaired: false,
	},
];

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

	// Voice Commands Settings
	voiceCommands: VoiceCommandsSettings;
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
	voiceCommands: {
		enabled: true,
		commands: DEFAULT_VOICE_COMMANDS,
	},
};

/**
 * Check if LLM is configured (has a valid base URL and model).
 * Used to conditionally show LLM-related UI elements.
 */
export function isLlmConfigured(settings: SttLlmSettings): boolean {
	return !!(settings.llm.baseUrl && settings.llm.model);
}
