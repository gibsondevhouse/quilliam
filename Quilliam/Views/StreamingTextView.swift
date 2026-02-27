import SwiftUI
import AppKit

// MARK: - StreamingTextView

/// High-performance NSTextView bridge for macOS assistant message bodies.
///
/// SwiftUI's `Text` uses CoreGraphics/CoreText and rebuilds its entire layout on
/// every string mutation. Benchmarks (JuniperPhoton, 2024) show CPU hitting 49%
/// with CA Commit > 200 ms at ~50 lines of streamed text. This bridge drops that
/// to < 24% by delegating to NSTextView, which patches only the changed range.
///
/// Usage:
/// - Use for assistant message content (streaming response bodies).
/// - Keep `Text` for short, non-streaming content (user messages, labels).
struct StreamingTextView: NSViewRepresentable {
    let text: String
    var foregroundColor: NSColor = .labelColor
    var font: NSFont = .systemFont(ofSize: NSFont.systemFontSize)

    // MARK: Make

    func makeNSView(context: Context) -> NSTextView {
        let textView = NSTextView()

        // Appearance
        textView.drawsBackground = false
        textView.isEditable = false
        textView.isSelectable = true
        textView.font = font
        textView.textColor = foregroundColor

        // Layout — horizontal fill, vertical expansion
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]

        // Text container — expand vertically, track width of view
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.heightTracksTextView = false
        textView.textContainer?.containerSize = CGSize(
            width: CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude
        )

        // Allow selection toolbar (copy, look up, etc.)
        textView.usesFindBar = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isGrammarCheckingEnabled = false
        textView.isContinuousSpellCheckingEnabled = false

        return textView
    }

    // MARK: Update

    func updateNSView(_ nsView: NSTextView, context: Context) {
        // Direct string assignment is O(diff) in NSTextStorage — fast for token appends
        if nsView.string != text {
            nsView.string = text
        }
        if nsView.textColor != foregroundColor {
            nsView.textColor = foregroundColor
        }
    }

    // MARK: Sizing (macOS 13+)

    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView: NSTextView,
        context: Context
    ) -> CGSize? {
        let width = max(proposal.width ?? 200, 1)
        guard !text.isEmpty else {
            // Reserve one line height even when empty (avoids layout jump on first token)
            return CGSize(width: width, height: ceil(font.pointSize * 1.4))
        }

        let attrs: [NSAttributedString.Key: Any] = [
            .font: nsView.font ?? font
        ]
        let str = NSAttributedString(string: text, attributes: attrs)
        let bounds = str.boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        )
        // +4 pt vertical padding to avoid clipping descenders
        return CGSize(width: width, height: ceil(bounds.height) + 4)
    }
}
