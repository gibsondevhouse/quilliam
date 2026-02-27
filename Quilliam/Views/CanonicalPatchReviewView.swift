// CanonicalPatchReviewView.swift
// Quilliam
//
// Two views for canonical patch review:
//
//  • `CanonicalPatchReviewView` — sheet presented immediately after an extraction
//    pass, backed by the in-memory `CanonicalPatch` value type.
//
//  • `PendingPatchQueueView` — Build-Feed-style list that queries all
//    `CanonicalPatchRecord` rows from SwiftData that are still "pending",
//    mirroring the web Build Feed accept / reject behaviour (§7.6).

import SwiftUI
import SwiftData

// MARK: - Immediate post-extraction review

struct CanonicalPatchReviewView: View {
    let patch: CanonicalPatch
    let onDecision: (Bool) -> Void

    var body: some View {
        NavigationStack {
            List {
                confidenceBanner

                Section("Proposed Changes (\(patch.operations.count))") {
                    ForEach(Array(patch.operations.enumerated()), id: \.offset) { _, op in
                        switch op {
                        case .create(let type, let fields):
                            Label("\(type): \(fields.name)", systemImage: "plus.circle")
                                .help(fields.summary)
                        case .addRelationship(let rel):
                            Label("\(rel.from) → \(rel.relType) → \(rel.to)",
                                  systemImage: "arrow.right.circle")
                        }
                    }
                }
            }
            .navigationTitle("Review Extracted Entities")
#if os(macOS)
            .frame(minWidth: 400, minHeight: 300)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reject") { onDecision(false) }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Accept All") { onDecision(true) }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    @ViewBuilder
    private var confidenceBanner: some View {
        let pct = Int(patch.confidence * 100)
        let color: Color = patch.confidence >= 0.85 ? .green : patch.confidence >= 0.6 ? .orange : .red
        Section {
            Label("Confidence: \(pct)%", systemImage: "chart.bar.fill")
                .foregroundStyle(color)
                .font(.caption)
        }
    }
}

// MARK: - Persistent pending-patch queue (SwiftData-backed)

/// Build-Feed–style view that lists all CanonicalPatchRecord rows with
/// status "pending" from SwiftData. Mirrors the web Build Feed UX.
struct PendingPatchQueueView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: #Predicate<CanonicalPatchRecord> { $0.status == "pending" },
        sort: \.createdAt,
        order: .reverse
    )
    private var pendingRecords: [CanonicalPatchRecord]

    var body: some View {
        NavigationStack {
            Group {
                if pendingRecords.isEmpty {
                    ContentUnavailableView(
                        "No Pending Patches",
                        systemImage: "checkmark.seal",
                        description: Text("All extracted entity patches have been reviewed.")
                    )
                } else {
                    List {
                        ForEach(pendingRecords) { record in
                            PendingPatchRow(record: record, onAccept: {
                                applyRecord(record)
                            }, onReject: {
                                record.status = "rejected"
                            })
                        }
                    }
                }
            }
            .navigationTitle("Pending Patches (\(pendingRecords.count))")
#if os(macOS)
            .frame(minWidth: 480, minHeight: 320)
#endif
            .toolbar {
                if !pendingRecords.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Accept All") {
                            pendingRecords.forEach { applyRecord($0) }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Reject All") {
                            pendingRecords.forEach { $0.status = "rejected" }
                        }
                    }
                }
            }
        }
    }

    private func applyRecord(_ record: CanonicalPatchRecord) {
        for op in record.typedOperations {
            switch op {
            case .create(_, let fields):
                let doc = CanonicalDocument(
                    id: fields.id,
                    type: fields.type,
                    name: fields.name,
                    summary: fields.summary,
                    status: "draft",
                    sources: fields.sources
                )
                modelContext.insert(doc)
            case .addRelationship(let rel):
                let r = CanonicalRelationship(
                    id: UUID().uuidString,
                    from: rel.from,
                    type: rel.relType,
                    to: rel.to
                )
                modelContext.insert(r)
            }
        }
        record.status = "accepted"
    }
}

// MARK: - Single row inside PendingPatchQueueView

private struct PendingPatchRow: View {
    let record: CanonicalPatchRecord
    let onAccept: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "doc.badge.clock")
                    .foregroundStyle(.secondary)
                Text(record.sourceType.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                let pct = Int(record.confidence * 100)
                Text("\(pct)% confidence")
                    .font(.caption2)
                    .foregroundStyle(record.confidence >= 0.85 ? .green : .orange)
            }

            ForEach(Array(record.typedOperations.enumerated()), id: \.offset) { _, op in
                switch op {
                case .create(let type, let fields):
                    Label("\(type): \(fields.name)", systemImage: "plus.circle.fill")
                        .font(.caption)
                case .addRelationship(let rel):
                    Label("\(rel.from) → \(rel.relType) → \(rel.to)",
                          systemImage: "arrow.right.circle.fill")
                        .font(.caption)
                }
            }

            HStack {
                Button("Accept", action: onAccept)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                Button("Reject", role: .destructive, action: onReject)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 4)
    }
}
