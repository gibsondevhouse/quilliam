import Foundation
import SwiftUI
import SwiftData

struct SidebarView: View {
    var viewModel: ChatViewModel

    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Document.createdAt, order: .reverse) private var documents: [Document]
    @State private var isRenamePromptPresented = false
    @State private var renameValue = ""
    @State private var renameTargetId: UUID?

    var body: some View {
        List(selection: Binding(
            get: { viewModel.currentDocument?.id },
            set: { id in
                if let id, let doc = documents.first(where: { $0.id == id }) {
                    viewModel.currentDocument = doc
                    viewModel.clearHistory()
                    viewModel.changeSets = [:]
                    viewModel.clearEntityEditingState()
                }
            }
        )) {
            Section("Documents") {
                ForEach(documents) { doc in
                    Label {
                        HStack {
                            Text(doc.title)
                                .lineLimit(1)
                            if doc.isDirty {
                                Circle()
                                    .fill(Color.accentColor)
                                    .frame(width: 6, height: 6)
                            }
                        }
                    } icon: {
                        Image(systemName: "doc.text")
                    }
                    .tag(doc.id)
                    .contextMenu {
                        Button("Rename") { renameDocument(doc) }
                        Divider()
                        Button("Delete", role: .destructive) { deleteDocument(doc) }
                    }
                }
                .onDelete(perform: deleteDocuments)
            }
        }
        .navigationTitle("Quilliam")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    createDocument()
                } label: {
                    Label("New Document", systemImage: "square.and.pencil")
                }
                .help("Create a new document")
            }
        }
        .alert("Rename Document", isPresented: $isRenamePromptPresented) {
            TextField("Title", text: $renameValue)
            Button("Cancel", role: .cancel) {
                renameTargetId = nil
                renameValue = ""
            }
            Button("Save") {
                commitRename()
            }
        } message: {
            Text("Enter a new title.")
        }
    }

    // MARK: - Actions

    private func createDocument() {
        let doc = Document(title: "Untitled \(documents.count + 1)")
        modelContext.insert(doc)
        viewModel.currentDocument = doc
        viewModel.clearHistory()
        viewModel.changeSets = [:]
        viewModel.clearEntityEditingState()
    }

    private func renameDocument(_ doc: Document) {
        renameTargetId = doc.id
        renameValue = doc.title
        isRenamePromptPresented = true
    }

    private func commitRename() {
        let title = renameValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let targetId = renameTargetId,
              !title.isEmpty,
              let target = documents.first(where: { $0.id == targetId }) else {
            renameTargetId = nil
            renameValue = ""
            return
        }
        target.title = title
        renameTargetId = nil
        renameValue = ""
    }

    private func deleteDocument(_ doc: Document) {
        if viewModel.currentDocument?.id == doc.id {
            viewModel.currentDocument = documents.first(where: { $0.id != doc.id })
            viewModel.clearHistory()
            viewModel.changeSets = [:]
            viewModel.clearEntityEditingState()
        }
        modelContext.delete(doc)
    }

    private func deleteDocuments(at offsets: IndexSet) {
        for index in offsets {
            deleteDocument(documents[index])
        }
    }
}
