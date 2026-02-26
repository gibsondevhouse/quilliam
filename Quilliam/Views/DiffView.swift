import SwiftUI

// MARK: - Diff data structures

enum DiffTag {
    case unchanged, added, deleted
}

struct DiffLine: Identifiable {
    let id = UUID()
    let original: String?
    let modified: String?
    let tag: DiffTag

    var originalDisplay: String { original ?? "" }
    var modifiedDisplay: String { modified ?? "" }
}

// MARK: - LCS-based line diff

/// Produces a sequence of `DiffLine`s by running a simple Myers-style LCS diff
/// between `original` and `modified` string arrays.
func computeDiff(from original: [String], to modified: [String]) -> [DiffLine] {
    let n = original.count
    let m = modified.count

    // Build LCS table
    var dp = Array(repeating: Array(repeating: 0, count: m + 1), count: n + 1)
    for i in stride(from: n - 1, through: 0, by: -1) {
        for j in stride(from: m - 1, through: 0, by: -1) {
            if original[i] == modified[j] {
                dp[i][j] = 1 + dp[i + 1][j + 1]
            } else {
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])
            }
        }
    }

    // Traceback
    var result: [DiffLine] = []
    var i = 0, j = 0
    while i < n || j < m {
        if i < n && j < m && original[i] == modified[j] {
            result.append(DiffLine(original: original[i], modified: modified[j], tag: .unchanged))
            i += 1; j += 1
        } else if j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j]) {
            result.append(DiffLine(original: nil, modified: modified[j], tag: .added))
            j += 1
        } else {
            result.append(DiffLine(original: original[i], modified: nil, tag: .deleted))
            i += 1
        }
    }
    return result
}

// MARK: - DiffView

struct DiffView: View {
    @Bindable var viewModel: ChatViewModel

    @State private var diffLines: [DiffLine] = []
    @State private var debounceTask: Task<Void, Never>?

    private let lineHeight: CGFloat = 20

    var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack {
                Label("Live Diff", systemImage: "arrow.left.arrow.right")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Saved  ←→  Working")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(.windowBackgroundColor))

            Divider()

            if diffLines.isEmpty {
                ContentUnavailableView(
                    "No Changes",
                    systemImage: "checkmark.circle",
                    description: Text("The working text matches the saved baseline.")
                )
            } else {
                splitScrollView
            }
        }
        .onChange(of: viewModel.currentDocument?.workingText) { _, _ in
            scheduleDiffUpdate()
        }
        .onChange(of: viewModel.currentDocument?.lastSavedText) { _, _ in
            scheduleDiffUpdate()
        }
        .onAppear { updateDiff() }
    }

    // MARK: - Split scroll layout

    private var splitScrollView: some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                // ── Original (left) ──────────────────────────────────────
                columnView(side: .original, width: geo.size.width / 2)

                Divider()

                // ── Modified (right) ─────────────────────────────────────
                columnView(side: .modified, width: geo.size.width / 2)
            }
        }
    }

    enum Side { case original, modified }

    @ViewBuilder
    private func columnView(side: Side, width: CGFloat) -> some View {
        ScrollView(.vertical) {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(diffLines) { line in
                    let text = side == .original ? line.originalDisplay : line.modifiedDisplay
                    let bg = rowBackground(line: line, side: side)
                    Text(text.isEmpty && isSignificant(line: line, side: side) ? " " : text)
                        .font(.system(.body, design: .monospaced))
                        .frame(maxWidth: .infinity, minHeight: lineHeight, alignment: .leading)
                        .padding(.horizontal, 8)
                        .background(bg)
                }
            }
        }
        .frame(width: width)
    }

    private func rowBackground(line: DiffLine, side: Side) -> Color {
        switch line.tag {
        case .unchanged: return .clear
        case .added:     return side == .modified ? Color.green.opacity(0.18) : Color.red.opacity(0.08)
        case .deleted:   return side == .original ? Color.red.opacity(0.18)   : Color.red.opacity(0.08)
        }
    }

    /// Whether a blank placeholder row is meaningful (i.e., align gap).
    private func isSignificant(line: DiffLine, side: Side) -> Bool {
        side == .original ? line.original == nil : line.modified == nil
    }

    // MARK: - Diff computation (debounced)

    private func scheduleDiffUpdate() {
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300 ms
            guard !Task.isCancelled else { return }
            updateDiff()
        }
    }

    private func updateDiff() {
        guard let doc = viewModel.currentDocument else {
            diffLines = []
            return
        }
        diffLines = computeDiff(from: doc.savedLines, to: doc.lines)
    }
}
