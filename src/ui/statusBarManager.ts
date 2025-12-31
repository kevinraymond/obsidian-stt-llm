import { Plugin, setIcon } from "obsidian";

export interface StatusBarButton {
	icon: string;
	tooltip: string;
	onClick: () => void;
}

export class StatusBarManager {
	private plugin: Plugin;
	private containerEl: HTMLElement;
	private buttons: Map<string, HTMLElement> = new Map();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.containerEl = plugin.addStatusBarItem();
		this.containerEl.addClass("stt-llm-status-bar-container");
	}

	addButton(id: string, config: StatusBarButton): HTMLElement {
		const button = this.containerEl.createEl("span", {
			cls: "stt-llm-status-btn",
			attr: { "aria-label": config.tooltip, "data-tooltip-position": "top" },
		});

		setIcon(button, config.icon);

		button.addEventListener("click", (e) => {
			e.preventDefault();
			config.onClick();
		});

		this.buttons.set(id, button);
		return button;
	}

	setButtonLoading(id: string, isLoading: boolean): void {
		const button = this.buttons.get(id);
		if (button) {
			if (isLoading) {
				button.addClass("stt-llm-loading");
			} else {
				button.removeClass("stt-llm-loading");
			}
		}
	}

	hasButton(id: string): boolean {
		return this.buttons.has(id);
	}

	removeButton(id: string): void {
		const button = this.buttons.get(id);
		if (button) {
			button.remove();
			this.buttons.delete(id);
		}
	}
}
