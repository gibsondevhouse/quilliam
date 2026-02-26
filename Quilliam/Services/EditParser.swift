import Foundation

// MARK: - Stream parser events

/// Events produced by `EditParser` from a raw token stream.
enum ParsedEvent: Sendable {
    /// Plain narrative / commentary text to append to the chat bubble.
    case token(String)
    /// A fully-parsed line-level edit operation ready to apply to the document.
    case editBlock(LineEdit)
}

// MARK: - Fence header

private enum EditMode {
    case replace(start: Int, end: Int)  // 0-based, end is exclusive upper bound
    case insertAfter(index: Int)         // 0-based
    case delete(start: Int, end: Int)   // 0-based, end is exclusive upper bound
}

// MARK: - Parser

/// Stateless parser namespace.  Takes a raw `AsyncThrowingStream<String, Error>`
/// from `OllamaService` and returns a typed `AsyncThrowingStream<ParsedEvent, Error>`.
///
/// ## Edit fence format (1-based, produced by the AI)
/// ```
/// ```edit line=N-M          → replace lines N..M (inclusive)
/// ```edit line=N            → replace line N
/// ```edit line=N+           → insert after line N  (0 = prepend)
/// ```edit line=N-M delete   → delete lines N..M
/// ```edit line=N delete     → delete line N
/// …replacement lines…
/// ```
/// ```
///
/// By convention, the AI should emit a closing triple-backtick on its own line.
enum EditParser {

    static func parse(
        _ input: AsyncThrowingStream<String, Error>
    ) -> AsyncThrowingStream<ParsedEvent, Error> {

        AsyncThrowingStream { continuation in
            Task {
                var lineBuffer = ""
                var inEditBlock = false
                var editMode: EditMode?
                var editLines: [String] = []

                func processLine(_ line: String) {
                    if inEditBlock {
                        if line == "```" {
                            // Closing fence — emit the parsed edit
                            inEditBlock = false
                            if let mode = editMode {
                                let edit = buildLineEdit(mode: mode, lines: editLines)
                                continuation.yield(.editBlock(edit))
                            }
                            editMode = nil
                            editLines = []
                        } else {
                            editLines.append(line)
                        }
                    } else {
                        if line.hasPrefix("```edit ") {
                            let spec = String(line.dropFirst("```edit ".count))
                            if let parsed = parseHeader(spec) {
                                inEditBlock = true
                                editMode = parsed
                                editLines = []
                            } else {
                                // Unrecognised fence — treat as regular text
                                continuation.yield(.token(line + "\n"))
                            }
                        } else {
                            continuation.yield(.token(line + "\n"))
                        }
                    }
                }

                do {
                    for try await token in input {
                        lineBuffer += token
                        // Drain all complete lines from the buffer
                        while let nlIndex = lineBuffer.firstIndex(of: "\n") {
                            let line = String(lineBuffer[lineBuffer.startIndex ..< nlIndex])
                            lineBuffer = String(lineBuffer[lineBuffer.index(after: nlIndex)...])
                            processLine(line)
                        }
                    }
                    // Flush any trailing partial line
                    if !lineBuffer.isEmpty {
                        if inEditBlock {
                            // Stream ended mid-block — treat remaining content as deleted
                            editLines.append(lineBuffer)
                        } else {
                            continuation.yield(.token(lineBuffer))
                        }
                        lineBuffer = ""
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Header parsing

    /// Parse the spec portion after `\`\`\`edit ` (e.g. `"line=3-5"`, `"line=3+"`, `"line=2 delete"`).
    /// Returns `nil` if the format is unrecognised.
    private static func parseHeader(_ spec: String) -> EditMode? {
        var rest = spec.trimmingCharacters(in: .whitespaces)

        // Must start with "line="
        guard rest.hasPrefix("line=") else { return nil }
        rest = String(rest.dropFirst("line=".count))

        // Check for delete suffix
        let isDelete = rest.hasSuffix(" delete")
        if isDelete {
            rest = String(rest.dropLast(" delete".count))
        }

        // Check for insert (N+)
        if rest.hasSuffix("+") {
            let indexStr = String(rest.dropLast())
            guard let n = Int(indexStr), n >= 0 else { return nil }
            return .insertAfter(index: n - 1) // convert 1-based to 0-based
        }

        // Check for range (N-M) or single line (N)
        if let dashIndex = rest.firstIndex(of: "-") {
            let startStr = String(rest[rest.startIndex ..< dashIndex])
            let endStr   = String(rest[rest.index(after: dashIndex)...])
            guard let start = Int(startStr), let end = Int(endStr),
                  start >= 1, end >= start else { return nil }
            // Convert to 0-based exclusive range
            let s = start - 1
            let e = end      // end is inclusive 1-based → exclusive 0-based = end (no −1)
            return isDelete ? .delete(start: s, end: e) : .replace(start: s, end: e)
        } else {
            guard let line = Int(rest), line >= 1 else { return nil }
            let s = line - 1
            let e = line     // single line → exclusive upper bound = s + 1
            return isDelete ? .delete(start: s, end: e) : .replace(start: s, end: e)
        }
    }

    // MARK: - LineEdit construction

    private static func buildLineEdit(mode: EditMode, lines: [String]) -> LineEdit {
        switch mode {
        case .replace(let s, let e):
            return .replace(range: s ..< e, with: lines)
        case .insertAfter(let index):
            return .insert(index: index, lines: lines)
        case .delete(let s, let e):
            return .delete(range: s ..< e)
        }
    }
}
