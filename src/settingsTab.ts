import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SttLlmPlugin from "./main";
import {
	LANGUAGE_OPTIONS,
	isLlmConfigured,
	DEFAULT_VOICE_COMMANDS,
	type VoiceCommandType,
} from "./settings";

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
		new Setting(containerEl).setName("Speech-to-text").setHeading();

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("Address for the transcription server")
			.addText((text) =>
				text
					.setPlaceholder("Example: ws://localhost:8765")
					.setValue(this.plugin.settings.stt.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.stt.serverUrl = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button.setButtonText("Test connection").onClick(async () => {
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
		new Setting(containerEl).setName("Language model (optional)").setHeading();

		// Show LLM status
		const llmConfigured = isLlmConfigured(this.plugin.settings);
		const llmStatusEl = containerEl.createEl("div", {
			cls: "stt-llm-status",
		});
		if (llmConfigured) {
			llmStatusEl.createEl("span", {
				text: "Language model features are enabled",
				cls: "stt-llm-status-enabled",
			});
		} else {
			llmStatusEl.createEl("span", {
				text: "Configure language model to enable summarization, tagging, and custom prompts",
				cls: "stt-llm-status-disabled",
			});
		}

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc("Compatible API endpoint")
			.addText((text) =>
				text
					.setPlaceholder("HTTP://localhost:11434/v1")
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
					.setPlaceholder("Example: llama3.2")
					.setValue(this.plugin.settings.llm.model)
					.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Optional API key (leave empty for local servers)")
			.addText((text) =>
				text
					.setPlaceholder("Optional")
					.setValue(this.plugin.settings.llm.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.llm.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		// Auto-tagging basic settings
		new Setting(containerEl).setName("Auto-tagging").setHeading();

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

		// ===== VOICE COMMANDS SECTION =====
		new Setting(containerEl).setName("Voice commands").setHeading();

		new Setting(containerEl)
			.setName("Enable voice commands")
			.setDesc("Convert spoken commands to Markdown formatting (e.g., 'start bold' → **)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.voiceCommands.enabled)
					.onChange(async (value) => {
						this.plugin.settings.voiceCommands.enabled = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide command list
					})
			);

		// Only show command configuration if enabled
		if (this.plugin.settings.voiceCommands.enabled) {
			const commandsContainer = containerEl.createEl("div", {
				cls: "stt-voice-commands-container",
			});

			// Group commands by category
			const pairedCommands = this.plugin.settings.voiceCommands.commands.filter(
				(c) => c.isPaired
			);
			const singleCommands = this.plugin.settings.voiceCommands.commands.filter(
				(c) => !c.isPaired
			);

			// Paired commands section
			new Setting(commandsContainer).setName("Paired commands (start/end)").setHeading();
			for (const command of pairedCommands) {
				this.renderCommandSetting(commandsContainer, command);
			}

			// Single commands section
			new Setting(commandsContainer).setName("Single commands").setHeading();
			for (const command of singleCommands) {
				this.renderCommandSetting(commandsContainer, command);
			}

			// Reset to defaults button
			new Setting(containerEl)
				.setName("Reset to defaults")
				.setDesc("Restore all voice commands to their default trigger phrases")
				.addButton((button) =>
					button.setButtonText("Reset").onClick(async () => {
						this.plugin.settings.voiceCommands.commands = JSON.parse(
							JSON.stringify(DEFAULT_VOICE_COMMANDS)
						);
						await this.plugin.saveSettings();
						this.display();
						new Notice("Voice commands reset to defaults");
					})
				);
		}

		// ===== ADVANCED SECTION =====
		const advancedDetails = containerEl.createEl("details", { cls: "stt-llm-advanced-settings" });
		advancedDetails.createEl("summary", { text: "Advanced settings" });

		const advancedContainer = advancedDetails.createEl("div", { cls: "stt-llm-advanced-content" });

		// LLM Advanced
		new Setting(advancedContainer).setName("Model parameters").setHeading();

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
		new Setting(advancedContainer).setName("Voice detection").setHeading();

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
		new Setting(advancedContainer).setName("Prompt templates").setHeading();

		new Setting(advancedContainer)
			.setName("Automatic correction")
			.setDesc("Use language model to fix transcription errors (shows both original and corrected)")
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

	/**
	 * Render a single voice command setting
	 */
	private renderCommandSetting(container: HTMLElement, command: typeof this.plugin.settings.voiceCommands.commands[0]): void {
		const commandEl = container.createEl("div", { cls: "stt-voice-command-item" });

		// Format the command type for display
		const typeLabel = this.formatCommandType(command.type);

		// Preview of markdown output
		const preview = command.isPaired
			? `${command.markdownStart}text${command.markdownEnd}`
			: command.markdownStart.replace(/\n/g, "↵");

		// Command header with type and preview
		const headerEl = commandEl.createEl("div", { cls: "stt-voice-command-header" });
		headerEl.createEl("span", { text: typeLabel, cls: "stt-voice-command-type" });
		headerEl.createEl("code", { text: preview, cls: "stt-voice-command-preview" });

		// Start trigger input
		new Setting(commandEl)
			.setName(command.isPaired ? "Start trigger" : "Trigger phrase")
			.addText((text) =>
				text.setValue(command.startTrigger).onChange(async (value) => {
					command.startTrigger = value;
					await this.plugin.saveSettings();
				})
			);

		// End trigger input (only for paired commands)
		if (command.isPaired && command.endTrigger !== undefined) {
			new Setting(commandEl)
				.setName("End trigger")
				.addText((text) =>
					text.setValue(command.endTrigger || "").onChange(async (value) => {
						command.endTrigger = value;
						await this.plugin.saveSettings();
					})
				);
		}
	}

	/**
	 * Format a command type for display
	 */
	private formatCommandType(type: VoiceCommandType): string {
		const typeLabels: Record<VoiceCommandType, string> = {
			bold: "Bold",
			italic: "Italic",
			strikethrough: "Strikethrough",
			code_inline: "Inline Code",
			code_block: "Code Block",
			blockquote: "Blockquote",
			heading_1: "Heading 1",
			heading_2: "Heading 2",
			heading_3: "Heading 3",
			heading_4: "Heading 4",
			heading_5: "Heading 5",
			heading_6: "Heading 6",
			bullet_list: "Bullet List",
			numbered_list: "Numbered List",
			checkbox: "Checkbox",
			link: "Link",
			new_line: "New Line",
			new_paragraph: "New Paragraph",
		};
		return typeLabels[type] || type;
	}
}
