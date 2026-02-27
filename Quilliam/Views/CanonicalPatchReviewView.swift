// CanonicalPatchReviewView.swift
// Quilliam
//
// Sheet presented after an AI extraction pass. Shows the proposed canonical
// document and relationship operations so the user can accept or reject them.

import SwiftUI

struct CanonicalPatchReviewView: View {
    let patch: CanonicalPatch
    let onDecision: (Bool) -> Void

    var body: some View {
        NavigationStack {
            List {
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
}
