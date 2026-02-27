import Foundation
import Security

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

    // MARK: - Canonical extraction

    private let extractionSystemPrompt = """
    You are a canonical entity extractor for a narrative writing tool.
    Given a passage of prose or research notes, identify all narrative entities and relationships.
    Respond ONLY with a valid JSON object — no markdown, no explanation.

    JSON format:
    {
      "entities": [
        { "type": "<CanonicalType>", "name": "<name>", "summary": "<one sentence>" }
      ],
      "relationships": [
        { "from": "<name>", "relType": "<edge label>", "to": "<name>" }
      ]
    }

    Valid CanonicalType values: character, location, faction, magic_system, item, lore_entry, rule, scene, timeline_event
    Valid edge labels: member_of, located_at, appears_in, owns, rivals, parent_of, precedes, commands, rules, allies_with, opposes
    Return empty arrays if nothing clearly matches.
    """

    /// Stream the chat response and, when the stream completes, run a separate
    /// extraction call to produce a `CanonicalPatch` from the buffered response text.
    /// Yields tuples of token events continuously; the patch arrives exactly once as
    /// the final yield after the stream finishes.
    func chatWithExtraction(
        messages: [Message],
        model: String,
        sourceId: String
    ) -> AsyncThrowingStream<ExtractionStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    // 1. Stream the main response, buffering full text
                    var fullText = ""
                    let request = try self.buildRequest(messages: messages, model: model)
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                        throw OllamaError.invalidResponse
                    }
                    for try await line in bytes.lines {
                        guard !line.isEmpty, let data = line.data(using: .utf8) else { continue }
                        let sr = try JSONDecoder().decode(OllamaStreamResponse.self, from: data)
                        fullText += sr.message.content
                        continuation.yield(.token(sr.message.content))
                        if sr.done { break }
                    }

                    // 2. Run the extraction call on the buffered text
                    let patch = try await self.extractEntities(from: fullText, model: model, sourceId: sourceId)
                    continuation.yield(.patch(patch))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    /// Non-streaming Ollama call that extracts canonical entities from `text`.
    private func extractEntities(
        from text: String,
        model: String,
        sourceId: String
    ) async throws -> CanonicalPatch {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let systemMsg = OllamaMessage(role: "system", content: extractionSystemPrompt)
        let userMsg   = OllamaMessage(role: "user",   content: text)
        let body      = OllamaRequest(model: model, messages: [systemMsg, userMsg], stream: false)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let decoded   = try JSONDecoder().decode(OllamaStreamResponse.self, from: data)
        let raw       = decoded.message.content

        // Strip optional markdown code fence
        let cleaned = raw
            .replacingOccurrences(of: #"^```[a-z]*\n?"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\n?```$"#,        with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return parseExtractionJSON(cleaned, sourceId: sourceId)
    }

    /// Parse the raw JSON string produced by the extraction model into a `CanonicalPatch`.
    private func parseExtractionJSON(_ json: String, sourceId: String) -> CanonicalPatch {
        let emptyPatch = CanonicalPatch(
            id: "patch_\(UUID().uuidString)", status: "pending",
            operations: [], sourceType: "chat", sourceId: sourceId, createdAt: Date()
        )
        guard let data = json.data(using: .utf8) else { return emptyPatch }

        let result = (try? JSONDecoder().decode(ExtractionResult.self, from: data))
            ?? ExtractionResult(entities: [], relationships: [])

        var ops: [PatchOperation] = []
        var nameToId: [String: String] = [:]
        let source = SourceRef(type: "chat", id: sourceId, label: nil)

        for entity in result.entities {
            guard let rawType = entity.type?.lowercased().replacingOccurrences(of: " ", with: "_"),
                  let canonType = CanonicalType(rawValue: rawType),
                  let name = entity.name, !name.isEmpty else { continue }
            let docId = makeDocId(type: canonType, name: name)
            nameToId[name.lowercased()] = docId
            let fields = CanonicalDocFields(
                id: docId,
                type: canonType,
                name: name,
                summary: entity.summary ?? "",
                sources: [source]
            )
            ops.append(.create(docType: rawType, fields: fields))
        }

        for rel in result.relationships {
            guard let fromName = rel.from, let toName = rel.to,
                  let fromId = nameToId[fromName.lowercased()],
                  let toId   = nameToId[toName.lowercased()] else { continue }
            let candidate = RelationshipCandidate(
                from: fromId,
                relType: rel.relType ?? "related_to",
                to: toId,
                sources: [source]
            )
            ops.append(.addRelationship(candidate))
        }

        return CanonicalPatch(
            id: "patch_\(UUID().uuidString)", status: "pending",
            operations: ops, sourceType: "chat", sourceId: sourceId, createdAt: Date()
        )
    }

    private func makeDocId(type: CanonicalType, name: String) -> String {
        let clean = name.lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
        return "\(type.rawValue)_\(clean)"
    }
}

