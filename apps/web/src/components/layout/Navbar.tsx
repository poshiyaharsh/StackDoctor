import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { Button } from "../ui/Button.js";

export function Navbar() {
  const { user, isAuthenticated, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="nav-header">
      <div className="container nav-container">
        <Link to="/" className="nav-logo">
          <span>🩺</span>
          <span>StackDoctor</span>
          <span className="nav-logo-badge">OSS</span>
        </Link>

        <div className="nav-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </Button>

          <a
            href="https://github.com/poshiyaharsh/StackDoctor"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            GitHub
          </a>

          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn btn-ghost btn-sm">
                Dashboard
              </Link>
              <Link to="/projects" className="btn btn-ghost btn-sm">
                Projects
              </Link>
              <Link to="/settings" className="btn btn-ghost btn-sm">
                Settings
              </Link>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                {user?.displayName}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
