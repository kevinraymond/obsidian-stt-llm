import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SttLlmPlugin from "./main";
import { LANGUAGE_OPTIONS, isLlmConfigured } from "./settings";

export class SttLlmSettingTab extends PluginSettingTab {
	plugin: SttLlmPlugin;

	constructor(app: App, plugin: SttLlmPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ===== SPEECH-TO-TEXT SECTION =====
		containerEl.createEl("h2", { text: "Speech-to-Text" });

		new Setting(containerEl)
			.setName("STT Server URL")
			.setDesc("WebSocket URL for the transcription server")
			.addText((text) =>
				text
					.setPlaceholder("ws://localhost:8765")
					.setValue(this.plugin.settings.stt.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.stt.serverUrl = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button.setButtonText("Test Connection").onClick(async () => {
					const url = this.plugin.settings.stt.serverUrl;
					new Notice("Testing connection...");
					try {
						const ws = new WebSocket(url);
						await new Promise<void>((resolve, reject) => {
							ws.onopen = () => {
								new Notice("Connection successful!");
								ws.close();
								resolve();
							};
							ws.onerror = () => {
								reject(new Error("Connection failed"));
							};
							setTimeout(() => reject(new Error("Connection timeout")), 5000);
						});
					} catch (error) {
						new Notice(`Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
					}
				})
			);

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Language for transcription")
			.addDropdown((dropdown) => {
				// Add all language options
				for (const lang of LANGUAGE_OPTIONS) {
					dropdown.addOption(lang.code, `${lang.name} (${lang.code})`);
				}
				dropdown.setValue(this.plugin.settings.stt.language);
				dropdown.onChange(async (value) => {
					this.plugin.settings.stt.language = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Auto-stop on silence")
			.setDesc("Stop recording automatically when you stop speaking")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.vad.enabled).onChange(async (value) => {
					this.plugin.settings.vad.enabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Silence duration")
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

		// ===== LLM SECTION =====
		containerEl.createEl("h2", { text: "LLM (Optional)" });

		// Show LLM status
		const llmConfigured = isLlmConfigured(this.plugin.settings);
		const llmStatusEl = containerEl.createEl("div", {
			cls: "stt-llm-status",
		});
		if (llmConfigured) {
			llmStatusEl.createEl("span", {
				text: "LLM features are enabled",
				cls: "stt-llm-status-enabled",
			});
		} else {
			llmStatusEl.createEl("span", {
				text: "Configure LLM to enable summarization, tagging, and custom prompts",
				cls: "stt-llm-status-disabled",
			});
		}

		new Setting(containerEl)
			.setName("API Base URL")
			.setDesc("OpenAI-compatible API endpoint (Ollama, LM Studio, etc.)")
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
			.setName("Model")
			.setDesc("Model name for completions")
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

		// Auto-tagging basic settings
		containerEl.createEl("h3", { text: "Auto-Tagging" });

		new Setting(containerEl)
			.setName("Prefer existing tags")
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
			.setName("Max new tags")
			.setDesc("Maximum tags to generate per note")
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

		// ===== ADVANCED SECTION =====
		const advancedDetails = containerEl.createEl("details", { cls: "stt-llm-advanced-settings" });
		advancedDetails.createEl("summary", { text: "Advanced Settings" });

		const advancedContainer = advancedDetails.createEl("div", { cls: "stt-llm-advanced-content" });

		// LLM Advanced
		advancedContainer.createEl("h3", { text: "LLM Parameters" });

		new Setting(advancedContainer)
			.setName("Temperature")
			.setDesc("Controls randomness (0 = deterministic, 1 = creative)")
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

		new Setting(advancedContainer)
			.setName("Max tokens")
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

		// VAD Advanced
		advancedContainer.createEl("h3", { text: "Voice Detection" });

		new Setting(advancedContainer)
			.setName("Silence threshold")
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

		// Prompt Templates
		advancedContainer.createEl("h3", { text: "Prompt Templates" });

		new Setting(advancedContainer)
			.setName("LLM correction")
			.setDesc("Use LLM to fix transcription errors (shows both original and corrected)")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.correction.enabled).onChange(async (value) => {
					this.plugin.settings.correction.enabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(advancedContainer)
			.setName("Correction prompt")
			.setDesc("Use {{text}} for the transcription")
			.addTextArea((text) =>
				text
					.setPlaceholder("Fix transcription errors...")
					.setValue(this.plugin.settings.correction.prompt)
					.onChange(async (value) => {
						this.plugin.settings.correction.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(advancedContainer)
			.setName("Summarization prompt")
			.setDesc("Use {{text}} for selected text")
			.addTextArea((text) =>
				text
					.setPlaceholder("Summarize the following...")
					.setValue(this.plugin.settings.summarization.prompt)
					.onChange(async (value) => {
						this.plugin.settings.summarization.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(advancedContainer)
			.setName("Tagging prompt")
			.setDesc("Use {{content}} and {{existingTags}}")
			.addTextArea((text) =>
				text
					.setPlaceholder("Analyze and suggest tags...")
					.setValue(this.plugin.settings.tagging.prompt)
					.onChange(async (value) => {
						this.plugin.settings.tagging.prompt = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(advancedContainer)
			.setName("Default custom prompt")
			.setDesc("Pre-fill text for custom prompt modal")
			.addTextArea((text) =>
				text
					.setPlaceholder("Enter default prompt...")
					.setValue(this.plugin.settings.customPrompt.defaultPrompt)
					.onChange(async (value) => {
						this.plugin.settings.customPrompt.defaultPrompt = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