enum OllamaError: LocalizedError {
    case invalidResponse
    case providerError(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from Ollama server. Ensure Ollama is running at http://localhost:11434."
        case .providerError(let message):
            return message
        }
    }
}

// MARK: - Cloud secrets store (Keychain-backed)

enum CloudSecretsStoreError: LocalizedError {
    case unexpectedStatus(OSStatus)
    case invalidData

    var errorDescription: String? {
        switch self {
        case .unexpectedStatus(let status):
            return "Keychain operation failed with status: \(status)"
        case .invalidData:
            return "Stored keychain data is invalid."
        }
    }
}

final class CloudSecretsStore {
    enum Key: String {
        case anthropic = "anthropic_api_key"
        case tavily = "tavily_api_key"
    }

    private let service = "com.quilliam.cloud"

    func set(_ value: String, for key: Key) throws {
        let data = Data(value.utf8)
        var query = baseQuery(for: key)
        SecItemDelete(query as CFDictionary)

        query[kSecValueData as String] = data
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw CloudSecretsStoreError.unexpectedStatus(status)
        }
    }

    func get(_ key: Key) throws -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw CloudSecretsStoreError.unexpectedStatus(status)
        }
        guard let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
            throw CloudSecretsStoreError.invalidData
        }
        return value
    }

    func remove(_ key: Key) throws {
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CloudSecretsStoreError.unexpectedStatus(status)
        }
    }

    private func baseQuery(for key: Key) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
    }
}

// MARK: - Assisted cloud client (Anthropic)

private struct AnthropicContentBlock: Decodable {
    let type: String
    let text: String?
}

private struct AnthropicUsage: Decodable {
    let input_tokens: Int?
    let output_tokens: Int?
}

private struct AnthropicResponse: Decodable {
    let content: [AnthropicContentBlock]
    let usage: AnthropicUsage?
}

actor CloudAssistService {
    func assist(
        query: String,
        context: String,
        messages: [Message],
        providerConfig: CloudProviderConfig,
        budget: RunBudget,
        anthropicApiKey: String
    ) async throws -> CloudAssistResponse {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anthropicApiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        struct Body: Encodable {
            let model: String
            let max_tokens: Int
            let temperature: Double
            let system: String
            let messages: [AnthropicMessage]

            struct AnthropicMessage: Encodable {
                let role: String
                let content: String
            }
        }

        let promptPayload = """
        {
          "task": "Assistive writing and scoped refactor suggestions",
          "query": \(jsonString(query)),
          "context": \(jsonString(String(context.prefix(12000)))),
          "messages": \(jsonString(messages.map { "\($0.role.rawValue): \($0.content)" }.joined(separator: "\\n"))),
          "outputSchema": {
            "message": "string",
            "patches": [
              {
                "id": "string",
                "targetId": "string",
                "targetKind": "active | chapter | character | location | world",
                "targetKey": "string | undefined",
                "rationale": "string",
                "edits": [],
                "citations": []
              }
            ]
          }
        }
        """

        let body = Body(
            model: providerConfig.anthropicModel,
            max_tokens: min(2200, budget.maxOutputTokens),
            temperature: 0.2,
            system: "You are Quilliam Assisted Cloud. Return strict JSON only with review-first edits.",
            messages: [.init(role: "user", content: promptPayload)]
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown provider error"
            throw OllamaError.providerError(msg)
        }

        let decoded = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        let text = decoded.content
            .filter { $0.type == "text" }
            .compactMap { $0.text }
            .joined(separator: "\n")

        guard let payloadData = extractJSONObjectData(from: text) else {
            return CloudAssistResponse(
                message: text.isEmpty ? "Assisted cloud completed without structured patch output." : text,
                patches: [],
                usage: UsageMeter(
                    spentUsd: 0,
                    inputTokens: decoded.usage?.input_tokens ?? 0,
                    outputTokens: decoded.usage?.output_tokens ?? 0,
                    sourcesFetched: 0,
                    elapsedMs: 0
                )
            )
        }

        var parsed = try JSONDecoder().decode(CloudAssistResponse.self, from: payloadData)
        if parsed.usage == nil {
            parsed.usage = UsageMeter(
                spentUsd: 0,
                inputTokens: decoded.usage?.input_tokens ?? 0,
                outputTokens: decoded.usage?.output_tokens ?? 0,
                sourcesFetched: 0,
                elapsedMs: 0
            )
        }
        return parsed
    }
}

