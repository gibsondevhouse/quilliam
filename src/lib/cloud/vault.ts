import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";

export type CloudProvider = "anthropic" | "tavily";

export interface CloudApiKeys {
  anthropicApiKey?: string;
  tavilyApiKey?: string;
}

interface VaultProviders {
  anthropic: boolean;
  tavily: boolean;
}

interface VaultFile {
  version: 1;
  salt: string;
  iterations: number;
  iv: string;
  authTag: string;
  ciphertext: string;
  providers: VaultProviders;
  updatedAt: number;
}

interface UnlockedSession {
  key: Buffer;
  keys: CloudApiKeys;
  unlockedAt: number;
}

const VAULT_FILE =
  process.env.QUILLIAM_CLOUD_VAULT_FILE ??
  path.join(process.cwd(), ".quilliam-cloud-vault.json");

export const CLOUD_SESSION_COOKIE = "quilliam_cloud_session";

const ITERATIONS = 210_000;
const DIGEST = "sha256";
const KEY_BYTES = 32;

const unlockedSessions = new Map<string, UnlockedSession>();

function deriveKey(passphrase: string, saltB64: string, iterations: number): Buffer {
  return pbkdf2Sync(passphrase, Buffer.from(saltB64, "base64"), iterations, KEY_BYTES, DIGEST);
}

function normalizeProviderFlags(keys: CloudApiKeys): VaultProviders {
  return {
    anthropic: Boolean(keys.anthropicApiKey),
    tavily: Boolean(keys.tavilyApiKey),
  };
}

function encryptPayload(keys: CloudApiKeys, key: Buffer): Pick<VaultFile, "iv" | "authTag" | "ciphertext" | "providers"> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(JSON.stringify(keys), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    providers: normalizeProviderFlags(keys),
  };
}

function decryptPayload(file: VaultFile, key: Buffer): CloudApiKeys {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.iv, "base64"));
  decipher.setAuthTag(Buffer.from(file.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(file.ciphertext, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as CloudApiKeys;
}

async function readVaultFile(): Promise<VaultFile | null> {
  try {
    const raw = await fs.readFile(VAULT_FILE, "utf8");
    const parsed = JSON.parse(raw) as VaultFile;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeVaultFile(file: VaultFile): Promise<void> {
  await fs.mkdir(path.dirname(VAULT_FILE), { recursive: true });
  await fs.writeFile(VAULT_FILE, JSON.stringify(file, null, 2), "utf8");
}

function redactKeyState(keys: CloudApiKeys): VaultProviders {
  return normalizeProviderFlags(keys);
}

export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  providers: VaultProviders;
  updatedAt?: number;
}

export async function getVaultStatus(sessionId?: string | null): Promise<VaultStatus> {
  const file = await readVaultFile();
  const session = sessionId ? unlockedSessions.get(sessionId) : undefined;

  if (!file) {
    return {
      initialized: false,
      unlocked: Boolean(session),
      providers: session ? redactKeyState(session.keys) : { anthropic: false, tavily: false },
    };
  }

  return {
    initialized: true,
    unlocked: Boolean(session),
    providers: session ? redactKeyState(session.keys) : file.providers,
    updatedAt: file.updatedAt,
  };
}

export async function initVault(passphrase: string): Promise<VaultStatus> {
  const trimmed = passphrase.trim();
  if (!trimmed) {
    throw new Error("Passphrase is required to initialize the cloud vault.");
  }

  const existing = await readVaultFile();
  if (existing) {
    return {
      initialized: true,
      unlocked: false,
      providers: existing.providers,
      updatedAt: existing.updatedAt,
    };
  }

  const salt = randomBytes(16).toString("base64");
  const key = deriveKey(trimmed, salt, ITERATIONS);
  const encrypted = encryptPayload({}, key);

  const file: VaultFile = {
    version: 1,
    salt,
    iterations: ITERATIONS,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertext: encrypted.ciphertext,
    providers: encrypted.providers,
    updatedAt: Date.now(),
  };

  await writeVaultFile(file);

  return {
    initialized: true,
    unlocked: false,
    providers: file.providers,
    updatedAt: file.updatedAt,
  };
}

export async function unlockVault(passphrase: string): Promise<{ sessionId: string; status: VaultStatus }> {
  const file = await readVaultFile();
  if (!file) {
    throw new Error("Cloud vault is not initialized. Initialize it first.");
  }

  const key = deriveKey(passphrase, file.salt, file.iterations);
  let keys: CloudApiKeys;
  try {
    keys = decryptPayload(file, key);
  } catch {
    throw new Error("Invalid passphrase for cloud vault.");
  }

  const sessionId = randomUUID();
  unlockedSessions.set(sessionId, {
    key,
    keys,
    unlockedAt: Date.now(),
  });

  return {
    sessionId,
    status: {
      initialized: true,
      unlocked: true,
      providers: redactKeyState(keys),
      updatedAt: file.updatedAt,
    },
  };
}

export function lockVaultSession(sessionId?: string | null): void {
  if (!sessionId) return;
  unlockedSessions.delete(sessionId);
}

export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(CLOUD_SESSION_COOKIE)?.value ?? null;
}

export function getUnlockedSession(sessionId?: string | null): UnlockedSession | null {
  if (!sessionId) return null;
  return unlockedSessions.get(sessionId) ?? null;
}

export function requireUnlockedSession(request: NextRequest): { sessionId: string; session: UnlockedSession } {
  const sessionId = getSessionIdFromRequest(request);
  const session = getUnlockedSession(sessionId);
  if (!sessionId || !session) {
    throw new Error("Cloud vault is locked. Unlock the vault to use cloud features.");
  }
  return { sessionId, session };
}

async function persistSessionKeys(sessionId: string): Promise<void> {
  const session = unlockedSessions.get(sessionId);
  if (!session) throw new Error("Vault session not found.");

  const file = await readVaultFile();
  if (!file) throw new Error("Cloud vault is not initialized.");

  const encrypted = encryptPayload(session.keys, session.key);
  const nextFile: VaultFile = {
    ...file,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertext: encrypted.ciphertext,
    providers: encrypted.providers,
    updatedAt: Date.now(),
  };

  await writeVaultFile(nextFile);
}

export async function putProviderKey(
  sessionId: string,
  provider: CloudProvider,
  apiKey: string,
): Promise<VaultStatus> {
  const session = unlockedSessions.get(sessionId);
  if (!session) throw new Error("Vault session not found.");

  if (provider === "anthropic") {
    session.keys.anthropicApiKey = apiKey.trim();
  } else {
    session.keys.tavilyApiKey = apiKey.trim();
  }

  await persistSessionKeys(sessionId);
  const status = await getVaultStatus(sessionId);
  return status;
}

export async function deleteProviderKey(
  sessionId: string,
  provider: CloudProvider,
): Promise<VaultStatus> {
  const session = unlockedSessions.get(sessionId);
  if (!session) throw new Error("Vault session not found.");

  if (provider === "anthropic") {
    delete session.keys.anthropicApiKey;
  } else {
    delete session.keys.tavilyApiKey;
  }

  await persistSessionKeys(sessionId);
  const status = await getVaultStatus(sessionId);
  return status;
}

export function getSessionKeys(sessionId: string): CloudApiKeys | null {
  const session = unlockedSessions.get(sessionId);
  if (!session) return null;
  return { ...session.keys };
}
