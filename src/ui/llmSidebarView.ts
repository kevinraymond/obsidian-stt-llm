import { ItemView, MarkdownView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type SttLlmPlugin from "../main";

export const LLM_VIEW_TYPE = "stt-llm-sidebar";

export class LlmSidebarView extends ItemView {
	private plugin: SttLlmPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: SttLlmPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return LLM_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "LLM Assistant";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("stt-llm-sidebar");

		// Header
		const header = container.createEl("div", { cls: "stt-llm-sidebar-header" });
		header.createEl("h3", { text: "LLM Assistant" });

		// Quick Actions Section
		const actionsSection = container.createEl("div", { cls: "stt-llm-sidebar-section" });
		actionsSection.createEl("h4", { text: "Quick Actions" });
		const actionsContainer = actionsSection.createEl("div", { cls: "stt-llm-actions" });
		this.renderActionButtons(actionsContainer);

		// Divider
		container.createEl("hr", { cls: "stt-llm-divider" });

		// Settings Section
		const settingsSection = container.createEl("div", { cls: "stt-llm-sidebar-section" });
		settingsSection.createEl("h4", { text: "Settings" });

		const settingsLink = settingsSection.createEl("button", {
			cls: "stt-llm-settings-link",
		});
		const iconSpan = settingsLink.createSpan({ cls: "stt-llm-btn-icon" });
		setIcon(iconSpan, "settings");
		settingsLink.createSpan({ text: "Open LLM Settings" });

		settingsLink.addEventListener("click", () => {
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById(this.plugin.manifest.id);
		});

		// Model info display
		const modelInfo = settingsSection.createEl("div", { cls: "stt-llm-model-info" });
		modelInfo.createEl("span", {
			text: `Model: ${this.plugin.settings.llm.model}`,
			cls: "stt-llm-model-label",
		});
	}

	private renderActionButtons(container: HTMLElement): void {
		const actions = [
			{
				id: "summarize",
				label: "Summarize Selection",
				icon: "file-text",
				description: "Summarize selected text",
			},
			{
				id: "custom-prompt",
				label: "Custom Prompt",
				icon: "message-square",
				description: "Send selection with custom prompt",
			},
			{
				id: "auto-tag",
				label: "Generate Tags",
				icon: "tags",
				description: "Auto-generate tags for note",
			},
			{
				id: "toggle-recording",
				label: "Voice Input",
				icon: "mic",
				description: "Start speech-to-text",
			},
		];

		for (const action of actions) {
			const btn = container.createEl("button", {
				cls: "stt-llm-action-btn",
				attr: { "data-action": action.id },
			});

			const iconSpan = btn.createSpan({ cls: "stt-llm-action-icon" });
			setIcon(iconSpan, action.icon);

			const textContainer = btn.createEl("div", { cls: "stt-llm-action-text" });
			textContainer.createEl("span", { text: action.label, cls: "stt-llm-action-label" });
			textContainer.createEl("span", { text: action.description, cls: "stt-llm-action-desc" });

			btn.addEventListener("click", async () => {
				await this.executeAction(action.id);
			});
		}
	}

	private async executeAction(actionId: string): Promise<void> {
		// Editor-dependent actions need special handling
		if (actionId === "summarize" || actionId === "custom-prompt") {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.editor) {
				new Notice("No active editor");
				return;
			}
		}

		const commandId = `stt-llm:${actionId}`;
		(this.app as any).commands.executeCommandById(commandId);
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}
}
