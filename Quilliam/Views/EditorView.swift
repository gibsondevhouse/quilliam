import SwiftUI

struct EditorView: View {
    @Bindable var viewModel: ChatViewModel

    private let gutterWidth: CGFloat = 48
    private let changeBarWidth: CGFloat = 4
    private let lineHeight: CGFloat = 20

    var body: some View {
        if let doc = viewModel.currentDocument {
            editorBody(doc: doc)
                .toolbar { editorToolbar }
        } else {
            emptyState
        }
    }

    // MARK: - Main editor layout

    @ViewBuilder
    private func editorBody(doc: Document) -> some View {
        HStack(spacing: 0) {
            // ── Gutter: change bar + line numbers ──────────────────────────
            gutterView(doc: doc)
                .frame(width: gutterWidth + changeBarWidth + 8)

            Divider()

            // ── Text editor ──────────────────────────────────────────────
            TextEditor(text: Binding(
                get: { doc.workingText },
                set: { doc.workingText = $0 }
            ))
            .font(.system(.body, design: .monospaced))
            .scrollContentBackground(.hidden)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - Gutter

    @ViewBuilder
    private func gutterView(doc: Document) -> some View {
        let lines = doc.lines
        let states = viewModel.lineChangeStates()

        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .trailing, spacing: 0) {
                ForEach(Array(lines.enumerated()), id: \.offset) { index, _ in
                    HStack(spacing: 4) {
                        // Change bar
                        Rectangle()
                            .fill(changeColor(for: index, states: states))
                            .frame(width: changeBarWidth, height: lineHeight)

                        // Line number
                        Text("\(index + 1)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .frame(width: gutterWidth, alignment: .trailing)
                            .frame(height: lineHeight)
                    }
                }
            }
            .padding(.top, 8)
        }
        .background(Color(.controlBackgroundColor).opacity(0.6))
    }

    private func changeColor(for index: Int, states: [LineChangeState]) -> Color {
        guard index < states.count else { return .clear }
        return states[index].color
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var editorToolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button("Save") { viewModel.saveDocument() }
                .disabled(!(viewModel.currentDocument?.isDirty ?? false))
                .help("Save document (promotes workingText → lastSavedText)")
        }

        ToolbarItem(placement: .primaryAction) {
            Toggle(isOn: $viewModel.showDiff) {
                Label("Diff", systemImage: "doc.text.magnifyingglass")
            }
            .toggleStyle(.button)
            .help("Show / hide live diff panel")
        }

        ToolbarItem(placement: .primaryAction) {
            Button("Accept All") { viewModel.acceptAllChanges() }
                .disabled(viewModel.pendingChangeSets.isEmpty)
                .help("Accept all pending AI changes")
        }

        ToolbarItem(placement: .primaryAction) {
            Button("Reject All") { viewModel.rejectAllChanges() }
                .disabled(viewModel.pendingChangeSets.isEmpty)
                .help("Reject all pending AI changes")
        }

        ToolbarItem(placement: .primaryAction) {
            Button {
                viewModel.revertToSaved()
            } label: {
                Label("Revert", systemImage: "arrow.uturn.backward")
            }
            .help("Revert to last saved state")
            .disabled(!(viewModel.currentDocument?.isDirty ?? false))
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView(
            "No Document",
            systemImage: "doc.text",
            description: Text("Create or select a document from the sidebar.")
        )
    }
}
