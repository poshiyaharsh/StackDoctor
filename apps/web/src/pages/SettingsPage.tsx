import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api, ApiTokenItem } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { Modal } from "../components/ui/Modal.js";
import { Tabs } from "../components/ui/Tabs.js";
import { useToast } from "../components/ui/Toast.js";

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("tokens");

  // API Tokens state
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [newGeneratedToken, setNewGeneratedToken] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Retention state
  const [retentionDays, setRetentionDays] = useState<number>(user?.retentionDays ?? 90);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AI Settings state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>("anthropic");
  const [aiModel, setAiModel] = useState<string>("");
  const [aiApiKey, setAiApiKey] = useState<string>("");
  const [aiHasKey, setAiHasKey] = useState(false);
  const [, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiDeletingKey, setAiDeletingKey] = useState(false);

  const loadAiSettings = async () => {
    try {
      setAiLoading(true);
      const settings = await api.ai.getSettings();
      setAiEnabled(settings.enabled);
      setAiProvider(settings.provider || "anthropic");
      setAiModel(settings.model || "");
      setAiHasKey(settings.hasKey);
    } catch {
      // Ignore load error
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAiSaving(true);
      const res = await api.ai.updateSettings({
        enabled: aiEnabled,
        provider: aiProvider,
        model: aiModel.trim() || undefined,
        apiKey: aiApiKey.trim() || undefined
      });
      setAiEnabled(res.enabled);
      setAiProvider(res.provider);
      setAiModel(res.model || "");
      setAiHasKey(res.hasKey);
      setAiApiKey("");
      showToast("AI settings updated successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update AI settings", "error");
    } finally {
      setAiSaving(false);
    }
  };

  const handleDeleteAiKey = async () => {
    try {
      setAiDeletingKey(true);
      const res = await api.ai.deleteKey();
      setAiHasKey(res.hasKey);
      setAiApiKey("");
      showToast("API key removed from database", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove API key", "error");
    } finally {
      setAiDeletingKey(false);
    }
  };

  // Load tokens
  const loadTokens = async () => {
    try {
      setTokensLoading(true);
      const data = await api.tokens.list();
      setTokens(data.tokens || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load API tokens", "error");
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
    loadAiSettings();
  }, []);

  useEffect(() => {
    if (user?.retentionDays !== undefined) {
      setRetentionDays(user.retentionDays);
    }
  }, [user]);

  // Handle Token Creation
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) return;

    try {
      setCreatingToken(true);
      const res = await api.tokens.create(tokenName.trim());
      setNewGeneratedToken(res.token);
      setTokenName("");
      await loadTokens();
      showToast("API token created successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create token", "error");
    } finally {
      setCreatingToken(false);
    }
  };

  // Handle Token Revocation
  const handleRevokeToken = async (id: string) => {
    try {
      setRevokingId(id);
      await api.tokens.revoke(id);
      await loadTokens();
      showToast("Token revoked successfully", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to revoke token", "error");
    } finally {
      setRevokingId(null);
    }
  };

  // Handle Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 12) {
      setPasswordMsg({ text: "New password must be at least 12 characters long.", error: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "New passwords do not match.", error: true });
      return;
    }

    try {
      setPasswordLoading(true);
      await api.auth.changePassword({ currentPassword, newPassword });
      setPasswordMsg({ text: "Password changed successfully.", error: false });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated successfully", "success");
    } catch (err) {
      setPasswordMsg({
        text: err instanceof Error ? err.message : "Failed to update password",
        error: true
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Retention Preference Save
  const handleSaveRetention = async () => {
    try {
      setRetentionSaving(true);
      await api.auth.updatePreferences(retentionDays);
      await refreshUser();
      showToast("Retention preferences updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save preferences", "error");
    } finally {
      setRetentionSaving(false);
    }
  };

  // Handle Manual Retention Cleanup
  const handleRunCleanup = async () => {
    try {
      setCleanupRunning(true);
      const res = await api.auth.triggerRetentionCleanup();
      showToast(
        res.deletedRuns > 0
          ? `Cleanup completed: deleted ${res.deletedRuns} expired report(s).`
          : "Cleanup completed: no expired reports to remove.",
        "info"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to trigger cleanup", "error");
    } finally {
      setCleanupRunning(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError("Password is required to delete account");
      return;
    }

    try {
      setDeletingAccount(true);
      setDeleteError(null);
      await api.auth.deleteAccount(deletePassword);
      await logout();
      navigate("/register");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      showToast("Copied to clipboard", "success");
    } catch {
      // Fallback
    }
  };

  const tabItems = [
    { id: "tokens", label: "API Tokens" },
    { id: "profile", label: "Profile & Password" },
    { id: "retention", label: "Data Retention" },
    { id: "ai", label: "AI Explanations" },
    { id: "danger", label: "Danger Zone" }
  ];

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem", maxWidth: "900px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Settings
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
          Manage your account credentials, CLI API tokens, and diagnostic retention policies
        </p>
      </div>

      <Tabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} />

      {/* 1. API TOKENS TAB */}
      {activeTab === "tokens" && (
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>CLI API Tokens</h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  Authenticate the StackDoctor CLI for uploading local environment diagnostic runs
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNewGeneratedToken(null);
                  setCreateModalOpen(true);
                }}
              >
                + Generate New Token
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {tokensLoading ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Loading tokens...</p>
            ) : tokens.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--color-text-muted)" }}>
                <p style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: "0.25rem" }}>No active API tokens</p>
                <p style={{ fontSize: "0.875rem" }}>Generate an API token to use with `stackdoctor login` in your terminal.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>Name</th>
                      <th style={{ padding: "0.75rem" }}>Prefix</th>
                      <th style={{ padding: "0.75rem" }}>Created</th>
                      <th style={{ padding: "0.75rem" }}>Last Used</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((tok) => (
                      <tr key={tok.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>{tok.name}</td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                          {tok.prefix}...
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                          {new Date(tok.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                          {tok.lastUsedAt ? new Date(tok.lastUsedAt).toLocaleDateString() : "Never"}
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={revokingId === tok.id}
                            onClick={() => handleRevokeToken(tok.id)}
                          >
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* 2. PROFILE & PASSWORD TAB */}
      {activeTab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Profile Information</h2>
            </CardHeader>
            <CardBody>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", maxWidth: "600px" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "block", marginBottom: "0.25rem" }}>Full Name</label>
                  <p style={{ fontWeight: 600 }}>{user?.displayName}</p>
                </div>
                <div>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "block", marginBottom: "0.25rem" }}>Email Address</label>
                  <p style={{ fontWeight: 600 }}>{user?.email}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Change Password</h2>
            </CardHeader>
            <CardBody>
              {passwordMsg ? (
                <div
                  role="alert"
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1rem",
                    backgroundColor: passwordMsg.error ? "var(--color-danger-subtle)" : "var(--color-success-subtle)",
                    color: passwordMsg.error ? "var(--color-danger-text)" : "var(--color-success-text)",
                    fontSize: "0.875rem"
                  }}
                >
                  {passwordMsg.text}
                </div>
              ) : null}

              <form onSubmit={handlePasswordChange} style={{ maxWidth: "420px" }}>
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  label="New Password (min 12 chars)"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" loading={passwordLoading}>
                  Update Password
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 3. DATA RETENTION TAB */}
      {activeTab === "retention" && (
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Report Retention Policy</h2>
          </CardHeader>
          <CardBody>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
              Configure how long diagnostic reports are retained in your account before automatic cleanup. StackDoctor will automatically prune reports older than this threshold.
            </p>

            <div style={{ maxWidth: "400px", marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Retention Period
              </label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="form-input"
                style={{ width: "100%", marginBottom: "1rem" }}
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days (6 Months)</option>
                <option value={365}>365 Days (1 Year)</option>
                <option value={0}>Indefinite (Keep all reports)</option>
              </select>

              <Button
                variant="primary"
                loading={retentionSaving}
                onClick={handleSaveRetention}
              >
                Save Preferences
              </Button>
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Manual Cleanup
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                Trigger immediate deletion of reports exceeding your configured retention period.
              </p>
              <Button
                variant="secondary"
                size="sm"
                loading={cleanupRunning}
                onClick={handleRunCleanup}
              >
                Run Retention Cleanup Now
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 4. AI EXPLANATIONS */}
      {activeTab === "ai" && (
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🤖</span>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>AI Diagnostic Explanations</h2>
              </div>
              <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem", borderRadius: "9999px", backgroundColor: aiEnabled ? "rgba(16, 185, 129, 0.15)" : "var(--color-bg-secondary)", color: aiEnabled ? "var(--color-success)" : "var(--color-text-muted)", fontWeight: 600 }}>
                {aiEnabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {/* Privacy notice banner */}
            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                🔒 Strict Privacy & Grounding Guarantees
              </p>
              <ul style={{ paddingLeft: "1.25rem", margin: 0, fontSize: "0.875rem", color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: "0.375rem", lineHeight: 1.5 }}>
                <li><strong>Only sanitized report data is sent:</strong> Extracted evidence items, rule IDs, and host OS. Source code, repositories, environment secrets, and personal tokens are never transmitted.</li>
                <li><strong>Keys encrypted at rest:</strong> Your BYOK key is encrypted using AES-256-GCM with a unique IV and authentication tag. It is write-only and never logged or returned by any endpoint.</li>
                <li><strong>Zero unsolicited calls:</strong> Explanations are strictly triggered on demand when you click "Explain with AI".</li>
                <li><strong>Deterministic fallback:</strong> If AI is disabled or unconfigured, StackDoctor deterministically generates rule-based explanations without network calls.</li>
              </ul>
            </div>

            <form onSubmit={handleSaveAiSettings}>
              {/* Enable / Disable Switch */}
              <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <label htmlFor="ai-enabled-toggle" style={{ fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>
                    Enable AI Explanations
                  </label>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    Allow generating contextual root cause analyses and remediation checklists.
                  </p>
                </div>
                <input
                  id="ai-enabled-toggle"
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  style={{ width: "1.25rem", height: "1.25rem", cursor: "pointer" }}
                />
              </div>

              {/* Provider Selection */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                    fontSize: "0.875rem"
                  }}
                >
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="ollama">Ollama / Local OpenAI-Compatible Server</option>
                </select>
              </div>

              {/* Model Override */}
              <div style={{ marginBottom: "1.25rem" }}>
                <Input
                  label="Model Identifier (Optional)"
                  placeholder={aiProvider === "anthropic" ? "claude-3-5-sonnet-20241022" : aiProvider === "openai" ? "gpt-4o" : "llama3:latest"}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  helperText="Leave empty to use provider defaults."
                />
              </div>

              {/* BYOK API Key Input */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Bring Your Own API Key (BYOK)
                  </label>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: aiHasKey ? "var(--color-success)" : "var(--color-text-muted)" }}>
                    {aiHasKey ? "● Key Configured (Encrypted at Rest)" : "○ No Key Stored"}
                  </span>
                </div>

                <Input
                  type="password"
                  placeholder={aiHasKey ? "Enter new key to overwrite existing encrypted key" : "Paste API key (e.g. sk-ant-... or sk-proj-...)"}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  helperText="Write-only field. Your key is encrypted at rest using AES-256-GCM and never exposed to the browser."
                />

                {aiHasKey && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      loading={aiDeletingKey}
                      onClick={handleDeleteAiKey}
                    >
                      Delete Stored API Key
                    </Button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="primary"
                  loading={aiSaving}
                >
                  Save AI Settings
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* 5. DANGER ZONE TAB */}
      {activeTab === "danger" && (
        <Card style={{ borderColor: "var(--color-danger)" }}>
          <CardHeader>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-danger-text)" }}>
              Danger Zone
            </h2>
          </CardHeader>
          <CardBody>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)", marginBottom: "1rem" }}>
              Permanently delete your account and all associated data, including all projects, diagnostic run histories, and API tokens.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteError(null);
                setDeletePassword("");
                setDeleteModalOpen(true);
              }}
            >
              Delete Account
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Token Creation / Single Plain Display Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewGeneratedToken(null);
        }}
        title={newGeneratedToken ? "Save Your API Token" : "Generate API Token"}
      >
        {newGeneratedToken ? (
          <div>
            <div
              style={{
                padding: "0.75rem 1rem",
                backgroundColor: "var(--color-warning-subtle)",
                color: "var(--color-warning-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                marginBottom: "1rem"
              }}
            >
              ⚠️ <strong>Warning:</strong> This is the only time this token will ever be displayed. Copy it now and store it securely!
            </div>

            <div
              style={{
                backgroundColor: "var(--color-bg)",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.875rem",
                wordBreak: "break-all",
                marginBottom: "1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem"
              }}
            >
              <code>{newGeneratedToken}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(newGeneratedToken)}
              >
                Copy
              </Button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                onClick={() => {
                  setCreateModalOpen(false);
                  setNewGeneratedToken(null);
                }}
              >
                I Have Saved My Token
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateToken}>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
              Give this token a descriptive label (e.g. "Work Laptop CLI" or "GitHub Actions").
            </p>

            <Input
              label="Token Label"
              placeholder="e.g. MacBook Pro CLI"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              required
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={creatingToken}>
                Generate Token
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Permanently Delete Account?"
      >
        <p style={{ fontSize: "0.9375rem", color: "var(--color-text)", marginBottom: "0.75rem" }}>
          Are you sure you want to delete your account?
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--color-danger-text)", marginBottom: "1rem" }}>
          This action will immediately delete your user profile, all registered projects, diagnostic run logs, and active API tokens. This cannot be undone.
        </p>

        {deleteError ? (
          <div
            role="alert"
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--color-danger-subtle)",
              color: "var(--color-danger-text)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.875rem",
              marginBottom: "1rem"
            }}
          >
            {deleteError}
          </div>
        ) : null}

        <Input
          label="Enter your current password to confirm"
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="••••••••••••"
          required
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deletingAccount}
            onClick={handleDeleteAccount}
          >
            Permanently Delete My Account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
