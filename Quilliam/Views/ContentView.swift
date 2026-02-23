import SwiftUI

struct ContentView: View {
    @State private var viewModel = ChatViewModel()

    var body: some View {
        NavigationSplitView {
            SidebarView(viewModel: viewModel)
        } detail: {
            ChatView(viewModel: viewModel)
        }
    }
}

#Preview {
    ContentView()
}
