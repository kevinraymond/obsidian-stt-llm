import { Editor, MarkdownView, Menu, Notice, Plugin } from "obsidian";
import { SttLlmSettings, DEFAULT_SETTINGS, isLlmConfigured } from "./settings";
import { SttLlmSettingTab } from "./settingsTab";
import { LlmService } from "./services/llmService";
import { TagService } from "./services/tagService";
import { SttService } from "./services/sttService";
import { RecordingManager } from "./features/recordingManager";
import { StatusBarManager } from "./ui/statusBarManager";

export default class SttLlmPlugin extends Plugin {
	settings: SttLlmSettings;
	llmService: LlmService;
	tagService: TagService;
	sttService: SttService;
	recordingManager: RecordingManager;
	statusBarManager: StatusBarManager;

	async onload() {
		await this.loadSettings();

		// Initialize services
		this.llmService = new LlmService(() => this.settings.llm);
		this.tagService = new TagService(this.app);
		this.sttService = new SttService(this.settings.stt.serverUrl);
		this.recordingManager = new RecordingManager(
			this.app,
			this.sttService,
			this.llmService,
			() => this.settings
		);

		// Register commands
		this.registerCommands();

		// Register context menu
		this.registerContextMenu();

		// Add ribbon icon for STT
		const ribbonIcon = this.addRibbonIcon("mic", "Start transcription", () => {
			void this.recordingManager.toggleRecording();
		});
		this.recordingManager.setRibbonIcon(ribbonIcon);

		// Add settings tab
		this.addSettingTab(new SttLlmSettingTab(this.app, this));

		// Initialize status bar
		this.statusBarManager = new StatusBarManager(this);

		// Setup LLM-related UI (conditional on LLM being configured)
		this.setupLlmUI();

	}

	onunload() {
		this.recordingManager?.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Refresh LLM UI when settings change
		this.setupLlmUI();
	}

	/**
	 * Setup LLM-related UI elements.
	 * Called on load and when settings change.
	 * Shows/hides LLM features based on whether LLM is configured.
	 */
	private setupLlmUI(): void {
		const llmEnabled = isLlmConfigured(this.settings);

		// Status bar LLM buttons
		if (llmEnabled) {
			// Add buttons if they don't exist
			if (!this.statusBarManager.hasButton("summarize")) {
				this.statusBarManager.addButton("summarize", {
					icon: "file-text",
					tooltip: "Summarize selection",
					onClick: () => {
						const view = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (view?.editor) {
							void this.summarizeSelection(view.editor);
						} else {
							new Notice("No active editor");
						}
					},
				});
			}
			if (!this.statusBarManager.hasButton("custom-prompt")) {
				this.statusBarManager.addButton("custom-prompt", {
					icon: "message-square",
					tooltip: "Custom prompt",
					onClick: () => {
						const view = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (view?.editor) {
							void this.customPrompt(view.editor);
						} else {
							new Notice("No active editor");
						}
					},
				});
			}
			if (!this.statusBarManager.hasButton("auto-tag")) {
				this.statusBarManager.addButton("auto-tag", {
					icon: "tags",
					tooltip: "Generate tags",
					onClick: () => {
						void this.autoTagCurrentNote();
					},
				});
			}
		} else {
			// Remove LLM buttons
			this.statusBarManager.removeButton("summarize");
			this.statusBarManager.removeButton("custom-prompt");
			this.statusBarManager.removeButton("auto-tag");
		}
	}

	private registerCommands() {
		// Summarize selection
		this.addCommand({
			id: "summarize",
			name: "Summarize selection",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.summarizeSelection(editor);
			},
		});

