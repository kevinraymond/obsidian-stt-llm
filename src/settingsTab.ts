import { App, PluginSettingTab, Setting } from "obsidian";
import type SttLlmPlugin from "./main";

export class SttLlmSettingTab extends PluginSettingTab {
	plugin: SttLlmPlugin;

	constructor(app: App, plugin: SttLlmPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// LLM Settings
		containerEl.createEl("h2", { text: "LLM Settings" });

		new Setting(containerEl)
			.setName("API Base URL")
			.setDesc("Base URL for OpenAI-compatible API (e.g., Ollama, LM Studio)")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.llm.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.llm.baseUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Optional API key (leave empty for local servers)")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.llm.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.llm.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Model name to use for completions")
			.addText((text) =>
				text
					.setPlaceholder("llama3.2")
					.setValue(this.plugin.settings.llm.model)
					.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Controls randomness (0.0 = deterministic, 1.0 = creative)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.1)
					.setValue(this.plugin.settings.llm.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.llm.temperature = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Maximum tokens in response")
			.addText((text) =>
				text
					.setPlaceholder("2048")
					.setValue(String(this.plugin.settings.llm.maxTokens))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed > 0) {
							this.plugin.settings.llm.maxTokens = parsed;
							await this.plugin.saveSettings();
						}
					})
			);

		// STT Settings
		containerEl.createEl("h2", { text: "Speech-to-Text Settings" });

		new Setting(containerEl)
			.setName("STT Server URL")
			.setDesc("WebSocket URL for the STT server")
			.addText((text) =>
				text
					.setPlaceholder("ws://localhost:8765")
					.setValue(this.plugin.settings.stt.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.stt.serverUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Language code for transcription")
			.addText((text) =>
				text
					.setPlaceholder("en")
					.setValue(this.plugin.settings.stt.language)
					.onChange(async (value) => {
						this.plugin.settings.stt.language = value;
						await this.plugin.saveSettings();
					})
			);

		// Voice Activity Detection Settings
		containerEl.createEl("h2", { text: "Voice Activity Detection" });

		new Setting(containerEl)
			.setName("Enable Auto-Stop")
			.setDesc("Automatically stop recording after silence is detected")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.vad.enabled)
					.onChange(async (value) => {
						this.plugin.settings.vad.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Silence Threshold")
			.setDesc("Audio level below this is considered silence (0-100)")
			.addSlider((slider) =>
				slider
					.setLimits(5, 50, 5)
					.setValue(this.plugin.settings.vad.silenceThreshold)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.vad.silenceThreshold = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Silence Duration")
			.setDesc("Seconds of silence before auto-stop")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 5, 0.5)
					.setValue(this.plugin.settings.vad.silenceDuration)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.vad.silenceDuration = value;
						await this.plugin.saveSettings();
					})
			);

		// STT Correction Settings
		containerEl.createEl("h2", { text: "Transcription Correction" });

		new Setting(containerEl)
			.setName("Enable LLM Correction")
			.setDesc("Post-process transcriptions with LLM to fix errors")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.correction.enabled)
					.onChange(async (value) => {
						this.plugin.settings.correction.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Correction Prompt")
			.setDesc("Prompt template for correction. Use {{text}} for the transcription.")
			.addTextArea((text) =>
				text
					.setPlaceholder("Fix transcription errors...")
					.setValue(this.plugin.settings.correction.prompt)
					.onChange(async (value) => {
						this.plugin.settings.correction.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		// Summarization Settings
		containerEl.createEl("h2", { text: "Summarization" });

		new Setting(containerEl)
			.setName("Summarization Prompt")
			.setDesc("Prompt template for summarization. Use {{text}} for selected text.")
			.addTextArea((text) =>
				text
					.setPlaceholder("Summarize the following...")
					.setValue(this.plugin.settings.summarization.prompt)
					.onChange(async (value) => {
						this.plugin.settings.summarization.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		// Auto-tagging Settings
		containerEl.createEl("h2", { text: "Auto-Tagging" });

		new Setting(containerEl)
			.setName("Prefer Existing Tags")
			.setDesc("Prioritize tags already used in your vault")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tagging.preferExistingTags)
					.onChange(async (value) => {
						this.plugin.settings.tagging.preferExistingTags = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max New Tags")
			.setDesc("Maximum number of new tags to generate")
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(this.plugin.settings.tagging.maxNewTags)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.tagging.maxNewTags = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Tagging Prompt")
			.setDesc("Prompt template for tag generation. Use {{content}} and {{existingTags}}.")
			.addTextArea((text) =>
				text
					.setPlaceholder("Analyze and suggest tags...")
					.setValue(this.plugin.settings.tagging.prompt)
					.onChange(async (value) => {
						this.plugin.settings.tagging.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		// Custom Prompt Settings
		containerEl.createEl("h2", { text: "Custom Prompt" });

		new Setting(containerEl)
			.setName("Default Custom Prompt")
			.setDesc("Default prompt to show in custom prompt modal (optional)")
			.addTextArea((text) =>
				text
					.setPlaceholder("Enter your default prompt...")
					.setValue(this.plugin.settings.customPrompt.defaultPrompt)
					.onChange(async (value) => {
						this.plugin.settings.customPrompt.defaultPrompt = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
