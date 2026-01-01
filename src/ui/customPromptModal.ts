import { App, Modal } from "obsidian";

export class CustomPromptModal extends Modal {
	private prompt: string;
	private onSubmit: (prompt: string | null) => void;

	constructor(app: App, defaultPrompt: string, onSubmit: (prompt: string | null) => void) {
		super(app);
		this.prompt = defaultPrompt;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("stt-prompt-modal");

		contentEl.createEl("h2", { text: "Custom prompt" });

		contentEl.createEl("p", {
			text: "Enter your prompt. The selected text will be appended.",
			cls: "setting-item-description",
		});

		const textArea = contentEl.createEl("textarea");
		textArea.value = this.prompt;
		textArea.placeholder = "Enter your prompt here...";
		textArea.rows = 6;

		textArea.addEventListener("input", (e) => {
			this.prompt = (e.target as HTMLTextAreaElement).value;
		});

		// Focus the textarea
		setTimeout(() => textArea.focus(), 10);

		// Button container
		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

		// Cancel button
		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.onSubmit(null);
			this.close();
		});

		// Submit button
		const submitBtn = buttonContainer.createEl("button", {
			text: "Send",
			cls: "mod-cta",
		});
		submitBtn.addEventListener("click", () => {
			this.onSubmit(this.prompt);
			this.close();
		});

		// Handle Enter key (Ctrl/Cmd + Enter to submit)
		textArea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.onSubmit(this.prompt);
				this.close();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				this.onSubmit(null);
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
