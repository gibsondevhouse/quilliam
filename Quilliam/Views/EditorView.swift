import SwiftUI

// MARK: - Highlight styles for AI change decorations

enum HighlightStyles {
    /// Inserted lines — green background.
    static var insertion: AttributeContainer {
        var c = AttributeContainer()
        c.backgroundColor = .green.opacity(0.30)
        return c
    }

    /// Modified lines — amber/yellow background.
    static var modification: AttributeContainer {
        var c = AttributeContainer()
        c.backgroundColor = Color(red: 0.92, green: 0.72, blue: 0.10).opacity(0.30)
        return c
    }

    /// Deleted lines — red background + strikethrough.
    static var deletion: AttributeContainer {
        var c = AttributeContainer()
        c.backgroundColor = .red.opacity(0.20)
        c.strikethroughStyle = .single
        return c
    }
}

struct EditorView: View {
    @Bindable var viewModel: ChatViewModel

    private let gutterWidth: CGFloat = 48
    private let changeBarWidth: CGFloat = 4
    private let lineHeight: CGFloat = 20

    // Attributed text binding — synced bidirectionally with doc.workingText
    @State private var attributedText: AttributedString = AttributedString("")

    var body: some View {
        if let doc = viewModel.currentDocument {
            editorBody(doc: doc)
                .toolbar { editorToolbar }
                .onChange(of: doc.workingText) { _, _ in
                    refreshAttributed(doc: doc)
                }
                .onChange(of: viewModel.pendingChangeSets.count) { _, _ in
                    refreshAttributed(doc: doc)
                }
                .onAppear {
                    refreshAttributed(doc: doc)
                }
        } else {
            emptyState
        }
    }

    // MARK: - Sync attributed ↔ plain text

    private func refreshAttributed(doc: Document) {
        let new = viewModel.attributedWorkingText()
        // Only update when content actually changed to avoid cursor jumps
        if new != attributedText {
            attributedText = new
        }
    }

    // MARK: - Main editor layout

    @ViewBuilder
    private func editorBody(doc: Document) -> some View {
        HStack(spacing: 0) {
            // ── Gutter: change bar + line numbers + hunk buttons ───────────
            gutterView(doc: doc)
                .frame(width: gutterWidth + changeBarWidth + 8)

            Divider()

            // Entity tabs (shown when AI has opened additional entity documents)
            if !viewModel.entityDocuments.isEmpty {
                entityTabArea(doc: doc)
            } else {
                // ── Attributed text editor ──────────────────────────────────
                TextEditor(text: $attributedText)
                    .font(.system(.body, design: .serif))
                    .scrollContentBackground(.hidden)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .onChange(of: attributedText) { _, new in
                        // Write plain text back to document
                        let plain = String(new.characters)
                        if doc.workingText != plain {
                            doc.workingText = plain
                        }
                    }
            }
        }
    }

    // MARK: - Entity switcher (shown when AI has opened world-building entities)

    @ViewBuilder
    private func entityTabArea(doc: Document) -> some View {
        VStack(spacing: 0) {
            // Tab strip
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    // "Main Document" tab
                    entityTabButton(label: "Document", key: nil,
                                    isActive: viewModel.activeEntityKey == nil)

                    ForEach(Array(viewModel.entityDocuments.keys.sorted()), id: \.self) { key in
                        let entity = viewModel.entityDocuments[key]
                        entityTabButton(label: entity?.displayName ?? key, key: key,
                                        isActive: viewModel.activeEntityKey == key)
                    }
                }
            }
            .frame(height: 32)
            .background(Color(.controlBackgroundColor))

            Divider()

            // Attributed editor for whichever tab is active
            TextEditor(text: $attributedText)
                .font(.system(.body, design: .serif))
                .scrollContentBackground(.hidden)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onChange(of: attributedText) { _, new in
                    let plain = String(new.characters)
                    if let key = viewModel.activeEntityKey {
                        if viewModel.entityDocuments[key]?.editableText != plain {
                            viewModel.entityDocuments[key]?.editableText = plain
                        }
                    } else if doc.workingText != plain {
                        doc.workingText = plain
                    }
                }
                .onChange(of: viewModel.activeEntityKey) { _, _ in
                    refreshAttributed(doc: doc)
                }
        }
    }

    @ViewBuilder
    private func entityTabButton(label: String, key: String?, isActive: Bool) -> some View {
        Button {
            viewModel.activeEntityKey = key
        } label: {
            Text(label)
                .font(.system(size: 12))
                .padding(.horizontal, 12)
                .frame(height: 32)
                .background(isActive ? Color.accentColor.opacity(0.15) : Color.clear)
                .foregroundStyle(isActive ? Color.primary : Color.secondary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Gutter

    @ViewBuilder
    private func gutterView(doc: Document) -> some View {
        let lines = doc.lines
        let states = viewModel.lineChangeStates()

        // Determine which line is the "first line" of each pending ChangeSet
        // so we know where to render the accept/reject buttons.
        let hunkFirstLines: [(changeSetId: UUID, line: Int)] = firstLinesOfChangeSets(states: states)

        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .trailing, spacing: 0) {
                ForEach(Array(lines.enumerated()), id: \.offset) { index, _ in
                    HStack(spacing: 4) {
                        // Change bar
                        Rectangle()
                            .fill(changeColor(for: index, states: states))
                            .frame(width: changeBarWidth, height: lineHeight)

                        // Per-hunk accept/reject micro-buttons
                        if let hunk = hunkFirstLines.first(where: { $0.line == index }) {
                            hunkButtons(changeSetId: hunk.changeSetId)
                        } else {
                            // Line number (shifted right when no hunk button)
                            Text("\(index + 1)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .frame(width: gutterWidth, alignment: .trailing)
                                .frame(height: lineHeight)
                        }
                    }
                }
            }
            .padding(.top, 8)
        }
        .background(Color(.controlBackgroundColor).opacity(0.6))
    }

    @ViewBuilder
    private func hunkButtons(changeSetId: UUID) -> some View {
        HStack(spacing: 2) {
            Button {
                viewModel.acceptChange(changeSetId)
            } label: {
                Text("✓")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.green)
            }
            .buttonStyle(.plain)
            .frame(width: 16, height: lineHeight)
            .help("Accept this change")

            Button {
                viewModel.rejectChange(changeSetId)
            } label: {
                Text("✗")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.red)
            }
            .buttonStyle(.plain)
            .frame(width: 16, height: lineHeight)
            .help("Reject this change")
        }
        .frame(width: gutterWidth, alignment: .trailing)
        .frame(height: lineHeight)
    }

    /// Compute the first line index (0-based) of each pending ChangeSet in the current states array.
    private func firstLinesOfChangeSets(states: [LineChangeState]) -> [(changeSetId: UUID, line: Int)] {
        let key = viewModel.activeEntityKey ?? FileTarget.activeDocument.key
        let pendingSets = (viewModel.changeSets[key] ?? []).filter { $0.status == .pending }
        var result: [(UUID, Int)] = []

        for cs in pendingSets {
            let firstEdit = cs.edits.first
            var firstLine = 0
            switch firstEdit {
            case .replace(let range, _):
                firstLine = range.lowerBound
            case .insert(let index, _):
                firstLine = max(0, index + 1)
            case .delete(let range):
                firstLine = range.lowerBound
            case nil:
                break
            }
            result.append((cs.id, min(firstLine, max(0, states.count - 1))))
        }
        return result
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
                .help("Save document")
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
