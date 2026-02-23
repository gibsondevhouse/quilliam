import Foundation
import Observation

@Observable
@MainActor
final class ChatViewModel {
    var messages: [Message] = []
    var inputText: String = ""
    var selectedModel: String = "gemma3:4b"
    var isLoading: Bool = false
    var errorMessage: String?

    let availableModels = ["gemma3:4b", "llama3.2", "mistral", "phi4"]

    private let service = OllamaService()

    func sendMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }

        inputText = ""
        isLoading = true
        errorMessage = nil

        let userMessage = Message(role: .user, content: text)
        messages.append(userMessage)

        let assistantMessage = Message(role: .assistant, content: "")
        messages.append(assistantMessage)
        let assistantIndex = messages.count - 1

        do {
            let history = Array(messages.dropLast())
            let stream = await service.chat(messages: history, model: selectedModel)
            for try await token in stream {
                guard assistantIndex < messages.count else { break }
                messages[assistantIndex].content += token
            }
        } catch {
            if assistantIndex < messages.count {
                messages[assistantIndex].content = "Error: \(error.localizedDescription)"
            }
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func clearHistory() {
        messages = []
        errorMessage = nil
        isLoading = false
    }
}
