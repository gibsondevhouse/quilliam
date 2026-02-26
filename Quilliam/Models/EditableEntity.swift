import Foundation

// MARK: - EditableEntity

/// A lightweight in-session snapshot of a world-building entity that the AI
/// can propose edits to, just like it does for the main `Document`.
///
/// `editableText` is a plain-text representation of the entity's editable content.
/// For a `Character`, this is the `notes` field. For a `Location`, the `description`.
/// For a `WorldEntry`, the `notes` field.
protocol EditableEntity {
    /// The unique file-target key (matching `FileTarget.key`), e.g. "character:Elena".
    var targetKey: String { get }
    /// Human-readable display name.
    var displayName: String { get }
    /// The text that the AI's edit fences operate on. Mutable so edits can be applied.
    var editableText: String { get set }
}

// MARK: - Concrete entity snapshots

struct CharacterEntity: EditableEntity, Identifiable {
    var id: String
    var name: String
    var role: String
    var notes: String

    var targetKey: String { "character:\(name)" }
    var displayName: String { name.isEmpty ? "Unnamed Character" : name }
    var editableText: String {
        get { notes }
        set { notes = newValue }
    }
}

struct LocationEntity: EditableEntity, Identifiable {
    var id: String
    var name: String
    var description: String

    var targetKey: String { "location:\(name)" }
    var displayName: String { name.isEmpty ? "Unnamed Location" : name }
    var editableText: String {
        get { description }
        set { description = newValue }
    }
}

struct WorldEntryEntity: EditableEntity, Identifiable {
    var id: String
    var title: String
    var category: String
    var notes: String

    var targetKey: String { "world:\(title)" }
    var displayName: String { title.isEmpty ? "Untitled Entry" : title }
    var editableText: String {
        get { notes }
        set { notes = newValue }
    }
}
