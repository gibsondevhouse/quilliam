// CanonicalDocument.swift
// Quilliam
//
// SwiftData model mirrors for the canonical document types defined in
// src/lib/types.ts (Plan 001 — Phase 6 parity).
//
// NOTE: Any change to the field names / types here MUST be matched in the
// TypeScript counterpart (src/lib/types.ts) and vice versa, per the
// cross-platform parity rule in AGENT.md.

import Foundation
import SwiftData

// MARK: - CanonicalType

/// The set of first-class narrative entity kinds.
/// Mirrors the TypeScript `CanonicalType` union.
enum CanonicalType: String, Codable, CaseIterable {
    case character      = "character"
    case location       = "location"
    case faction        = "faction"
    case magicSystem    = "magic_system"
    case item           = "item"
    case loreEntry      = "lore_entry"
    case rule           = "rule"
    case scene          = "scene"
    case timelineEvent  = "timeline_event"
}

// MARK: - SourceRef

/// A traceable citation pointing back to the prose or research that originated a fact.
/// Mirrors the TypeScript `SourceRef` interface.
struct SourceRef: Codable, Identifiable {
    /// "scene" | "research" | "chat" | "migration" | "manual"
    let type: String
    let id: String
    let label: String?
}

// MARK: - RelationshipRef

/// Denormalised outgoing edge on a `CanonicalDocument` for fast single-doc reads.
/// Mirrors the TypeScript `RelationshipRef` interface.
struct RelationshipRef: Codable, Identifiable {
    let id = UUID().uuidString   // local-only unique key for SwiftUI lists
    let relationshipId: String
    let toDocId: String
    let type: String
}

// MARK: - CanonicalDocument

/// Base record for all canonical narrative entities.
/// Mirrors the TypeScript `CanonicalDoc` interface.
///
/// Stored via SwiftData; the `details` dictionary mirrors the JSON `details`
/// field and is serialised through a Codable wrapper.
@Model
final class CanonicalDocument {
    /// Prefix-encoded unique ID (e.g., `char_123`).
    @Attribute(.unique) var id: String
    var type: String   // CanonicalType raw value
    var name: String
    var summary: String
    /// JSON-serialised type-specific fields; see TypeScript `CanonicalDoc.details`.
    var detailsJSON: Data
    /// "draft" | "canon"
    var status: String
    var sourcesJSON: Data          // [SourceRef] as JSON
    var relationshipsJSON: Data    // [RelationshipRef] as JSON
    var lastVerified: Date
    var updatedAt: Date

    init(
        id: String,
        type: CanonicalType,
        name: String,
        summary: String,
        details: [String: Any] = [:],
        status: String = "draft",
        sources: [SourceRef] = [],
        relationships: [RelationshipRef] = [],
        lastVerified: Date = .distantPast,
        updatedAt: Date = .now
    ) {
        self.id              = id
        self.type            = type.rawValue
        self.name            = name
        self.summary         = summary
        self.detailsJSON     = (try? JSONSerialization.data(withJSONObject: details)) ?? Data()
        self.status          = status
        self.sourcesJSON     = (try? JSONEncoder().encode(sources)) ?? Data()
        self.relationshipsJSON = (try? JSONEncoder().encode(relationships)) ?? Data()
        self.lastVerified    = lastVerified
        self.updatedAt       = updatedAt
    }

    /// Decoded `type` as a `CanonicalType` enum value.
    var canonicalType: CanonicalType {
        CanonicalType(rawValue: type) ?? .loreEntry
    }

    /// Decoded `details` dictionary.
    var details: [String: Any] {
        guard let obj = try? JSONSerialization.jsonObject(with: detailsJSON),
              let dict = obj as? [String: Any] else { return [:] }
        return dict
    }

    /// Decoded `sources` array.
    var sources: [SourceRef] {
        (try? JSONDecoder().decode([SourceRef].self, from: sourcesJSON)) ?? []
    }

    /// Decoded `relationships` array.
    var relationships: [RelationshipRef] {
        (try? JSONDecoder().decode([RelationshipRef].self, from: relationshipsJSON)) ?? []
    }
}
