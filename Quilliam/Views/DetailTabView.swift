import SwiftUI

// MARK: - Tab enum

enum DetailTab: String, CaseIterable {
    case editor = "Editor"
    case chat   = "Chat"

    var systemImage: String {
        switch self {
        case .editor: return "doc.text"
        case .chat:   return "bubble.left.and.bubble.right"
        }
    }
}

// MARK: - DetailTabView

struct DetailTabView: View {
    @Bindable var viewModel: ChatViewModel

    @State private var selectedTab: DetailTab = .editor
    @State private var diffHeight: CGFloat = 260
    @State private var dragStartHeight: CGFloat = 260

    var body: some View {
        VStack(spacing: 0) {
            // ── Custom tab bar ────────────────────────────────────────────────
            tabBar

            Divider()

            // ── Content pane ──────────────────────────────────────────────────
            Group {
                if selectedTab == .editor {
                    EditorView(viewModel: viewModel)
                } else {
                    ChatView(viewModel: viewModel)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // ── Diff panel (collapsible bottom sheet) ─────────────────────────
            if viewModel.showDiff {
                Divider()
                DiffView(viewModel: viewModel)
                    .frame(height: diffHeight)
                    .overlay(alignment: .top) {
                        // Drag handle
                        dragHandle
                    }
            }
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(DetailTab.allCases, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    Label(tab.rawValue, systemImage: tab.systemImage)
                        .font(.subheadline)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(selectedTab == tab ? Color.primary : Color.secondary)
                .background(
                    selectedTab == tab
                        ? Color.accentColor.opacity(0.12)
                        : Color.clear
                )
                .overlay(alignment: .bottom) {
                    if selectedTab == tab {
                        Rectangle()
                            .fill(Color.accentColor)
                            .frame(height: 2)
                    }
                }
            }

            Spacer()

            // Pending-changes badge
            if !viewModel.pendingChangeSets.isEmpty {
                Text("\(viewModel.pendingChangeSets.count) pending")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.trailing, 12)
            }
        }
        .background(Color(.windowBackgroundColor))
    }

    // MARK: - Drag handle for diff resize

    private var dragHandle: some View {
        Rectangle()
            .fill(Color.secondary.opacity(0.3))
            .frame(width: 40, height: 4)
            .clipShape(Capsule())
            .padding(.top, 4)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        // Drag UP (negative Y) expands the panel
                        diffHeight = max(120, min(600, dragStartHeight - value.translation.height))
                    }
                    .onEnded { _ in
                        dragStartHeight = diffHeight
                    }
            )
            .frame(maxWidth: .infinity)
            .background(Color(.windowBackgroundColor).opacity(0.01)) // widens hit area
    }
}