		// Custom prompt
		this.addCommand({
			id: "custom-prompt",
			name: "Send selection with custom prompt",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.customPrompt(editor);
			},
		});

		// Auto-tag current note
		this.addCommand({
			id: "auto-tag",
			name: "Generate tags for current note",
			callback: async () => {
				await this.autoTagCurrentNote();
			},
		});

		// Toggle STT recording
		this.addCommand({
			id: "toggle-recording",
			name: "Toggle transcription",
			callback: async () => {
				await this.recordingManager.toggleRecording();
			},
		});
	}

	private registerContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
				// Only show LLM menu items if LLM is configured
				if (!isLlmConfigured(this.settings)) {
					return;
				}

				const selection = editor.getSelection();

				menu.addSeparator();

				if (selection) {
					menu.addItem((item) => {
						item.setTitle("Summarize selection")
							.setIcon("file-text")
							.onClick(() => {
								void this.summarizeSelection(editor);
							});
					});

					menu.addItem((item) => {
						item.setTitle("Send with custom prompt")
							.setIcon("message-square")
							.onClick(() => {
								void this.customPrompt(editor);
							});
					});
				}

				menu.addItem((item) => {
					item.setTitle("Generate tags for note")
						.setIcon("tags")
						.onClick(() => {
							void this.autoTagCurrentNote();
						});
				});
			})
		);
	}

	private async summarizeSelection(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice("No text selected");
			return;
		}

		new Notice("Summarizing...");

		try {
			const prompt = this.settings.summarization.prompt.replace("{{text}}", selection);
			let summary = await this.llmService.complete(prompt);

			// Strip any "Summary:" headers the LLM might have included
			summary = summary.replace(/\*{0,2}Summary:?\*{0,2}\s*/gi, "").trim();

			// Insert summary after selection
			const cursor = editor.getCursor("to");
			editor.replaceRange("\n\n**Summary:**\n" + summary, cursor);

			new Notice("Summary inserted");
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async customPrompt(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice("No text selected");
			return;
		}

		// Create a simple prompt modal
		const { CustomPromptModal } = await import("./ui/customPromptModal");
		new CustomPromptModal(this.app, this.settings.customPrompt.defaultPrompt, (userPrompt) => {
			if (!userPrompt) return;

			new Notice("Processing...");

			void (async () => {
				try {
					const fullPrompt = `${userPrompt}\n\nText:\n${selection}`;
					const result = await this.llmService.complete(fullPrompt);

					// Insert result after selection
					const cursor = editor.getCursor("to");
					editor.replaceRange("\n\n" + result, cursor);

					new Notice("Response inserted");
				} catch (error) {
					new Notice(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
				}
			})();
		}).open();
	}

	private async autoTagCurrentNote(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note");
			return;
		}

		new Notice("Generating tags...");

		try {
			// Get note content and strip frontmatter
			let content = await this.app.vault.read(activeFile);
			content = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

			// Get existing tags on this note
			const cache = this.app.metadataCache.getFileCache(activeFile);
			const existingNoteTags: string[] = cache?.frontmatter?.tags
				? Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags]
				: [];

			// Get existing vault tags if preference is set
			let existingVaultTags: string[] = [];
			if (this.settings.tagging.preferExistingTags) {
				existingVaultTags = this.tagService.getAllVaultTags();
			}

			// Build prompt
			let prompt = this.settings.tagging.prompt;
			prompt = prompt.replace("{{content}}", content);

			// Add note's existing tags to prompt so LLM avoids them
			if (existingNoteTags.length > 0) {
				prompt += `\n\nThis note already has these tags (do NOT suggest these): ${existingNoteTags.join(", ")}`;
			}

			if (existingVaultTags.length > 0) {
				prompt = prompt.replace("{{#if existingTags}}", "");
				prompt = prompt.replace("{{/if}}", "");
				prompt = prompt.replace("{{existingTags}}", existingVaultTags.slice(0, 50).join(", "));
			} else {
				// Remove the conditional block
				prompt = prompt.replace(/\{\{#if existingTags\}\}[\s\S]*?\{\{\/if\}\}/g, "");
			}

			// Get tags from LLM
			const response = await this.llmService.complete(prompt);

			// Parse JSON response
			let tags: string[];
			try {
				tags = JSON.parse(response.trim());
				if (!Array.isArray(tags)) {
					throw new Error("Response is not an array");
				}
			} catch {
				// Try to extract tags from response if not valid JSON
				const match = response.match(/\[[\s\S]*?\]/);
				if (match) {
					tags = JSON.parse(match[0]);
				} else {
					throw new Error("Could not parse tags from response");
				}
			}

			// Limit tags
			tags = tags.slice(0, this.settings.tagging.maxNewTags);

			// Normalize tags (remove # if present)
			tags = tags.map((tag) => (tag.startsWith("#") ? tag.slice(1) : tag));

			// Update frontmatter and track new tags
			let newTags: string[] = [];
			await this.app.fileManager.processFrontMatter(activeFile, (frontmatter) => {
				const existingFileTags: string[] = Array.isArray(frontmatter.tags)
					? frontmatter.tags
					: frontmatter.tags
						? [frontmatter.tags]
						: [];

				// Find which tags are actually new
				const existingSet = new Set(existingFileTags.map((t) => t.toLowerCase()));
				newTags = tags.filter((t) => !existingSet.has(t.toLowerCase()));

				if (newTags.length > 0) {
					frontmatter.tags = [...existingFileTags, ...newTags];
				}
			});

			if (newTags.length > 0) {
				new Notice(`Added ${newTags.length} new tag(s): ${newTags.join(", ")}`);
			} else {
				new Notice("No new tags to add (all suggested tags already exist)");
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}
}
