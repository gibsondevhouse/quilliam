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

// MARK: - 3-tier execution model

enum AIExecutionMode: String, CaseIterable, Codable, Sendable {
    case local = "local"
    case assistedCloud = "assisted_cloud"
    case deepResearch = "deep_research"

    var displayName: String {
        switch self {
        case .local: return "Local"
        case .assistedCloud: return "Assisted Cloud"
        case .deepResearch: return "Deep Research"
        }
    }
}

struct CloudProviderConfig: Codable, Sendable {
    var anthropicModel: String = "claude-3-5-sonnet-latest"
    var tavilyEnabled: Bool = true
}

struct RunBudget: Codable, Sendable {
    var maxUsd: Double = 5
    var maxInputTokens: Int = 200_000
    var maxOutputTokens: Int = 40_000
    var maxMinutes: Int = 45
    var maxSources: Int = 12
}

struct UsageMeter: Codable, Sendable {
    var spentUsd: Double = 0
    var inputTokens: Int = 0
    var outputTokens: Int = 0
    var sourcesFetched: Int = 0
    var elapsedMs: Int = 0
}

struct Citation: Codable, Sendable {
    var url: String
    var title: String
    var publishedAt: String?
    var quote: String
    var claimRef: String
}

enum PatchTargetKind: String, Codable, Sendable {
    case active
    case chapter
    case character
    case location
    case world
}

enum CloudLineEdit: Codable, Sendable {
    case replace(start: Int, end: Int, newLines: [String])
    case insert(afterIndex: Int, newLines: [String])
    case delete(start: Int, end: Int)

    enum CodingKeys: String, CodingKey {
        case type
        case start
        case end
        case newLines
        case afterIndex
    }

    enum EditType: String, Codable {
        case replace
        case insert
        case delete
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(EditType.self, forKey: .type)
        switch type {
        case .replace:
            let start = try container.decode(Int.self, forKey: .start)
            let end = try container.decode(Int.self, forKey: .end)
            let newLines = try container.decode([String].self, forKey: .newLines)
            self = .replace(start: start, end: end, newLines: newLines)
        case .insert:
            let afterIndex = try container.decode(Int.self, forKey: .afterIndex)
            let newLines = try container.decode([String].self, forKey: .newLines)
            self = .insert(afterIndex: afterIndex, newLines: newLines)
        case .delete:
            let start = try container.decode(Int.self, forKey: .start)
            let end = try container.decode(Int.self, forKey: .end)
            self = .delete(start: start, end: end)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .replace(let start, let end, let newLines):
            try container.encode(EditType.replace, forKey: .type)
            try container.encode(start, forKey: .start)
            try container.encode(end, forKey: .end)
            try container.encode(newLines, forKey: .newLines)
        case .insert(let afterIndex, let newLines):
            try container.encode(EditType.insert, forKey: .type)
            try container.encode(afterIndex, forKey: .afterIndex)
            try container.encode(newLines, forKey: .newLines)
        case .delete(let start, let end):
            try container.encode(EditType.delete, forKey: .type)
            try container.encode(start, forKey: .start)
            try container.encode(end, forKey: .end)
        }
    }

    func toLineEdit() -> LineEdit {
        switch self {
        case .replace(let start, let end, let newLines):
            return .replace(range: start ..< end, with: newLines)
        case .insert(let afterIndex, let newLines):
            return .insert(index: afterIndex, lines: newLines)
        case .delete(let start, let end):
            return .delete(range: start ..< end)
        }
    }
}

struct ProposedPatchBatch: Codable, Sendable {
    var id: String
    var targetId: String
    var targetKind: PatchTargetKind
    var targetKey: String?
    var edits: [CloudLineEdit]
    var rationale: String
    var citations: [Citation]?
}

enum ResearchRunStatus: String, Codable, Sendable {
    case queued
    case running
    case completed
    case cancelled
    case failed
    case budgetExceeded = "budget_exceeded"
}

enum ResearchRunPhase: String, Codable, Sendable {
    case plan
    case query
    case fetch
    case extract
    case synthesize
    case propose
}

struct ResearchArtifact: Codable, Identifiable, Sendable {
    var id: String
    var runId: String
    var kind: String
    var content: String
    var citations: [Citation]?
    var createdAt: Int
}

struct ResearchRunRecord: Codable, Identifiable, Sendable {
    var id: String
    var query: String
    var status: ResearchRunStatus
    var phase: ResearchRunPhase
    var budget: RunBudget
    var usage: UsageMeter
    var artifacts: [ResearchArtifact]
    var error: String?
    var createdAt: Int
    var updatedAt: Int
}

struct CloudAssistResponse: Codable, Sendable {
    var message: String
    var patches: [ProposedPatchBatch]
    /// Canonical entity/relationship patches extracted by the cloud model.
    /// `autoCommit: true` when `confidence >= 0.85`.
    var canonicalPatches: [CanonicalPatch]?
    var usage: UsageMeter?
}
