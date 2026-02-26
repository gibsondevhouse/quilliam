import SwiftUI
import SwiftData

struct ContentView: View {
    @State private var viewModel = ChatViewModel()
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Document.createdAt, order: .reverse) private var documents: [Document]

    var body: some View {
        NavigationSplitView {
            SidebarView(viewModel: viewModel)
        } detail: {
            DetailTabView(viewModel: viewModel)
        }
        .onAppear {
            // Auto-select the most-recently-created document, or create one if none exist
            if viewModel.currentDocument == nil {
                if let first = documents.first {
                    viewModel.currentDocument = first
                } else {
                    let doc = Document(title: "New Document")
                    modelContext.insert(doc)
                    viewModel.currentDocument = doc
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
