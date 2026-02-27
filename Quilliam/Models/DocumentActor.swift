import SwiftData
import Foundation

// MARK: - DocumentActor

/// Background ModelActor for batched SwiftData persistence operations.
///
/// SwiftData as of Swift 6 / iOS 26 still lacks a native batch-insert API — every
/// insert goes through `ModelContext`, which instantiates each `PersistentModel`
/// and tracks relationships on the main actor by default. Performing bulk inserts
/// on the main actor causes visible UI jank.
///
/// Use this actor to offload batch inserts (e.g., importing RAG chunks, cloning
/// documents) to a background context. The `@ModelActor` macro:
/// - generates a Swift actor with its own isolated `ModelContext`
/// - ensures all operations on `modelContext` run off the main thread
///
/// Usage:
/// ```swift
/// let actor = DocumentActor(modelContainer: container)
/// try await actor.batchInsert(nodes, batchSize: 200)
/// ```
///
/// Reference: "SwiftData batch-write best practices", run001 research, phase 4.
@ModelActor
actor DocumentActor {

    // MARK: - Batch insert

    /// Insert `items` into the background context in chunks of `batchSize`, calling
    /// `save()` once per chunk to keep transaction size bounded.
    ///
    /// - Parameters:
    ///   - items: Array of `PersistentModel` instances to insert.
    ///   - batchSize: Number of objects per transaction. 200 is a safe default;
    ///     lower this if models are large (e.g., contain embedded blobs).
    func batchInsert<T: PersistentModel>(_ items: [T], batchSize: Int = 200) throws {
        var offset = 0
        while offset < items.count {
            let end = min(offset + batchSize, items.count)
            for item in items[offset ..< end] {
                modelContext.insert(item)
            }
            try modelContext.save()
            offset = end
        }
    }

    // MARK: - Safe document save

    /// Persist any pending changes in the background context.
    /// Call after mutating model objects obtained via `modelContext.fetch(_:)`.
    func save() throws {
        try modelContext.save()
    }

    // MARK: - Document utilities

    /// Create and persist a new document in the background, returning its stable `id`.
    ///
    /// Callers should cross-reference by `id` when they need to update the main-context
    /// copy — do **not** pass `Document` objects across actor boundaries.
    func createDocument(title: String, text: String = "") throws -> UUID {
        let doc = Document(title: title, text: text)
        modelContext.insert(doc)
        try modelContext.save()
        return doc.id
    }

    /// Delete all documents matching a predicate, using SwiftData's `delete(model:where:)`
    /// which bypasses per-object `ModelContext` overhead (batch delete path).
    func deleteDocuments(where predicate: Predicate<Document>) throws {
        try modelContext.delete(model: Document.self, where: predicate)
        try modelContext.save()
    }
}
