import Foundation
import Observation
import SwiftUI

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

    /// The document currently open in the active editor tab. `nil` = no document selected yet.
    var currentDocument: Document?

    /// Auxiliary entity documents opened because the AI requested to edit them.
    /// Key matches `FileTarget.key` (e.g. "character:Elena").
    var entityDocuments: [String: EditableEntity] = [:]

    /// The entity / document tab currently displayed in the editor. `nil` = active chapter.
    var activeEntityKey: String? = nil

    /// All change sets produced during this session (pending, accepted, or rejected).
    /// Keyed by `FileTarget.key`.
    var changeSets: [String: [ChangeSet]] = [:]

    /// Pending change sets for the active document / entity.
    var pendingChangeSets: [ChangeSet] {
        let key = activeEntityKey ?? FileTarget.activeDocument.key
        return (changeSets[key] ?? []).filter { $0.status == .pending }
    }

    /// Toggles the diff panel.
    var showDiff: Bool = false

    // MARK: - Attributed content helpers

    /// Returns an `AttributedString` for the currently displayed text, with pending changeset
    /// highlights applied. Bound to the `TextEditor` so the user can still type.
    func attributedWorkingText() -> AttributedString {
        let text: String
        if let key = activeEntityKey, let entity = entityDocuments[key] {
            text = entity.editableText
        } else {
            text = currentDocument?.workingText ?? ""
        }

        let states = lineChangeStates()
        var attributed = AttributedString("")

        for (index, line) in text.split(separator: "\n", omittingEmptySubsequences: false).enumerated() {
            let lineStr = String(line)
            let state: LineChangeState = index < states.count ? states[index] : .unchanged
            var segment = AttributedString(lineStr + "\n")
            switch state {
            case .added:
                segment.backgroundColor = Color.green.opacity(0.3)
            case .modified:
                segment.backgroundColor = Color.yellow.opacity(0.25)
            case .deleted:
                segment.backgroundColor = Color.red.opacity(0.2)
                segment.strikethroughStyle = .single
            case .unchanged:
                break
            }
            attributed.append(segment)
        }
        return attributed
    }

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
            // Build history: system doc-context + conversation (drop empty placeholder)
            var history = Array(messages.dropLast())
            if let doc = currentDocument, !doc.workingText.isEmpty {
                history.insert(buildDocumentSystemPrompt(for: doc), at: 0)
            }

            let rawStream = await service.chat(messages: history, model: selectedModel)
            let parsedStream = EditParser.parse(rawStream)

            // Track one ChangeSet per file target per AI response
            var changeSetsCreated: Set<String> = []

            for try await event in parsedStream {
                switch event {
                case .token(let chunk):
                    guard assistantIndex < messages.count else { break }
                    messages[assistantIndex].content += chunk

                case .editBlock(let edit, let fileTarget):
                    let key = fileTarget.key

                    // Apply edit live (preview)
                    switch fileTarget {
                    case .activeDocument:
                        if let doc = currentDocument {
                            doc.workingText = doc.apply(lineEdits: [edit])
                        }
                    default:
                        if let entity = entityDocuments[key] {
                            var updated = entity
                            let patched = patchText(entity.editableText, with: edit)
                            updated.editableText = patched
                            entityDocuments[key] = updated
                        }
                    }

                    // Create or extend the ChangeSet for this file target this turn
                    if changeSetsCreated.contains(key),
                       var list = changeSets[key],
                       !list.isEmpty {
                        list[list.count - 1].edits.append(edit)
                        changeSets[key] = list
                    } else {
                        let cs = ChangeSet(edits: [edit])
                        changeSets[key, default: []].append(cs)
                        changeSetsCreated.insert(key)
                    }

                    // If this is an entity target, auto-open that entity tab
                    if fileTarget != .activeDocument && activeEntityKey == nil {
                        activeEntityKey = key
                    }
                }
            }

            // Stamp all new ChangeSets with the assistant's commentary
            let commentary = messages[assistantIndex].content
            for key in changeSetsCreated {
                if var list = changeSets[key], !list.isEmpty {
                    list[list.count - 1].commentary = commentary
                    changeSets[key] = list
                }
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

    /// Accept a ChangeSet by id (for the active entity/document).
    func acceptChange(_ id: UUID) {
        for key in changeSets.keys {
            guard let idx = changeSets[key]?.firstIndex(where: { $0.id == id }) else { continue }
            changeSets[key]![idx].status = .accepted
            if key == FileTarget.activeDocument.key, let doc = currentDocument {
                doc.text = doc.workingText
            } else if var entity = entityDocuments[key] {
                // Working text is already applied; mark entity as accepted
                _ = entity // no extra work needed, live preview is the accepted state
                entityDocuments[key] = entity
            }
            break
        }
    }

    /// Reject a ChangeSet by id.
    func rejectChange(_ id: UUID) {
        for key in changeSets.keys {
            guard let idx = changeSets[key]?.firstIndex(where: { $0.id == id }) else { continue }
            changeSets[key]![idx].status = .rejected

            if key == FileTarget.activeDocument.key, let doc = currentDocument {
                var rebuilt = doc.text
                for cs in (changeSets[key] ?? []) where cs.status == .pending {
                    rebuilt = doc.apply(lineEdits: cs.edits, to: rebuilt)
                }
                doc.workingText = rebuilt
            }
            break
        }
    }

    /// Accept all pending change sets for the given key (defaults to active document).
    func acceptAllChanges(for key: String? = nil) {
        let k = key ?? (activeEntityKey ?? FileTarget.activeDocument.key)
        for idx in (changeSets[k] ?? []).indices where changeSets[k]![idx].status == .pending {
            changeSets[k]![idx].status = .accepted
        }
        if k == FileTarget.activeDocument.key, let doc = currentDocument {
            doc.text = doc.workingText
        }
    }

    /// Reject all pending change sets for the given key.
    func rejectAllChanges(for key: String? = nil) {
        let k = key ?? (activeEntityKey ?? FileTarget.activeDocument.key)
        for idx in (changeSets[k] ?? []).indices where changeSets[k]![idx].status == .pending {
            changeSets[k]![idx].status = .rejected
        }
        if k == FileTarget.activeDocument.key, let doc = currentDocument {
            doc.workingText = doc.text
        }
    }

    // Backwards-compat wrappers used by existing toolbar
    func acceptAllChanges() { acceptAllChanges(for: nil) }
    func rejectAllChanges() { rejectAllChanges(for: nil) }

    /// Revert `workingText` to `lastSavedText`, discarding all pending sets.
    func revertToSaved() {
        guard let doc = currentDocument else { return }
        for idx in (changeSets[FileTarget.activeDocument.key] ?? []).indices
            where changeSets[FileTarget.activeDocument.key]![idx].status == .pending {
            changeSets[FileTarget.activeDocument.key]![idx].status = .rejected
        }
        doc.workingText = doc.lastSavedText
    }

    /// Promote `workingText` → both `text` and `lastSavedText` (explicit Save).
    func saveDocument() {
        guard let doc = currentDocument else { return }
        doc.text = doc.workingText
        doc.lastSavedText = doc.workingText
        for idx in (changeSets[FileTarget.activeDocument.key] ?? []).indices
            where changeSets[FileTarget.activeDocument.key]![idx].status == .pending {
            changeSets[FileTarget.activeDocument.key]![idx].status = .accepted
        }
    }

    // MARK: - Per-line change states

    /// Returns one `LineChangeState` per line for the currently displayed document/entity.
    func lineChangeStates() -> [LineChangeState] {
        let key = activeEntityKey ?? FileTarget.activeDocument.key
        let text: String
        if let k = activeEntityKey, let entity = entityDocuments[k] {
            text = entity.editableText
        } else {
            text = currentDocument?.workingText ?? ""
        }
        guard !text.isEmpty else { return [] }

        var states = Array(repeating: LineChangeState.unchanged, count: text.split(separator: "\n", omittingEmptySubsequences: false).count)

        for cs in (changeSets[key] ?? []) where cs.status == .pending {
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

    /// Apply a single `LineEdit` to a plain text string and return the result.
    private func patchText(_ text: String, with edit: LineEdit) -> String {
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        switch edit {
        case .replace(let range, let newLines):
            let clamped = range.clamped(to: 0 ..< max(lines.count, 1))
            lines.replaceSubrange(clamped, with: newLines)
        case .insert(let index, let newLines):
            let at = min(max(index + 1, 0), lines.count)
            lines.insert(contentsOf: newLines, at: at)
        case .delete(let range):
            let clamped = range.clamped(to: 0 ..< max(lines.count, 1))
            lines.removeSubrange(clamped)
        }
        return lines.joined(separator: "\n")
    }

    private func buildDocumentSystemPrompt(for doc: Document) -> Message {
        // Build entity index block
        var entityBlock = ""
        if !entityDocuments.isEmpty {
            entityBlock = "\n\nThe following world-building entities are available and editable via `file=` qualifiers:\n"
            for (key, entity) in entityDocuments {
                entityBlock += "- \(key): \(entity.editableText.prefix(200))\n"
            }
        }

        return Message(role: .system, content: """
        You are an AI writing assistant editing a document in Quilliam. \
        The current document (working text) is enclosed between the markers below.\(entityBlock)

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

          Edit a world-building entity (character, location, or world entry):
          ```edit line=1 file=character:Elena
          Updated description
          ```

          ```edit line=1-2 file=location:Harbortown
          Updated notes
          ```

        Outside edit fences, write plain commentary explaining your reasoning. \
        Never nest fence markers.
        """)
    }
}
