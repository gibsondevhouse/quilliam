import Foundation
import SwiftData

@Model
final class Document {
    var id: UUID
    var title: String
    /// The last explicitly committed version of the text ("saved" baseline for the diff panel).
    var lastSavedText: String
    /// The accepted/committed working state. `acceptChange` promotes `workingText` here.
    var text: String
    /// Live in-progress state — edited directly by the EditorView and patched by the AI stream.
    var workingText: String
    var createdAt: Date

    // MARK: - Init

    init(
        id: UUID = UUID(),
        title: String = "Untitled",
        text: String = "",
        createdAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.text = text
        self.workingText = text
        self.lastSavedText = text
        self.createdAt = createdAt
    }

    // MARK: - Computed helpers (not persisted)

    /// Lines of `workingText` (the live buffer).
    var lines: [String] {
        workingText.components(separatedBy: "\n")
    }

    /// Lines of `lastSavedText` (the diff baseline).
    var savedLines: [String] {
        lastSavedText.components(separatedBy: "\n")
    }

    /// True when there are unsaved changes relative to `lastSavedText`.
    var isDirty: Bool {
        workingText != lastSavedText
    }

    // MARK: - Pure apply (does not mutate self)

    /// Returns a new text string that results from applying `edits` to `base`.
    /// Pass `base: nil` to apply to `workingText`.
    /// Edits are applied in *descending* start-index order to preserve index validity.
    func apply(lineEdits edits: [LineEdit], to base: String? = nil) -> String {
        let sourceText = base ?? workingText
        var lineArray = sourceText.components(separatedBy: "\n")

        // Sort descending so later ranges don't shift earlier ones
        let sorted = edits.sorted { Document.startIndex(of: $0) > Document.startIndex(of: $1) }

        for edit in sorted {
            switch edit {
            case .replace(let range, let newLines):
                let clamped = range.clamped(to: 0 ..< max(lineArray.count, 1))
                lineArray.replaceSubrange(clamped, with: newLines)
            case .insert(let index, let newLines):
                let safeIndex = min(max(index + 1, 0), lineArray.count)
                lineArray.insert(contentsOf: newLines, at: safeIndex)
            case .delete(let range):
                let clamped = range.clamped(to: 0 ..< max(lineArray.count, 1))
                if !clamped.isEmpty {
                    lineArray.removeSubrange(clamped)
                }
            }
        }
        return lineArray.joined(separator: "\n")
    }

    private static func startIndex(of edit: LineEdit) -> Int {
        switch edit {
        case .replace(let range, _): return range.lowerBound
        case .insert(let index, _): return index
        case .delete(let range): return range.lowerBound
        }
    }
}
