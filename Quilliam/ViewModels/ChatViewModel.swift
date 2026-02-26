import Foundation
import Observation

@Observable
@MainActor
final class ChatViewModel {

    // MARK: - Chat state

    var messages: [Message] = []
    var inputText: String = ""
    var selectedModel: String = "gemma3:4b"
    var isLoading: Bool = false
    var errorMessage: String?

    let availableModels = ["gemma3:4b", "llama3.2", "mistral", "phi4"]

    // MARK: - Document / editor state

    /// The document currently open in the editor. `nil` = no document selected yet.
    var currentDocument: Document?

    /// All change sets produced during this session (pending, accepted, or rejected).
    var changeSets: [ChangeSet] = []

    /// Pending change sets that power inline highlights and the diff panel.
    var pendingChangeSets: [ChangeSet] {
        changeSets.filter { $0.status == .pending }
    }

    /// Toggles the diff panel.
    var showDiff: Bool = false

    // MARK: - Private

    private let service = OllamaService()

    // MARK: - Core send

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
            // Build history: optional system doc-context + full conversation minus empty placeholder
            var history = Array(messages.dropLast())
            if let doc = currentDocument, !doc.workingText.isEmpty {
                history.insert(buildDocumentSystemPrompt(for: doc), at: 0)
            }

            let rawStream = await service.chat(messages: history, model: selectedModel)
            let parsedStream = EditParser.parse(rawStream)

            var changeSetCreated = false

            for try await event in parsedStream {
                switch event {
                case .token(let chunk):
                    guard assistantIndex < messages.count else { break }
                    messages[assistantIndex].content += chunk

                case .editBlock(let edit):
                    // Apply edit to workingText for live inline preview
                    if let doc = currentDocument {
                        doc.workingText = doc.apply(lineEdits: [edit])
                    }

                    // Create or extend the ChangeSet for this AI turn
                    if changeSetCreated, let idx = changeSets.indices.last {
                        changeSets[idx].edits.append(edit)
                    } else {
                        changeSets.append(ChangeSet(edits: [edit]))
                        changeSetCreated = true
                    }
                }
            }

            // Stamp the completed ChangeSet with the assistant's full commentary
            if changeSetCreated, let idx = changeSets.indices.last {
                changeSets[idx].commentary = messages[assistantIndex].content
            }

        } catch {
            if assistantIndex < messages.count {
                messages[assistantIndex].content = "Error: \(error.localizedDescription)"
            }
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Change management

    /// Accept a ChangeSet: commit `workingText` into `document.text`.
    func acceptChange(_ id: UUID) {
        guard let idx = changeSets.firstIndex(where: { $0.id == id }),
              let doc = currentDocument else { return }
        changeSets[idx].status = .accepted
        doc.text = doc.workingText
    }

    /// Reject a ChangeSet: remove its edits and recompute `workingText`.
    func rejectChange(_ id: UUID) {
        guard let idx = changeSets.firstIndex(where: { $0.id == id }),
              let doc = currentDocument else { return }
        changeSets[idx].status = .rejected
        // Rebuild workingText from doc.text + remaining pending sets
        var rebuilt = doc.text
        for cs in changeSets where cs.status == .pending {
            rebuilt = doc.apply(lineEdits: cs.edits, to: rebuilt)
        }
        doc.workingText = rebuilt
    }

    /// Accept all pending change sets.
    func acceptAllChanges() {
        guard let doc = currentDocument else { return }
        for idx in changeSets.indices where changeSets[idx].status == .pending {
            changeSets[idx].status = .accepted
        }
        doc.text = doc.workingText
    }

    /// Reject all pending change sets and revert `workingText` to `doc.text`.
    func rejectAllChanges() {
        guard let doc = currentDocument else { return }
        for idx in changeSets.indices where changeSets[idx].status == .pending {
            changeSets[idx].status = .rejected
        }
        doc.workingText = doc.text
    }

    /// Revert `workingText` to `lastSavedText`, discarding all pending sets.
    func revertToSaved() {
        guard let doc = currentDocument else { return }
        for idx in changeSets.indices where changeSets[idx].status == .pending {
            changeSets[idx].status = .rejected
        }
        doc.workingText = doc.lastSavedText
    }

    /// Promote `workingText` → both `text` and `lastSavedText` (explicit Save).
    func saveDocument() {
        guard let doc = currentDocument else { return }
        doc.text = doc.workingText
        doc.lastSavedText = doc.workingText
        for idx in changeSets.indices where changeSets[idx].status == .pending {
            changeSets[idx].status = .accepted
        }
    }

    // MARK: - Per-line change states

    /// Returns one `LineChangeState` per line in `currentDocument.lines`.
    func lineChangeStates() -> [LineChangeState] {
        guard let doc = currentDocument else { return [] }
        var states = Array(repeating: LineChangeState.unchanged, count: max(doc.lines.count, 1))

        for cs in pendingChangeSets {
            for edit in cs.edits {
                switch edit {
                case .replace(let range, let newLines):
                    let clamped = range.clamped(to: 0 ..< max(states.count, 1))
                    for i in clamped { states[i] = .modified }
                    let extra = newLines.count - clamped.count
                    if extra > 0 {
                        let at = min(clamped.upperBound, states.count)
                        states.insert(contentsOf: Array(repeating: .added, count: extra), at: at)
                    }
                case .insert(let index, let newLines):
                    let at = min(max(index + 1, 0), states.count)
                    states.insert(contentsOf: Array(repeating: .added, count: newLines.count), at: at)
                case .delete(let range):
                    let clamped = range.clamped(to: 0 ..< max(states.count, 1))
                    for i in clamped where i < states.count { states[i] = .deleted }
                }
            }
        }
        return states
    }

    // MARK: - Chat management

    func clearHistory() {
        messages = []
        errorMessage = nil
        isLoading = false
    }

    // MARK: - Private helpers

    private func buildDocumentSystemPrompt(for doc: Document) -> Message {
        Message(role: .system, content: """
        You are an AI writing assistant editing a document in Quilliam. \
        The current document (working text) is enclosed between the markers below.

        ---DOCUMENT START---
        \(doc.workingText)
        ---DOCUMENT END---

        To propose text edits, use the following fenced format (lines are 1-based):

          Replace lines 3–5:
          ```edit line=3-5
          new line 3
          new line 4
          ```

          Insert after line 2:
          ```edit line=2+
          new line
          ```

          Delete lines 4–6:
          ```edit line=4-6 delete
          ```

        Outside edit fences, write plain commentary explaining your reasoning. \
        Never nest fence markers.
        """)
    }
}
