import Foundation

actor OllamaService {
    private let baseURL = URL(string: "http://localhost:11434")!

    func chat(messages: [Message], model: String) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let request = try self.buildRequest(messages: messages, model: model)
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse,
                          httpResponse.statusCode == 200 else {
                        throw OllamaError.invalidResponse
                    }

                    for try await line in bytes.lines {
                        guard !line.isEmpty else { continue }
                        guard let data = line.data(using: .utf8) else { continue }
                        let streamResponse = try JSONDecoder().decode(OllamaStreamResponse.self, from: data)
                        continuation.yield(streamResponse.message.content)
                        if streamResponse.done {
                            continuation.finish()
                            return
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func buildRequest(messages: [Message], model: String) throws -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let ollamaMessages = messages.map { OllamaMessage(role: $0.role.rawValue, content: $0.content) }
        let body = OllamaRequest(model: model, messages: ollamaMessages, stream: true)
        request.httpBody = try JSONEncoder().encode(body)
        return request
    }
}

enum OllamaError: LocalizedError {
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from Ollama server. Ensure Ollama is running at http://localhost:11434."
        }
    }
}
