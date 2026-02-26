import Foundation
import SwiftUI

// MARK: - Line-level edit operations

/// A single, self-contained instruction for modifying a set of lines in a document.
/// Indices are **0-based**, matching Swift array semantics. The EditParser
/// converts the 1-based line numbers the AI uses into 0-based values here.
enum LineEdit {
    /// Replace lines in `range` with `newLines` (range is 0-based, exclusive upper bound).
    case replace(range: Range<Int>, with: [String])
    /// Insert `newLines` *after* the 0-based `index`. Use index -1 to prepend.
    case insert(index: Int, lines: [String])
    /// Remove lines in `range` (0-based, exclusive upper bound).
    case delete(range: Range<Int>)
}

// MARK: - Change lifecycle

enum ChangeStatus {
    case pending
    case accepted
    case rejected
}

/// A group of `LineEdit` operations produced by a single AI response.
struct ChangeSet: Identifiable {
    var id: UUID = UUID()
    var edits: [LineEdit]
    var status: ChangeStatus = .pending
    /// The raw text of the AI commentary associated with this change.
    var commentary: String = ""
}

// MARK: - Per-line visual state

/// Visual decoration applied to each editor line based on pending `ChangeSet`s.
enum LineChangeState {
    case unchanged
    case added
    case modified
    case deleted

    var color: Color {
        switch self {
        case .unchanged: return .clear
        case .added:     return Color(red: 0.15, green: 0.65, blue: 0.30)
        case .modified:  return Color(red: 0.85, green: 0.65, blue: 0.10)
        case .deleted:   return Color(red: 0.85, green: 0.25, blue: 0.20)
        }
    }
}
