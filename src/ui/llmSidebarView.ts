import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type SttLlmPlugin from "../main";

export const LLM_VIEW_TYPE = "stt-llm-sidebar";

interface OperationHistoryItem {
	type: "summarize" | "custom-prompt" | "auto-tag" | "stt";
	timestamp: Date;
	success: boolean;
}

export class LlmSidebarView extends ItemView {
	private plugin: SttLlmPlugin;
	private historyContainerEl: HTMLElement;
	private operationHistory: OperationHistoryItem[] = [];

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

		// Recent Operations Section
		const historySection = container.createEl("div", { cls: "stt-llm-sidebar-section" });
		historySection.createEl("h4", { text: "Recent Operations" });
		this.historyContainerEl = historySection.createEl("div", { cls: "stt-llm-history" });
		this.renderHistory();

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
		const commandId = `stt-llm:${actionId}`;
		let success = false;

		try {
			(this.app as any).commands.executeCommandById(commandId);
			success = true;
		} catch (error) {
			success = false;
		}

		// Add to history (except STT which has its own UI)
		if (actionId !== "toggle-recording") {
			this.addToHistory({
				type: actionId as OperationHistoryItem["type"],
				timestamp: new Date(),
				success,
			});
		}
	}

	addToHistory(item: OperationHistoryItem): void {
		this.operationHistory.unshift(item);
		if (this.operationHistory.length > 10) {
			this.operationHistory.pop();
		}
		this.renderHistory();
	}

	private renderHistory(): void {
		if (!this.historyContainerEl) return;
		this.historyContainerEl.empty();

		if (this.operationHistory.length === 0) {
			this.historyContainerEl.createEl("div", {
				text: "No recent operations",
				cls: "stt-llm-history-empty",
			});
			return;
		}

		for (const item of this.operationHistory) {
			const historyItem = this.historyContainerEl.createEl("div", {
				cls: `stt-llm-history-item ${item.success ? "success" : "error"}`,
			});

			const iconSpan = historyItem.createSpan({ cls: "stt-llm-history-icon" });
			const iconName =
				item.type === "summarize"
					? "file-text"
					: item.type === "custom-prompt"
						? "message-square"
						: "tags";
			setIcon(iconSpan, iconName);

			const content = historyItem.createEl("div", { cls: "stt-llm-history-content" });
			content.createEl("span", {
				text: this.getActionLabel(item.type),
				cls: "stt-llm-history-label",
			});
			content.createEl("span", {
				text: this.formatTime(item.timestamp),
				cls: "stt-llm-history-time",
			});
		}
	}

	private getActionLabel(type: string): string {
		switch (type) {
			case "summarize":
				return "Summarize";
			case "custom-prompt":
				return "Custom Prompt";
			case "auto-tag":
				return "Generate Tags";
			default:
				return type;
		}
	}

	private formatTime(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) return "Just now";
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return date.toLocaleDateString();
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}
}