// MARK: - Deep research durable runs

enum DeepResearchError: LocalizedError {
    case missingTavilyKey
    case missingAnthropicKey
    case budgetExceeded(String)
    case runNotFound

    var errorDescription: String? {
        switch self {
        case .missingTavilyKey:
            return "Deep Research requires a Tavily API key."
        case .missingAnthropicKey:
            return "Deep Research requires an Anthropic API key."
        case .budgetExceeded(let reason):
            return reason
        case .runNotFound:
            return "Deep research run not found."
        }
    }
}

struct CitationClaim {
    let claimRef: String
    let citations: [Citation]
}

struct CitationValidator {
    func validate(_ claims: [CitationClaim]) throws {
        for claim in claims {
            guard !claim.citations.isEmpty else {
                throw DeepResearchError.budgetExceeded("Claim \(claim.claimRef) is missing citations.")
            }
            for citation in claim.citations {
                if citation.url.isEmpty || citation.title.isEmpty || citation.quote.isEmpty {
                    throw DeepResearchError.budgetExceeded("Claim \(claim.claimRef) has incomplete citations.")
                }
            }
        }
    }
}

actor DeepResearchRunActor {
    private struct TavilyHit: Decodable {
        let title: String?
        let url: String?
        let content: String?
        let published_date: String?
    }

    private struct TavilyResponse: Decodable {
        let results: [TavilyHit]?
    }

    private struct StoredRuns: Codable {
        var runs: [ResearchRunRecord]
    }

    private var runs: [String: ResearchRunRecord] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]
    private var loaded = false

    private let validator = CitationValidator()

    func listRuns() async throws -> [ResearchRunRecord] {
        try await ensureLoaded()
        return Array(runs.values).sorted { $0.updatedAt > $1.updatedAt }
    }

    func getRun(id: String) async throws -> ResearchRunRecord {
        try await ensureLoaded()
        guard let run = runs[id] else { throw DeepResearchError.runNotFound }
        return run
    }

    func cancelRun(id: String) async throws -> ResearchRunRecord {
        try await ensureLoaded()
        guard var run = runs[id] else { throw DeepResearchError.runNotFound }
        tasks[id]?.cancel()
        run.status = .cancelled
        run.updatedAt = timestampMs()
        run.usage.elapsedMs = max(0, run.updatedAt - run.createdAt)
        runs[id] = run
        try await persist()
        return run
    }

    func startRun(
        query: String,
        context: String,
        providerConfig: CloudProviderConfig,
        budget: RunBudget,
        anthropicApiKey: String?,
        tavilyApiKey: String?
    ) async throws -> ResearchRunRecord {
        try await ensureLoaded()

        if providerConfig.tavilyEnabled && (tavilyApiKey?.isEmpty ?? true) {
            throw DeepResearchError.missingTavilyKey
        }
        if anthropicApiKey?.isEmpty ?? true {
            throw DeepResearchError.missingAnthropicKey
        }

        let id = UUID().uuidString.lowercased()
        var run = ResearchRunRecord(
            id: id,
            query: query,
            status: .queued,
            phase: .plan,
            budget: budget,
            usage: UsageMeter(),
            artifacts: [],
            error: nil,
            createdAt: timestampMs(),
            updatedAt: timestampMs()
        )
        runs[id] = run
        try await persist()

        tasks[id] = Task { [weak self] in
            await self?.executeRun(
                id: id,
                context: context,
                providerConfig: providerConfig,
                anthropicApiKey: anthropicApiKey ?? "",
                tavilyApiKey: tavilyApiKey
            )
        }

        run.status = .running
        runs[id] = run
        try await persist()
        return run
    }

    private func executeRun(
        id: String,
        context: String,
        providerConfig: CloudProviderConfig,
        anthropicApiKey: String,
        tavilyApiKey: String?
    ) async {
        do {
            try await setPhase(id: id, phase: .plan)
            try await enforceBudget(id: id)

            try await setPhase(id: id, phase: .query)
            let hits = try await querySources(query: runs[id]?.query ?? "", maxSources: runs[id]?.budget.maxSources ?? 10, tavilyApiKey: tavilyApiKey)
            try await updateUsage(id: id) { usage in
                usage.sourcesFetched = hits.count
            }
            try await enforceBudget(id: id)

            try await setPhase(id: id, phase: .fetch)
            let sourceClaims: [CitationClaim] = hits.enumerated().map { idx, hit in
                let claimRef = "C\(idx + 1)"
                let citation = Citation(
                    url: hit.url ?? "",
                    title: hit.title ?? "Untitled source",
                    publishedAt: hit.published_date,
                    quote: String((hit.content ?? "").prefix(180)),
                    claimRef: claimRef
                )
                return CitationClaim(claimRef: claimRef, citations: [citation])
            }
            try validator.validate(sourceClaims)
            try await enforceBudget(id: id)

            try await setPhase(id: id, phase: .extract)
            let extracted = sourceClaims.map { claim in
                "- \(claim.claimRef): \(claim.citations.first?.quote ?? "")"
            }.joined(separator: "\n")

            try await setPhase(id: id, phase: .synthesize)
            let notes = try await synthesizeNotes(
                query: runs[id]?.query ?? "",
                context: context,
                extracted: extracted,
                anthropicApiKey: anthropicApiKey,
                model: providerConfig.anthropicModel
            )
            try await updateUsage(id: id) { usage in
                usage.inputTokens += max(1, context.count / 4)
                usage.outputTokens += max(1, notes.count / 4)
                usage.spentUsd += Double(usage.inputTokens) * 0.000003 + Double(usage.outputTokens) * 0.000015
            }
            try await enforceBudget(id: id)

            try await setPhase(id: id, phase: .propose)
            let citations = sourceClaims.flatMap { $0.citations }
            var run = try await getRun(id: id)
            run.artifacts = [
                ResearchArtifact(
                    id: UUID().uuidString.lowercased(),
                    runId: id,
                    kind: "notes",
                    content: notes,
                    citations: citations,
                    createdAt: timestampMs()
                ),
                ResearchArtifact(
                    id: UUID().uuidString.lowercased(),
                    runId: id,
                    kind: "claims",
                    content: extracted,
                    citations: citations,
                    createdAt: timestampMs()
                )
            ]
            run.status = .completed
            run.updatedAt = timestampMs()
            run.usage.elapsedMs = max(0, run.updatedAt - run.createdAt)
            runs[id] = run
            try await persist()
        } catch {
            do {
                guard var run = runs[id] else { return }
                if run.status != .cancelled {
                    if case DeepResearchError.budgetExceeded(let reason) = error {
                        run.status = .budgetExceeded
                        run.error = reason
                    } else if error is CancellationError {
                        run.status = .cancelled
                    } else {
                        run.status = .failed
                        run.error = error.localizedDescription
                    }
                    run.updatedAt = timestampMs()
                    run.usage.elapsedMs = max(0, run.updatedAt - run.createdAt)
                    runs[id] = run
                    try await persist()
                }
            } catch {
                // swallow secondary persistence failures
            }
        }

        tasks[id] = nil
    }

    private func querySources(query: String, maxSources: Int, tavilyApiKey: String?) async throws -> [TavilyHit] {
        guard let tavilyApiKey, !tavilyApiKey.isEmpty else {
            throw DeepResearchError.missingTavilyKey
        }

        var request = URLRequest(url: URL(string: "https://api.tavily.com/search")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "api_key": tavilyApiKey,
            "query": query,
            "search_depth": "basic",
            "max_results": max(1, min(maxSources, 20)),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw OllamaError.invalidResponse
        }
        let decoded = try JSONDecoder().decode(TavilyResponse.self, from: data)
        return Array((decoded.results ?? []).prefix(maxSources))
    }

    private func synthesizeNotes(
        query: String,
        context: String,
        extracted: String,
        anthropicApiKey: String,
        model: String
    ) async throws -> String {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anthropicApiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        struct Body: Encodable {
            let model: String
            let max_tokens: Int
            let system: String
            let messages: [Message]

            struct Message: Encodable {
                let role: String
                let content: String
            }
        }

        let prompt = """
        Query: \(query)

        Context:
        \(String(context.prefix(2000)))

        Extracted claims (each should remain citation-backed):
        \(String(extracted.prefix(3000)))

        Return concise notes and a suggested outline.
        """

        let body = Body(
            model: model,
            max_tokens: 1800,
            system: "You are Quilliam Deep Research. Keep every claim tied to source evidence.",
            messages: [.init(role: "user", content: prompt)]
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw OllamaError.invalidResponse
        }

        let decoded = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        let text = decoded.content
            .filter { $0.type == "text" }
            .compactMap { $0.text }
            .joined(separator: "\n")
        return text.isEmpty ? "No synthesis output generated." : text
    }

    private func setPhase(id: String, phase: ResearchRunPhase) async throws {
        guard var run = runs[id] else { throw DeepResearchError.runNotFound }
        run.phase = phase
        run.status = .running
        run.updatedAt = timestampMs()
        run.usage.elapsedMs = max(0, run.updatedAt - run.createdAt)
        runs[id] = run
        try await persist()
    }

    private func updateUsage(id: String, mutate: (inout UsageMeter) -> Void) async throws {
        guard var run = runs[id] else { throw DeepResearchError.runNotFound }
        mutate(&run.usage)
        run.updatedAt = timestampMs()
        run.usage.elapsedMs = max(0, run.updatedAt - run.createdAt)
        runs[id] = run
        try await persist()
    }

    private func enforceBudget(id: String) async throws {
        guard let run = runs[id] else { throw DeepResearchError.runNotFound }
        let usage = run.usage
        let budget = run.budget

        if usage.spentUsd > budget.maxUsd {
            throw DeepResearchError.budgetExceeded("Run exceeded USD budget.")
        }
        if usage.inputTokens > budget.maxInputTokens {
            throw DeepResearchError.budgetExceeded("Run exceeded input token budget.")
        }
        if usage.outputTokens > budget.maxOutputTokens {
            throw DeepResearchError.budgetExceeded("Run exceeded output token budget.")
        }
        if usage.sourcesFetched > budget.maxSources {
            throw DeepResearchError.budgetExceeded("Run exceeded source budget.")
        }
        if usage.elapsedMs > budget.maxMinutes * 60 * 1000 {
            throw DeepResearchError.budgetExceeded("Run exceeded time budget.")
        }
    }

    private func ensureLoaded() async throws {
        guard !loaded else { return }
        loaded = true
        let url = try storageURL()
        do {
            let data = try Data(contentsOf: url)
            let decoded = try JSONDecoder().decode(StoredRuns.self, from: data)
            self.runs = Dictionary(uniqueKeysWithValues: decoded.runs.map { ($0.id, $0) })
        } catch {
            self.runs = [:]
        }
    }

    private func persist() async throws {
        let url = try storageURL()
        let payload = StoredRuns(runs: Array(runs.values).sorted { $0.updatedAt > $1.updatedAt })
        let data = try JSONEncoder().encode(payload)
        try data.write(to: url, options: [.atomic])
    }

    private func storageURL() throws -> URL {
        let fm = FileManager.default
        let appSupport = try fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = appSupport.appendingPathComponent("Quilliam", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("deep-research-runs.json")
    }
}

private func extractJSONObjectData(from text: String) -> Data? {
    if let data = text.data(using: .utf8),
       (try? JSONSerialization.jsonObject(with: data, options: [])) != nil {
        return data
    }

    guard let start = text.firstIndex(of: "{"),
          let end = text.lastIndex(of: "}") else {
        return nil
    }
    let json = String(text[start ... end])
    return json.data(using: .utf8)
}

private func jsonString(_ value: String) -> String {
    let escaped = value
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
        .replacingOccurrences(of: "\n", with: "\\n")
    return "\"\(escaped)\""
}

private func timestampMs() -> Int {
    Int(Date().timeIntervalSince1970 * 1000)
}
