import { App, Notice, Editor, MarkdownView } from "obsidian";
import { SttService } from "../services/sttService";
import { LlmService } from "../services/llmService";
import { RecordingModal } from "../ui/recordingModal";
import type { SttLlmSettings } from "../settings";

type RecordingState = "idle" | "connecting" | "recording" | "processing";

export class RecordingManager {
	private app: App;
	private sttService: SttService;
	private llmService: LlmService;
	private getSettings: () => SttLlmSettings;
	private state: RecordingState = "idle";
	private modal: RecordingModal | null = null;
	private mediaRecorder: MediaRecorder | null = null;
	private mediaStream: MediaStream | null = null;
	private audioChunks: Blob[] = [];
	private finalTranscript = "";
	private ribbonIcon: HTMLElement | null = null;

	// VAD (Voice Activity Detection)
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private vadInterval: ReturnType<typeof setInterval> | null = null;
	private silenceStart: number | null = null;

	constructor(
		app: App,
		sttService: SttService,
		llmService: LlmService,
		getSettings: () => SttLlmSettings
	) {
		this.app = app;
		this.sttService = sttService;
		this.llmService = llmService;
		this.getSettings = getSettings;

		this.setupSttCallbacks();
	}

	setRibbonIcon(icon: HTMLElement): void {
		this.ribbonIcon = icon;
	}

	isRecording(): boolean {
		return this.state === "recording";
	}

	private setupSttCallbacks(): void {
		this.sttService.on("status", ({ status, error }) => {
			if (status === "recording") {
				this.state = "recording";
				this.modal?.updateStatus("Recording... Speak now");
				this.updateRibbonState(true);
				this.startVAD();
			} else if (status === "processing") {
				this.state = "processing";
				this.modal?.showProcessing();
			} else if (status === "ready") {
				if (this.state === "processing") {
					this.handleRecordingComplete();
				}
			} else if (status === "error") {
				console.error("STT error:", error);
				this.modal?.showError(error || "Unknown error");
				this.cleanup();
			}
		});

		this.sttService.on("transcript", ({ text, isFinal }) => {
			this.modal?.updateTranscript(text, isFinal);
			if (isFinal) {
				this.finalTranscript = text;
			}
		});

		this.sttService.on("disconnected", () => {
			if (this.state !== "idle") {
				new Notice("STT server disconnected");
				this.cleanup();
			}
		});
	}

	async toggleRecording(): Promise<void> {
		if (this.state === "idle") {
			await this.startRecording();
		} else if (this.state === "recording") {
			await this.stopRecording();
		}
	}

