/**
 * WebSocket client for STT server communication.
 */

type SttStatus = "disconnected" | "connecting" | "ready" | "recording" | "processing" | "error";

interface TranscriptEvent {
	text: string;
	isFinal: boolean;
}

interface StatusEvent {
	status: SttStatus;
	error?: string;
}

type SttEventCallback = {
	transcript: (event: TranscriptEvent) => void;
	status: (event: StatusEvent) => void;
	connected: () => void;
	disconnected: () => void;
};

export class SttService {
	private ws: WebSocket | null = null;
	private url: string;
	private listeners: Partial<SttEventCallback> = {};
	private _status: SttStatus = "disconnected";
	private connectionId = 0;

	constructor(url: string) {
		this.url = url;
	}

	get status(): SttStatus {
		return this._status;
	}

	get isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	get isRecording(): boolean {
		return this._status === "recording";
	}

	setUrl(url: string): void {
		this.url = url;
	}

	on<K extends keyof SttEventCallback>(event: K, callback: SttEventCallback[K]): void {
		this.listeners[event] = callback;
	}

	off<K extends keyof SttEventCallback>(event: K): void {
		delete this.listeners[event];
	}

	private emit<K extends keyof SttEventCallback>(
		event: K,
		...args: Parameters<SttEventCallback[K]>
	): void {
		const callback = this.listeners[event];
		if (callback) {
			(callback as (...args: Parameters<SttEventCallback[K]>) => void)(...args);
		}
	}

	private setStatus(status: SttStatus, error?: string): void {
		this._status = status;
		this.emit("status", { status, error });
	}

	async connect(): Promise<void> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return;
		}

		if (this.ws) {
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.onopen = null;
			try {
				this.ws.close();
			} catch (e) {
				// Ignore close errors
			}
			this.ws = null;
		}

		this.setStatus("connecting");
		this.connectionId++;
		const thisConnectionId = this.connectionId;

		return new Promise((resolve, reject) => {
			let resolved = false;
			let timeoutId: ReturnType<typeof setTimeout> | null = null;

			const cleanup = () => {
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
			};

			try {
				const ws = new WebSocket(this.url);

				timeoutId = setTimeout(() => {
					if (!resolved && thisConnectionId === this.connectionId) {
						resolved = true;
						ws.close();
						if (this.ws === ws) this.ws = null;
						reject(new Error("Connection timeout"));
					}
				}, 10000);

				ws.onopen = () => {
					if (thisConnectionId !== this.connectionId) {
						ws.close();
						return;
					}
					if (!resolved) {
						resolved = true;
						cleanup();
						this.ws = ws;
						this.emit("connected");
						resolve();
					}
				};

				ws.onclose = (event) => {
					cleanup();
					if (thisConnectionId !== this.connectionId) {
						return;
					}
					if (this.ws === ws) this.ws = null;
					this.setStatus("disconnected");
					this.emit("disconnected");

					if (!resolved) {
						resolved = true;
						reject(new Error("Connection closed"));
					}
				};

				ws.onerror = (error) => {
					cleanup();
					if (thisConnectionId !== this.connectionId) {
						return;
					}
					console.error("STT WebSocket error:", error);
					if (!resolved) {
						resolved = true;
						this.setStatus("error", "Connection error");
						reject(new Error("WebSocket connection failed"));
					}
				};

				ws.onmessage = (event) => {
					if (thisConnectionId !== this.connectionId) {
						return;
					}
					this.handleMessage(event.data);
				};
			} catch (error) {
				cleanup();
				this.setStatus("error", "Failed to create WebSocket");
				reject(error);
			}
		});
	}

	disconnect(): void {
		this.connectionId++;
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.onopen = null;
			try {
				this.ws.close(1000, "Client disconnect");
			} catch (e) {
				// Ignore
			}
			this.ws = null;
		}
		this.setStatus("disconnected");
	}

	startRecording(language?: string): void {
		if (!this.isConnected) {
			throw new Error("Not connected to STT server");
		}

		const message: { type: "start"; language?: string } = { type: "start" };
		if (language) {
			message.language = language;
		}

		this.ws?.send(JSON.stringify(message));
	}

	stopRecording(): void {
		if (!this.isConnected) {
			throw new Error("Not connected to STT server");
		}

		this.ws?.send(JSON.stringify({ type: "stop" }));
	}

	sendAudioChunk(audioData: ArrayBuffer): void {
		if (!this.isConnected || this._status !== "recording") {
			return;
		}

		const base64 = this.arrayBufferToBase64(audioData);

		this.ws?.send(
			JSON.stringify({
				type: "audio",
				data: base64,
			})
		);
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	private handleMessage(data: string): void {
		try {
			const message = JSON.parse(data);

			switch (message.type) {
				case "status":
					this.setStatus(message.status, message.error);
					break;

				case "transcript":
					this.emit("transcript", {
						text: message.text,
						isFinal: message.isFinal,
					});
					break;

				default:
					console.warn("Unknown STT message type:", message.type);
			}
		} catch (error) {
			console.error("Error parsing STT message:", error);
		}
	}
}
