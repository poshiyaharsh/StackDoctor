import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Input } from "../components/ui/Input.js";
import { Button } from "../components/ui/Button.js";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/Card.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 4rem)",
        padding: "2rem 1rem"
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Sign in to StackDoctor
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            Access your uploaded diagnostic runs and projects
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Welcome back</h2>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardBody>
              {error ? (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "var(--color-danger-subtle)",
                    color: "var(--color-danger-text)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                    marginBottom: "1rem"
                  }}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                Sign in
              </Button>
            </CardBody>

            <CardFooter style={{ textAlign: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Don't have an account? </span>
              <Link to="/register">Create an account</Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