	async startRecording(): Promise<void> {
		if (this.state !== "idle") {
			return;
		}

		const settings = this.getSettings();
		this.sttService.setUrl(settings.stt.serverUrl);

		this.modal = new RecordingModal(this.app, () => this.stopRecording());
		this.modal.open();
		this.modal.updateStatus("Connecting to STT server...");

		this.state = "connecting";

		try {
			await this.sttService.connect();
			await this.startAudioCapture();
			this.sttService.startRecording(settings.stt.language);
			this.finalTranscript = "";
		} catch (error) {
			console.error("Error starting recording:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			this.modal?.showError(message);
			new Notice(`Failed to start recording: ${message}`);
			this.cleanup();
		}
	}

	async stopRecording(): Promise<void> {
		if (this.state !== "recording") {
			if (this.state === "connecting" || this.state === "processing") {
				this.cleanup();
			}
			return;
		}

		this.state = "processing";
		this.modal?.showProcessing();
		this.stopVAD();

		try {
			await this.stopAudioCapture();
			this.sttService.stopRecording();
		} catch (error) {
			console.error("Error stopping recording:", error);
			this.cleanup();
		}
	}

	private startVAD(): void {
		const settings = this.getSettings();
		if (!settings.vad.enabled || !this.mediaStream) {
			return;
		}

		try {
			this.audioContext = new AudioContext();
			const source = this.audioContext.createMediaStreamSource(this.mediaStream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;
			source.connect(this.analyser);

			const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			this.silenceStart = null;

			this.vadInterval = setInterval(() => {
				if (!this.analyser || this.state !== "recording") {
					return;
				}

				this.analyser.getByteFrequencyData(dataArray);

				// Calculate average audio level (0-255 -> 0-100)
				const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
				const level = (average / 255) * 100;

				const threshold = settings.vad.silenceThreshold;
				const silenceDurationMs = settings.vad.silenceDuration * 1000;

				let countdown: number | undefined;

				if (level < threshold) {
					// Silence detected
					if (this.silenceStart === null) {
						this.silenceStart = Date.now();
					}
					const elapsed = Date.now() - this.silenceStart;
					const remaining = (silenceDurationMs - elapsed) / 1000;
					countdown = Math.max(0, remaining);

					if (elapsed > silenceDurationMs) {
						// Silence threshold exceeded - auto stop
						this.stopRecording();
						return;
					}
				} else {
					// Voice detected - reset silence timer
					this.silenceStart = null;
				}

				// Update modal with audio level and countdown
				this.modal?.updateAudioLevel?.(level, countdown);
			}, 100); // Check every 100ms
		} catch (error) {
			console.error("Error starting VAD:", error);
		}
	}

	private stopVAD(): void {
		if (this.vadInterval) {
			clearInterval(this.vadInterval);
			this.vadInterval = null;
		}
		if (this.audioContext) {
			this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}
		this.analyser = null;
		this.silenceStart = null;
	}

	private async handleRecordingComplete(): Promise<void> {
		const originalText = this.finalTranscript || this.modal?.getTranscript() || "";

		if (!originalText.trim()) {
			new Notice("No speech detected");
			this.cleanup();
			return;
		}

		const settings = this.getSettings();
		if (settings.correction.enabled) {
			try {
				this.modal?.updateStatus("Applying LLM correction...");
				const correctedText = await this.llmService.correctTranscription(
					originalText,
					settings.correction.prompt
				);

				// Insert both original and corrected with a note
				const combined = `${correctedText}

> [!info] LLM Correction Applied
> **Original transcript:**
> ${originalText.split("\n").join("\n> ")}`;

				this.insertAtCursor(combined);
			} catch (error) {
				console.error("LLM correction failed:", error);
				// Fall back to original text on error
				this.insertAtCursor(originalText);
			}
		} else {
			this.insertAtCursor(originalText);
		}

		this.cleanup();
	}

	private insertAtCursor(text: string): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (activeView?.editor) {
			const editor: Editor = activeView.editor;
			const cursor = editor.getCursor();
			editor.replaceRange(text, cursor);

			const lines = text.split("\n");
			const lastLineLength = lines[lines.length - 1].length;
			editor.setCursor({
				line: cursor.line + lines.length - 1,
				ch: lines.length === 1 ? cursor.ch + lastLineLength : lastLineLength,
			});

			new Notice("Transcription inserted");
		} else {
			navigator.clipboard.writeText(text);
			new Notice("No active editor. Transcription copied to clipboard.");
		}
	}

	private async startAudioCapture(): Promise<void> {
		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 16000,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});

			const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: "audio/webm";

			this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

			this.audioChunks = [];
			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.audioChunks.push(event.data);
				}
			};

			this.mediaRecorder.start(100);
		} catch (error) {
			console.error("Error starting audio capture:", error);
			throw new Error("Failed to access microphone. Please check permissions.");
		}
	}

	private async stopAudioCapture(): Promise<void> {
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
			await new Promise<void>((resolve) => {
				this.mediaRecorder!.onstop = () => resolve();
				this.mediaRecorder!.stop();
			});
		}

		if (this.audioChunks.length > 0) {
			const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
			const completeBlob = new Blob(this.audioChunks, { type: mimeType });
			const buffer = await completeBlob.arrayBuffer();
			this.sttService.sendAudioChunk(buffer);
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
		}

		this.mediaRecorder = null;
		this.mediaStream = null;
		this.audioChunks = [];
	}

	private updateRibbonState(isRecording: boolean): void {
		if (this.ribbonIcon) {
			if (isRecording) {
				this.ribbonIcon.addClass("stt-recording");
				this.ribbonIcon.setAttribute("aria-label", "Stop Recording");
			} else {
				this.ribbonIcon.removeClass("stt-recording");
				this.ribbonIcon.setAttribute("aria-label", "Start STT Recording");
			}
		}
	}

	private cleanup(): void {
		this.stopVAD();
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
			this.mediaRecorder.stop();
		}
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
		}
		this.mediaRecorder = null;
		this.mediaStream = null;
		this.audioChunks = [];
		this.modal?.close();
		this.modal = null;
		this.state = "idle";
		this.finalTranscript = "";
		this.updateRibbonState(false);
	}

	destroy(): void {
		this.cleanup();
		this.sttService.disconnect();
	}
}
