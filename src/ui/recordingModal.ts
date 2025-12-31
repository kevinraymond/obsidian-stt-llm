import { App, Modal } from "obsidian";

export class RecordingModal extends Modal {
	private transcriptEl: HTMLElement;
	private statusEl: HTMLElement;
	private indicatorEl: HTMLElement;
	private audioLevelEl: HTMLElement | null = null;
	private audioLevelBar: HTMLElement | null = null;
	private stopBtn: HTMLButtonElement;
	private onStop: () => void;
	private currentTranscript = "";

	constructor(app: App, onStop: () => void) {
		super(app);
		this.onStop = onStop;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("stt-recording-modal");

		// Status text
		this.statusEl = contentEl.createEl("div", {
			cls: "stt-status",
			text: "Connecting...",
		});

		// Recording indicator
		this.indicatorEl = contentEl.createEl("div", { cls: "stt-indicator" });
		this.indicatorEl.createEl("span", { cls: "stt-pulse" });
		this.indicatorEl.style.display = "none"; // Hidden until recording starts

		// Audio level meter
		this.audioLevelEl = contentEl.createEl("div", { cls: "stt-audio-level" });
		this.audioLevelBar = this.audioLevelEl.createEl("div", { cls: "stt-audio-level-bar" });
		this.audioLevelEl.style.display = "none";

		// Transcript display
		this.transcriptEl = contentEl.createEl("div", {
			cls: "stt-transcript",
			text: "Waiting for speech...",
		});

		// Stop button
		this.stopBtn = contentEl.createEl("button", {
			text: "Stop Recording",
			cls: "stt-stop-btn mod-cta",
		});
		this.stopBtn.addEventListener("click", () => {
			this.onStop();
		});

		// Also allow Escape to stop
		this.scope.register([], "Escape", () => {
			this.onStop();
			return false;
		});
	}

	/**
	 * Update the status display
	 */
	updateStatus(status: string): void {
		if (this.statusEl) {
			this.statusEl.setText(status);
		}

		// Show/hide recording indicator and audio level based on status
		const isRecording = status.toLowerCase().includes("recording");
		if (this.indicatorEl) {
			this.indicatorEl.style.display = isRecording ? "flex" : "none";
		}
		if (this.audioLevelEl) {
			this.audioLevelEl.style.display = isRecording ? "block" : "none";
		}
	}

	/**
	 * Update the audio level display (0-100) and optional silence countdown
	 */
	updateAudioLevel(level: number, silenceCountdown?: number): void {
		if (this.audioLevelBar) {
			this.audioLevelBar.style.width = `${Math.min(100, level)}%`;
		}

		// Update status with countdown if in silence
		if (this.statusEl) {
			if (silenceCountdown !== undefined && silenceCountdown > 0) {
				this.statusEl.setText(`Recording... (auto-stop in ${silenceCountdown.toFixed(1)}s)`);
			} else if (this.statusEl.getText().includes("auto-stop")) {
				this.statusEl.setText("Recording... Speak now");
			}
		}
	}

	/**
	 * Update the transcript display
	 */
	updateTranscript(text: string, isFinal: boolean): void {
		this.currentTranscript = text;

		if (this.transcriptEl) {
			if (text) {
				this.transcriptEl.setText(text);
				this.transcriptEl.removeClass("stt-final");

				if (isFinal) {
					this.transcriptEl.addClass("stt-final");
				}
			} else {
				this.transcriptEl.setText("Waiting for speech...");
			}
		}
	}

	/**
	 * Get the current transcript
	 */
	getTranscript(): string {
		return this.currentTranscript;
	}

	/**
	 * Show error state
	 */
	showError(message: string): void {
		this.updateStatus(`Error: ${message}`);
		if (this.indicatorEl) {
			this.indicatorEl.style.display = "none";
		}
		if (this.stopBtn) {
			this.stopBtn.setText("Close");
		}
	}

	/**
	 * Show processing state
	 */
	showProcessing(): void {
		this.updateStatus("Processing final transcript...");
		if (this.indicatorEl) {
			this.indicatorEl.style.display = "none";
		}
		if (this.stopBtn) {
			this.stopBtn.disabled = true;
			this.stopBtn.setText("Processing...");
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
