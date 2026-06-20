import { Link } from "react-router-dom";
import logo from "../assets/BB_logo.png";
import Seo from "../components/Seo";

export default function NotFoundPage() {
  return (
    <div className="nf-wrap">
      <Seo title="Page not found • Blossom & Buds" />
      <style>{css}</style>

      <div className="nf-card">
        <img src={logo} alt="Blossom & Buds" className="nf-logo" />

        <div className="nf-bloom" aria-hidden="true">🌺</div>

        <p className="nf-code">404</p>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-sub">
          The page you're looking for has moved, been removed, or never existed.
          Let's get you back to something beautiful.
        </p>

        <div className="nf-actions">
          <Link to="/" className="nf-btn-primary">
            Go to homepage
          </Link>
          <Link to="/categories" className="nf-btn-ghost">
            Browse flowers
          </Link>
        </div>
      </div>
    </div>
  );
}

const css = `
.nf-wrap {
  min-height: 60dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bb-bg, #fdf8f2);
  padding: 40px 16px;
  box-sizing: border-box;
}

.nf-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.09);
  padding: 44px 36px 40px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nf-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
  margin-bottom: 20px;
}

.nf-bloom {
  font-size: 52px;
  line-height: 1;
  margin-bottom: 12px;
  filter: drop-shadow(0 4px 14px rgba(240, 93, 139, 0.20));
}

.nf-code {
  margin: 0 0 6px;
  font-size: 72px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, var(--bb-accent, #f05d8b), var(--bb-accent-2, #f6c320));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: "DM Serif Display", Georgia, serif;
}

.nf-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 900;
  color: var(--bb-primary, #1a1a2e);
  font-family: "DM Serif Display", Georgia, serif;
}

.nf-sub {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--bb-primary, #1a1a2e);
  opacity: 0.75;
  max-width: 340px;
}

.nf-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.nf-btn-primary {
  height: 42px;
  padding: 0 22px;
  border-radius: 12px;
  background: var(--bb-accent, #f05d8b);
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  box-shadow: 0 12px 28px rgba(240, 93, 139, 0.28);
  transition: transform 0.1s ease, box-shadow 0.18s ease;
}
.nf-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 36px rgba(240, 93, 139, 0.36);
}
.nf-btn-primary:active { transform: none; }

.nf-btn-ghost {
  height: 42px;
  padding: 0 22px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: #fff;
  color: var(--bb-primary, #1a1a2e);
  font-weight: 900;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.nf-btn-ghost:hover {
  background: #f9f9f9;
  border-color: rgba(0, 0, 0, 0.20);
}
`;
