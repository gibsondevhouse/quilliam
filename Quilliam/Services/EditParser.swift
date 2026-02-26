import Foundation

// MARK: - Stream parser events

/// Target entity for an edit block.
/// `.activeDocument` means the currently open `Document`; the others target
/// world-building entities by name/key.
enum FileTarget: Sendable, Equatable {
    case activeDocument
    case character(name: String)
    case location(name: String)
    case world(key: String)

    /// Stable string key that matches `fileTargetKey()` in the TypeScript layer.
    var key: String {
        switch self {
        case .activeDocument:         return "__active__"
        case .character(let n):       return "character:\(n)"
        case .location(let n):        return "location:\(n)"
        case .world(let k):           return "world:\(k)"
        }
    }
}

/// Events produced by `EditParser` from a raw token stream.
enum ParsedEvent: Sendable {
    /// Plain narrative / commentary text to append to the chat bubble.
    case token(String)
    /// A fully-parsed line-level edit operation ready to apply to a document.
    case editBlock(LineEdit, fileTarget: FileTarget)
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
                var currentFileTarget: FileTarget = .activeDocument
                var editLines: [String] = []

                func processLine(_ line: String) {
                    if inEditBlock {
                        if line.trimmingCharacters(in: .whitespaces) == "```" {
                            // Closing fence — emit the parsed edit
                            inEditBlock = false
                            if let mode = editMode {
                                let edit = buildLineEdit(mode: mode, lines: editLines)
                                continuation.yield(.editBlock(edit, fileTarget: currentFileTarget))
                            }
                            editMode = nil
                            editLines = []
                            currentFileTarget = .activeDocument
                        } else {
                            editLines.append(line)
                        }
                    } else {
                        if line.hasPrefix("```edit") {
                            let spec = String(line.dropFirst("```edit".count)).trimmingCharacters(in: .whitespaces)
                            if let parsed = parseHeader(spec) {
                                inEditBlock = true
                                editMode = parsed.mode
                                currentFileTarget = parsed.target
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
                            editLines.append(lineBuffer)
                        } else {
                            continuation.yield(.token(lineBuffer))
                        }
                        lineBuffer = ""
                    }

                    // Recover from unclosed fences by emitting the collected edit.
                    if inEditBlock, let mode = editMode, !editLines.isEmpty {
                        continuation.yield(.editBlock(buildLineEdit(mode: mode, lines: editLines), fileTarget: currentFileTarget))
                    } else if inEditBlock {
                        let recovered = editLines.joined(separator: "\n")
                        if !recovered.isEmpty {
                            continuation.yield(.token(recovered))
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Header parsing

    /// Parse the spec portion after `\`\`\`edit ` (e.g. `"line=3-5"`, `"line=3+"`, `"line=2 delete file=character:Elena"`).
    /// Returns `nil` if the format is unrecognised.
    private static func parseHeader(_ spec: String) -> (mode: EditMode, target: FileTarget)? {
        var rest = spec.trimmingCharacters(in: .whitespaces)

        // ── Extract optional file= qualifier ─────────────────────────────
        var target: FileTarget = .activeDocument
        if let fileRange = rest.range(of: #"\bfile=(\S+)"#, options: .regularExpression) {
            let rawValue = String(rest[fileRange]).replacingOccurrences(of: "file=", with: "")
            rest = rest.replacingCharacters(in: fileRange, with: "").trimmingCharacters(in: .whitespaces)
            if rawValue.hasPrefix("character:") {
                target = .character(name: String(rawValue.dropFirst("character:".count)))
            } else if rawValue.hasPrefix("location:") {
                target = .location(name: String(rawValue.dropFirst("location:".count)))
            } else if rawValue.hasPrefix("world:") {
                target = .world(key: String(rawValue.dropFirst("world:".count)))
            }
        }

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
            return (.insertAfter(index: n - 1), target) // convert 1-based to 0-based
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
            let mode: EditMode = isDelete ? .delete(start: s, end: e) : .replace(start: s, end: e)
            return (mode, target)
        } else {
            guard let line = Int(rest), line >= 1 else { return nil }
            let s = line - 1
            let e = line     // single line → exclusive upper bound = s + 1
            let mode: EditMode = isDelete ? .delete(start: s, end: e) : .replace(start: s, end: e)
            return (mode, target)
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
