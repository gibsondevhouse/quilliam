// ExtractionTypes.swift
// Quilliam
//
// Lightweight value types used by the canonical-entity extraction workflow.
// These are plain Codable structs (not SwiftData @Model classes) — they live
// only in memory during an extraction pass and are written to SwiftData only
// after the user accepts the patch in the review sheet.

import Foundation

// MARK: - Raw LLM extraction response payloads

/// Top-level JSON object returned by the extraction model.
struct ExtractionResult: Codable {
    var entities: [RawEntity]
    var relationships: [RawRelationship]
}

/// A single entity extracted from the model response.
struct RawEntity: Codable {
    var type: String?
    var name: String?
    var summary: String?
    /// Confidence score [0, 1] returned by the extraction model; defaults to 0.65.
    var confidence: Double?
}

/// A single relationship extracted from the model response.
struct RawRelationship: Codable {
    var from: String?
    var relType: String?
    var to: String?
}

// MARK: - Patch value types

/// Value-type mirror of the canonical doc fields used inside a patch operation.
/// Distinct from the SwiftData `CanonicalDocument` @Model class.
struct CanonicalDocFields: Codable {
    var id: String
    var type: CanonicalType
    var name: String
    var summary: String
    var sources: [SourceRef]
}

/// Relationship edge candidate produced by extraction.
struct RelationshipCandidate: Codable {
    var from: String
    var relType: String
    var to: String
    var sources: [SourceRef]
}

/// Individual operation in a canonical patch.
enum PatchOperation: Codable {
    case create(docType: String, fields: CanonicalDocFields)
    case addRelationship(RelationshipCandidate)

    private enum CodingKeys: String, CodingKey {
        case op, docType, fields, relationship
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .create(let docType, let fields):
            try c.encode("create", forKey: .op)
            try c.encode(docType, forKey: .docType)
            try c.encode(fields, forKey: .fields)
        case .addRelationship(let rel):
            try c.encode("add-relationship", forKey: .op)
            try c.encode(rel, forKey: .relationship)
        }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let op = try c.decode(String.self, forKey: .op)
        switch op {
        case "create":
            let docType = try c.decode(String.self, forKey: .docType)
            let fields  = try c.decode(CanonicalDocFields.self, forKey: .fields)
            self = .create(docType: docType, fields: fields)
        case "add-relationship":
            let rel = try c.decode(RelationshipCandidate.self, forKey: .relationship)
            self = .addRelationship(rel)
        default:
            throw DecodingError.dataCorruptedError(forKey: .op, in: c,
                debugDescription: "Unknown PatchOperation op: \(op)")
        }
    }
}

/// A proposed changeset produced by the extraction pipeline, awaiting user review.
struct CanonicalPatch: Identifiable, Codable {
    var id: String
    var status: String          // "pending" | "accepted" | "rejected"
    var operations: [PatchOperation]
    var sourceType: String      // "chat" | "research" | "manual"
    var sourceId: String
    /// Extraction confidence in [0, 1]. >= 0.85 → eligible for auto-commit.
    var confidence: Double
    /// When true, this patch was or should be applied without user review.
    var autoCommit: Bool
    var createdAt: Date
}

// MARK: - Streaming event type

/// Events yielded by `OllamaService.chatWithExtraction(messages:model:sourceId:)`.
enum ExtractionStreamEvent {
    /// A streaming token from the main chat response.
    case token(String)
    /// The final extraction patch, produced after the stream completes.
    case patch(CanonicalPatch)
}
