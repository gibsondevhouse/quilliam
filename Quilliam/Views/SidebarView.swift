import SwiftUI

struct SidebarView: View {
    var viewModel: ChatViewModel

    var body: some View {
        List {
            if !viewModel.messages.isEmpty {
                Label("Current Chat", systemImage: "message.fill")
                    .foregroundStyle(.primary)
            }
        }
        .navigationTitle("Chats")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.clearHistory()
                } label: {
                    Label("New Chat", systemImage: "square.and.pencil")
                }
                .help("Start a new chat")
            }
        }
    }
}
