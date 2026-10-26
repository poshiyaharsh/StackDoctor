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

      {/* 4. AI EXPLANATIONS (DISABLED) */}
      {activeTab === "ai" && (
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>AI Explanations</h2>
              <span style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem", borderRadius: "9999px", backgroundColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                Coming Later
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-bg-alt)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                🔒 Strict Offline & Privacy Guarantee
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                StackDoctor is built on 100% deterministic rules with zero reliance on cloud LLMs. We never send your code, repository URLs, or environment variables to external AI providers.
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.5rem", lineHeight: 1.6 }}>
                Future versions will support optional, self-hosted, local models (such as Ollama) with explicit opt-in confirmation.
              </p>
            </div>

            <div style={{ opacity: 0.5, pointerEvents: "none" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem" }}>
                <input type="checkbox" disabled checked={false} />
                <span>Enable experimental local LLM explanations (Disabled)</span>
              </label>
            </div>
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
