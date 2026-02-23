import Foundation

struct Message: Identifiable, Codable, Sendable {
    let id: UUID
    let role: Role
    var content: String

    enum Role: String, Codable, Sendable {
        case user
        case assistant
        case system
    }

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
    }
}
