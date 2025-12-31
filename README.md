# STT & LLM

Local speech-to-text transcription and LLM-powered text operations for Obsidian.

## Features

- **Speech-to-Text Recording**: Transcribe voice to text directly into your notes using a local Whisper-based server
- **Summarize Selection**: Generate summaries of selected text using your local LLM
- **Auto-Tag Notes**: Automatically generate relevant tags for your notes
- **Custom Prompts**: Send selected text to your LLM with custom instructions

All processing happens locally on your machine—no cloud services required.

## Requirements

### STT Server (Required for voice transcription)

This plugin requires a companion server for speech-to-text functionality:

**[stt-server](https://github.com/kevinraymond/stt-server)** - A local WebSocket server using OpenAI's Whisper model.

#### Quick Setup with Docker (Recommended)

The easiest way to run the STT server:

```bash
# CPU version
docker run -p 8765:8765 ghcr.io/kevinraymond/stt-server:cpu

# GPU version (NVIDIA)
docker run --gpus all -p 8765:8765 ghcr.io/kevinraymond/stt-server:gpu
```

The server will be available at `ws://localhost:8765`.

#### Manual Setup

If you prefer not to use Docker:

Prerequisites: Python 3.10+, [uv](https://docs.astral.sh/uv/), ffmpeg

```bash
git clone https://github.com/kevinraymond/stt-server.git
cd stt-server
uv sync
uv run obsidian-stt-server --auto
```

See the [stt-server repository](https://github.com/kevinraymond/stt-server) for advanced configuration.

### LLM API (Optional, for text operations)

For summarization, auto-tagging, and custom prompts, you need a local LLM server:

- **[Ollama](https://ollama.ai/)** (recommended) - Default endpoint: `http://localhost:11434`
- Any OpenAI-compatible API

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "STT & LLM"
4. Install and enable the plugin

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/kevinraymond/obsidian-stt-llm/releases)
2. Create a folder `obsidian-stt-llm` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

## Configuration

Open Settings → STT & LLM to configure:

### Speech-to-Text
- **Server URL**: WebSocket URL for the STT server (default: `ws://localhost:8765`)

### LLM Settings
- **API URL**: Your LLM server endpoint (default: `http://localhost:11434` for Ollama)
- **Model**: The model to use (e.g., `llama3.2`, `mistral`)
- **Summarization Prompt**: Template for summarization requests
- **Tagging Prompt**: Template for auto-tag generation
- **Custom Prompt Default**: Default prompt for custom operations

## Usage

### Voice Recording

1. Click the microphone icon in the ribbon, or use the command "Toggle STT recording"
2. Speak into your microphone
3. Click again to stop—the transcription will be inserted at your cursor

### LLM Operations

Once LLM is configured, additional controls appear:

- **Summarize**: Select text → right-click → "Summarize Selection" (or use command palette)
- **Auto-Tag**: Open a note → right-click → "Generate Tags for Note"
- **Custom Prompt**: Select text → right-click → "Send with Custom Prompt"

## Commands

| Command | Description |
|---------|-------------|
| Toggle STT recording | Start/stop voice recording |
| Summarize selection | Summarize the selected text |
| Generate tags for current note | Auto-generate tags based on note content |
| Send selection with custom prompt | Process selection with a custom instruction |

## Network Usage Disclosure

This plugin makes local network connections only:

- **STT Server**: WebSocket connection to `ws://localhost:8765` (configurable) for speech-to-text transcription
- **LLM API**: HTTP requests to `http://localhost:11434` (configurable) for text operations

No data is sent to external cloud services. All processing occurs on your local machine.

## License

[MIT](LICENSE)

## Support

If you find this plugin useful, consider [sponsoring the development](https://github.com/sponsors/kevinraymond).
