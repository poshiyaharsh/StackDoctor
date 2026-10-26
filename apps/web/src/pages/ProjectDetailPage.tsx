import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ProjectItem, DiagnosticRunItem } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [runs, setRuns] = useState<DiagnosticRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadProject() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.projects.get(id);
        if (mounted) {
          setProject(data.project);
          setRuns(data.recentRuns || []);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load project details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProject();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await api.projects.delete(id);
      navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadgeVariant = (status: string): "success" | "danger" | "warning" | "default" => {
    if (status === "passed" || status === "completed") return "success";
    if (status === "failed") return "danger";
    if (status === "warning" || status === "completed_with_warnings") return "warning";
    return "default";
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        <p>Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <div
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger-text)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem"
          }}
        >
          {error || "Project not found"}
        </div>
        <Link to="/projects" className="btn btn-secondary btn-sm">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link to="/projects" style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          ← Back to Projects
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            {project.name}
          </h1>
          {project.repositoryUrl ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Repository: {project.repositoryUrl}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem" }}>
            {project.detectedTechnologies.map((t) => (
              <Badge key={t} variant="info">{t}</Badge>
            ))}
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteModalOpen(true)}
        >
          Delete Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Diagnostic Run History</h2>
        </CardHeader>
        <CardBody>
          {runs.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No diagnostic runs yet for this project"
              description="Execute `stackdoctor upload` inside this project's folder to upload your first scan."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem" }}>Run ID</th>
                    <th style={{ padding: "0.75rem" }}>Status</th>
                    <th style={{ padding: "0.75rem" }}>OS</th>
                    <th style={{ padding: "0.75rem" }}>Findings</th>
                    <th style={{ padding: "0.75rem" }}>Date</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                        {r.id.slice(0, 8)}...
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <Badge variant={getStatusBadgeVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                        {r.operatingSystem}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {Array.isArray(r.findings) ? r.findings.length : 0}
                      </td>
                      <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        <Link to={`/reports/${r.id}`} className="btn btn-secondary btn-sm">
                          View Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Project?"
      >
        <p style={{ fontSize: "0.9375rem", color: "var(--color-text)", marginBottom: "1rem" }}>
          Are you sure you want to delete <strong>{project.name}</strong>?
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--color-danger-text)", marginBottom: "1.5rem" }}>
          Warning: This action will permanently delete all diagnostic runs and history associated with this project. This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Yes, Delete Project
          </Button>
        </div>
      </Modal>
    </div>
  );
}
