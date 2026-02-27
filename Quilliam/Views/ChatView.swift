import SwiftUI

struct ChatView: View {
    @Bindable var viewModel: ChatViewModel

    @State private var showCloudConfirmation = false
    @State private var anthropicKeyInput = ""
    @State private var tavilyKeyInput = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubbleView(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
                // Also scroll while tokens stream in: count stays fixed but content grows.
                // `scrollTo` is cheap — just a scroll position update, not a layout pass.
                .onChange(of: viewModel.messages.last?.content) { _, _ in
                    if viewModel.isLoading, let last = viewModel.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.yellow)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.windowBackgroundColor))
            }

            Divider()

            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    Picker("Model", selection: $viewModel.selectedModel) {
                        ForEach(viewModel.availableModels, id: \.self) { model in
                            Text(model).tag(model)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 140)
                    .help("Select Ollama model for Local mode")

                    Picker("Mode", selection: $viewModel.executionMode) {
                        ForEach(AIExecutionMode.allCases, id: \.self) { mode in
                            Text(mode.displayName).tag(mode)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 160)
                    .help("Local is default. Cloud/deep research require explicit confirmation per send.")

                    TextField("Message…", text: $viewModel.inputText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1 ... 5)
                        .onSubmit {
                            sendTapped()
                        }

                    Button {
                        sendTapped()
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isLoading)
                    .help("Send message")
                }

                if viewModel.executionMode != .local {
                    cloudSettingsStrip
                }

                if viewModel.executionMode == .deepResearch {
                    researchStrip
                }
            }
            .padding()
        }
        .frame(minWidth: 400, minHeight: 300)
        .alert("Use Cloud Mode?", isPresented: $showCloudConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Proceed") {
                Task { await viewModel.sendMessage() }
            }
        } message: {
            Text(cloudConfirmationCopy)
        }
        .task {
            await viewModel.refreshResearchRuns()
        }
    }

    @ViewBuilder
    private var cloudSettingsStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Cloud Keys")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Label(viewModel.hasAnthropicKey() ? "Anthropic set" : "Anthropic missing", systemImage: viewModel.hasAnthropicKey() ? "checkmark.seal" : "xmark.seal")
                    .font(.caption2)
                    .foregroundStyle(viewModel.hasAnthropicKey() ? .green : .orange)

                Label(viewModel.hasTavilyKey() ? "Tavily set" : "Tavily missing", systemImage: viewModel.hasTavilyKey() ? "checkmark.seal" : "xmark.seal")
                    .font(.caption2)
                    .foregroundStyle(viewModel.hasTavilyKey() ? .green : .orange)

                Spacer()
            }

            HStack(spacing: 8) {
                SecureField("Anthropic key", text: $anthropicKeyInput)
                    .textFieldStyle(.roundedBorder)
                Button("Save") {
                    do {
                        try viewModel.saveAnthropicKey(anthropicKeyInput)
                        anthropicKeyInput = ""
                    } catch {
                        viewModel.errorMessage = error.localizedDescription
                    }
                }
                .disabled(anthropicKeyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Remove") {
                    do {
                        try viewModel.removeAnthropicKey()
                    } catch {
                        viewModel.errorMessage = error.localizedDescription
                    }
                }
            }

            HStack(spacing: 8) {
                SecureField("Tavily key", text: $tavilyKeyInput)
                    .textFieldStyle(.roundedBorder)
                Button("Save") {
                    do {
                        try viewModel.saveTavilyKey(tavilyKeyInput)
                        tavilyKeyInput = ""
                    } catch {
                        viewModel.errorMessage = error.localizedDescription
                    }
                }
                .disabled(tavilyKeyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Remove") {
                    do {
                        try viewModel.removeTavilyKey()
                    } catch {
                        viewModel.errorMessage = error.localizedDescription
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var researchStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Deep Research Runs")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Refresh") {
                    Task { await viewModel.refreshResearchRuns() }
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }

            if viewModel.researchRuns.isEmpty {
                Text("No runs yet.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.researchRuns.prefix(3), id: \.id) { run in
                    Text("• \(run.status.rawValue.replacingOccurrences(of: "_", with: " ")) · \(run.phase.rawValue) · \(run.query)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
    }

    private var cloudConfirmationCopy: String {
        switch viewModel.executionMode {
        case .assistedCloud:
            return "This send will use Anthropic via your BYO API key. Proceed?"
        case .deepResearch:
            return "This send will start a deep research run with hard budget caps and citation requirements. Proceed?"
        case .local:
            return ""
        }
    }

    private func sendTapped() {
        switch viewModel.executionMode {
        case .local:
            Task { await viewModel.sendMessage() }
        case .assistedCloud, .deepResearch:
            showCloudConfirmation = true
        }
    }
}
