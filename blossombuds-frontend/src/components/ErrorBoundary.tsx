import React from "react";
import logo from "../assets/BB_logo.png";

interface State {
  hasError: boolean;
  message: string | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: null, resetKey: 0 };

  private unhandledRejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;

  static getDerivedStateFromError(err: any): Partial<State> {
    const message =
      typeof err?.message === "string" && err.message.length < 200
        ? err.message
        : null;
    return { hasError: true, message };
  }

  componentDidMount() {
    this.unhandledRejectionHandler = (e: PromiseRejectionEvent) => {
      const message =
        typeof e.reason?.message === "string" && e.reason.message.length < 200
          ? e.reason.message
          : null;
      this.setState({ hasError: true, message });
    };
    window.addEventListener("unhandledrejection", this.unhandledRejectionHandler);
  }

  componentWillUnmount() {
    if (this.unhandledRejectionHandler) {
      window.removeEventListener("unhandledrejection", this.unhandledRejectionHandler);
    }
  }

  componentDidCatch(err: any, info: any) {
    console.error("[ErrorBoundary]", err, info);
  }

  // Incrementing resetKey forces React to remount children so a persistent
  // render error gets a clean slate rather than immediately re-throwing.
  handleReset = () => {
    this.setState((s) => ({ hasError: false, message: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (!this.state.hasError) return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );

    return (
      <>
        <style>{css}</style>
        <div className="eb-wrap" role="alert" aria-live="assertive">
          <div className="eb-card">
            <img src={logo} alt="Blossom & Buds" className="eb-logo" />

            <div className="eb-icon" aria-hidden="true">🌸</div>

            <h1 className="eb-title">Something went wrong</h1>
            <p className="eb-sub">
              An unexpected error occurred. Your cart and account are safe — this is just a display
              glitch.
            </p>

            {this.state.message && (
              <p className="eb-detail">{this.state.message}</p>
            )}

            <div className="eb-actions">
              <button className="eb-btn-primary" type="button" onClick={this.handleReset}>
                Try again
              </button>
              <a className="eb-btn-ghost" href="/">
                Go to homepage
              </a>
            </div>

            <p className="eb-hint">
              If this keeps happening,{" "}
              <a href="/contact" className="eb-link">
                contact us
              </a>{" "}
              and we'll sort it out.
            </p>
          </div>
        </div>
      </>
    );
  }
}

const css = `
.eb-wrap {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bb-bg, #fdf8f2);
  padding: 24px 16px;
  box-sizing: border-box;
}

.eb-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.10);
  padding: 40px 32px 36px;
  max-width: 460px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.eb-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
  margin-bottom: 20px;
}

.eb-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
  filter: drop-shadow(0 4px 12px rgba(240, 93, 139, 0.18));
}

.eb-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 900;
  color: var(--bb-primary, #1a1a2e);
  font-family: "DM Serif Display", Georgia, serif;
}

.eb-sub {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--bb-primary, #1a1a2e);
  opacity: 0.78;
  max-width: 340px;
}

.eb-detail {
  margin: 0 0 20px;
  font-size: 12px;
  font-family: monospace;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  color: #b0003a;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: left;
}

.eb-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 20px;
  width: 100%;
}

.eb-btn-primary {
  height: 42px;
  padding: 0 20px;
  border-radius: 12px;
  border: none;
  background: var(--bb-accent, #f05d8b);
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(240, 93, 139, 0.30);
  transition: transform 0.1s ease, box-shadow 0.18s ease;
}
.eb-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(240, 93, 139, 0.38);
}
.eb-btn-primary:active { transform: none; }

.eb-btn-ghost {
  height: 42px;
  padding: 0 20px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: #fff;
  color: var(--bb-primary, #1a1a2e);
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.eb-btn-ghost:hover {
  background: #f9f9f9;
  border-color: rgba(0, 0, 0, 0.20);
}

.eb-hint {
  margin: 0;
  font-size: 12px;
  opacity: 0.65;
  color: var(--bb-primary, #1a1a2e);
}

.eb-link {
  color: var(--bb-accent, #f05d8b);
  font-weight: 800;
  text-decoration: none;
}
.eb-link:hover { text-decoration: underline; }
`;
