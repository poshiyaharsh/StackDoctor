import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Input } from "../components/ui/Input.js";
import { Button } from "../components/ui/Button.js";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/Card.js";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
      <div style={{ width: "100%", maxWidth: "450px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Create an account
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            Get started with StackDoctor diagnostic dashboard
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Account details</h2>
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
                label="Full name or nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Lovelace"
                required
              />

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
                label="Password (min 12 characters)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
                helperText="Must be at least 12 characters long"
              />

              <Input
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                Create account
              </Button>
            </CardBody>

            <CardFooter style={{ textAlign: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Already have an account? </span>
              <Link to="/login">Sign in</Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
