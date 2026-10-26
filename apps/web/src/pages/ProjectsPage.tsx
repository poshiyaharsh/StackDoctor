import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ProjectItem } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.projects.list();
        if (mounted) setProjects(data.projects || []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load projects.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Projects
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
            Repositories and local codebases registered with StackDoctor
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--color-text-muted)" }}>
          <p>Loading projects...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger-text)",
            borderRadius: "var(--radius-md)",
            marginBottom: "2rem"
          }}
        >
          {error}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="📁"
              title="No projects registered yet"
              description="Projects are automatically created when you upload a report with `stackdoctor upload` from any project folder."
              action={
                <Link to="/dashboard" className="btn btn-secondary btn-sm">
                  View Setup Instructions
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {projects.map((proj) => (
            <Card key={proj.id} style={{ display: "flex", flexDirection: "column" }}>
              <CardHeader>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{proj.name}</h2>
                </div>
              </CardHeader>
              <CardBody style={{ flex: 1 }}>
                {proj.repositoryUrl ? (
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    🔗 {proj.repositoryUrl}
                  </p>
                ) : null}

                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  {proj.detectedTechnologies.length > 0 ? (
                    proj.detectedTechnologies.map((tech) => (
                      <Badge key={tech} variant="info">
                        {tech}
                      </Badge>
                    ))
                  ) : (
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                      General project
                    </span>
                  )}
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  Created on {new Date(proj.createdAt).toLocaleDateString()}
                </p>
              </CardBody>
              <div
                style={{
                  padding: "0.75rem 1.25rem",
                  borderTop: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-bg-alt)",
                  display: "flex",
                  justifyContent: "flex-end"
                }}
              >
                <Link to={`/projects/${proj.id}`} className="btn btn-secondary btn-sm">
                  View Runs & Details →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
