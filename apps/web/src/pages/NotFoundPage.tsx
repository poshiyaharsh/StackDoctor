import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button.js";

export function NotFoundPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        textAlign: "center",
        padding: "2rem"
      }}
    >
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔍</div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>404</h1>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        Page Not Found
      </h2>
      <p style={{ color: "var(--color-text-dim)", maxWidth: "450px", marginBottom: "2rem" }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary">Return to Home</Button>
      </Link>
    </div>
  );
}
