// CanonicalRelationship.swift
// Quilliam
//
// SwiftData model for typed edges between canonical documents.
// Mirrors the TypeScript `Relationship` interface in src/lib/types.ts
// (Plan 001 — Phase 6 parity).
//
// NOTE: Any change to field names / types MUST be matched in src/lib/types.ts.

import Foundation
import SwiftData

// MARK: - CanonicalRelationship

/// A typed directed edge between two `CanonicalDocument` records.
/// Mirrors the TypeScript `Relationship` interface.
@Model
final class CanonicalRelationship {
    @Attribute(.unique) var id: String
    /// Source canonical doc ID (maps to `CanonicalDocument.id`).
    var from: String
    /// Edge label: "member_of", "located_at", "appears_in", "owns", etc.
    var type: String
    /// Target canonical doc ID.
    var to: String
    /// JSON-serialised extra data: timeframe, strength, confidence score.
    var metadataJSON: Data
    /// JSON-serialised `[SourceRef]` citations.
    var sourcesJSON: Data

    init(
        id: String,
        from: String,
        type: String,
        to: String,
        metadata: [String: Any] = [:],
        sources: [SourceRef] = []
    ) {
        self.id           = id
        self.from         = from
        self.type         = type
        self.to           = to
        self.metadataJSON = (try? JSONSerialization.data(withJSONObject: metadata)) ?? Data()
        self.sourcesJSON  = (try? JSONEncoder().encode(sources)) ?? Data()
    }

    var metadata: [String: Any] {
        guard let obj = try? JSONSerialization.jsonObject(with: metadataJSON),
              let dict = obj as? [String: Any] else { return [:] }
        return dict
    }

    var sources: [SourceRef] {
        (try? JSONDecoder().decode([SourceRef].self, from: sourcesJSON)) ?? []
    }
}

// MARK: - CanonicalPatchRecord

/// A proposed changeset awaiting user review in the native Patch Review modal.
/// Mirrors the TypeScript `CanonicalPatch` interface.
///
/// Operations are stored as JSON-serialised `PatchOperation` arrays so they
/// can be decoded back to strongly-typed values on the apply path.
@Model
final class CanonicalPatchRecord {
    @Attribute(.unique) var id: String
    /// "pending" | "accepted" | "rejected"
    var status: String
    /// JSON-serialised `[PatchOperation]`
    var operationsJSON: Data
    /// "chat" | "research" | "manual"
    var sourceType: String
    var sourceId: String
    /// Extraction confidence in [0, 1]. >= 0.85 → auto-committed without user review.
    var confidence: Double
    /// `true` when the patch was applied automatically (confidence >= 0.85).
    var autoCommit: Bool
    var createdAt: Date

    init(
        id: String,
        status: String = "pending",
        operations: [PatchOperation] = [],
        sourceType: String,
        sourceId: String,
        confidence: Double = 0.65,
        autoCommit: Bool = false,
        createdAt: Date = .now
    ) {
        self.id             = id
        self.status         = status
        self.operationsJSON = (try? JSONEncoder().encode(operations)) ?? Data()
        self.sourceType     = sourceType
        self.sourceId       = sourceId
        self.confidence     = confidence
        self.autoCommit     = autoCommit
        self.createdAt      = createdAt
    }

    /// Decoded typed operations. Returns empty array if decoding fails.
    var typedOperations: [PatchOperation] {
        (try? JSONDecoder().decode([PatchOperation].self, from: operationsJSON)) ?? []
    }
}
