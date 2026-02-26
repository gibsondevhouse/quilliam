import SwiftUI
import SwiftData

struct SidebarView: View {
    var viewModel: ChatViewModel

    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Document.createdAt, order: .reverse) private var documents: [Document]

    var body: some View {
        List(selection: Binding(
            get: { viewModel.currentDocument?.id },
            set: { id in
                if let id, let doc = documents.first(where: { $0.id == id }) {
                    viewModel.currentDocument = doc
                    viewModel.clearHistory()
                    viewModel.changeSets = []
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
    }

    // MARK: - Actions

    private func createDocument() {
        let doc = Document(title: "Untitled \(documents.count + 1)")
        modelContext.insert(doc)
        viewModel.currentDocument = doc
        viewModel.clearHistory()
        viewModel.changeSets = []
    }

    private func renameDocument(_ doc: Document) {
        // Simple rename via alert — SwiftUI .alert with TextField requires iOS 16+/macOS 13+
        // Using a basic approach: set a placeholder title that the user can edit in the editor
        doc.title = "Renamed Document"
    }

    private func deleteDocument(_ doc: Document) {
        if viewModel.currentDocument?.id == doc.id {
            viewModel.currentDocument = documents.first(where: { $0.id != doc.id })
            viewModel.clearHistory()
            viewModel.changeSets = []
        }
        modelContext.delete(doc)
    }

    private func deleteDocuments(at offsets: IndexSet) {
        for index in offsets {
            deleteDocument(documents[index])
        }
    }
}
