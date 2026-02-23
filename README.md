# Quilliam

A native macOS chat application built with SwiftUI that serves as a frontend for a locally running [Ollama](https://ollama.com) instance.

## Requirements

- macOS 14 (Sonoma) or later
- [Xcode 16](https://developer.apple.com/xcode/) or later (Swift 6)
- [Ollama](https://ollama.com) running locally on port `11434`

## Getting Started

### 1. Install and start Ollama

```bash
# Install via Homebrew
brew install ollama

# Pull the default model
ollama pull gemma3:4b

# Start the Ollama server (if not already running)
ollama serve
```

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

### 2. Open and run Quilliam

1. Open `Quilliam.xcodeproj` in Xcode.
2. Select the **Quilliam** scheme and your Mac as the run destination.
3. Press **⌘R** to build and run.

> **Note:** The app uses App Sandbox with the *Outgoing Connections (Client)* entitlement enabled, so it can communicate with `http://localhost:11434`.

## Architecture

| Layer | File(s) |
|---|---|
| **Models** | `Quilliam/Models/Message.swift`, `OllamaModels.swift` |
| **Network** | `Quilliam/Services/OllamaService.swift` |
| **ViewModel** | `Quilliam/ViewModels/ChatViewModel.swift` |
| **Views** | `Quilliam/Views/` |

### Key design decisions

- **Swift 6 strict concurrency** – `OllamaService` is an `actor`; `ChatViewModel` is `@Observable @MainActor`.
- **Streaming** – `OllamaService.chat(messages:model:)` returns an `AsyncThrowingStream<String, Error>` that yields tokens as they arrive from Ollama's `/api/chat` endpoint.
- **MVVM** – `ChatViewModel` owns the message list and drives all UI state; views are purely declarative.

## Models

The model picker in the input bar defaults to `gemma3:4b`. Other bundled options include `llama3.2`, `mistral`, and `phi4`. Pull any model first with `ollama pull <model>` before selecting it in the app.
