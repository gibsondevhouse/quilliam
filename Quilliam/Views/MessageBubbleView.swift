import SwiftUI
import AppKit

struct MessageBubbleView: View {
    let message: Message

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 60) }

            if isUser {
                // User messages are short and never streamed — SwiftUI Text is fine.
                Text(message.content.isEmpty ? "…" : message.content)
                    .textSelection(.enabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.accentColor)
                    .foregroundStyle(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                // Assistant messages can stream hundreds of lines.
                // NSTextView patches only the changed range — keeps CPU < 24%
                // vs SwiftUI Text's ~49% at 50+ lines (JuniperPhoton benchmark).
                StreamingTextView(
                    text: message.content.isEmpty ? "…" : message.content,
                    foregroundColor: .labelColor
                )
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}
