import Foundation

struct OllamaRequest: Encodable, Sendable {
    let model: String
    let messages: [OllamaMessage]
    let stream: Bool
}

struct OllamaMessage: Codable, Sendable {
    let role: String
    let content: String
}

struct OllamaStreamResponse: Decodable, Sendable {
    let model: String
    let createdAt: String
    let message: OllamaMessage
    let done: Bool

    enum CodingKeys: String, CodingKey {
        case model
        case createdAt = "created_at"
        case message
        case done
    }
}
