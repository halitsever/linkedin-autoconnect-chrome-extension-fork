import { createPubSub } from "create-pubsub";
import { usePubSub } from "create-pubsub/react";
import { useState, useRef, useEffect } from "react";
import { render } from "react-dom";
import {
  getMaximumAutoConnectionsPerSession,
  loadOptions,
  maximumAutoConnectionsPerSessionStorePubSub,
} from "./shared";
import "./styles.css";

const [emitOptionsSubmitted, onOptionsSubmitted] = createPubSub();


function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OptionsPage() {
  const [maximumAutoConnectionsPerSession, setMaximumAutoConnectionsPerSession] = usePubSub(
    maximumAutoConnectionsPerSessionStorePubSub
  );
  const [draft, setDraft] = useState(maximumAutoConnectionsPerSession);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(maximumAutoConnectionsPerSession);
  }, [maximumAutoConnectionsPerSession]);

  function save() {
    const v = Math.max(1, Math.min(1000, parseInt(draft, 10) || 1));
    const vStr = String(v);
    setMaximumAutoConnectionsPerSession(vStr);
    setDraft(vStr);
    emitOptionsSubmitted();
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="options-page">
      <div className="options-card">
        <div className="options-head">
          <img
            src="../../images/icon128.png"
            width={32}
            height={32}
            style={{ borderRadius: 7, display: "block", flexShrink: 0, boxShadow: "0 1px 2px rgba(10,102,194,0.35)" }}
            alt=""
          />
          <h1 className="options-title">LinkedIn AutoConnect</h1>
        </div>
        <p className="options-desc">Manage how the extension behaves while it runs.</p>
        <div className="opt-divider" />
        <label className="field-label" htmlFor="omax">Maximum auto-connections per session</label>
        <div className="num-row">
          <input
            id="omax"
            className="num-input"
            type="number"
            min="1"
            max="1000"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <p className="field-hint">Automatically stops connecting after reaching this value.</p>
        <div className="settings-actions">
          <button className="btn btn-primary btn-inline" onClick={save}>Save options</button>
          <span className={`saved-flag${saved ? " show" : ""}`}>
            <CheckIcon /> Saved
          </span>
        </div>
      </div>
    </div>
  );
}

(async () => {
  onOptionsSubmitted(async () => {
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set(
        { maximumAutoConnectionsPerSession: getMaximumAutoConnectionsPerSession() },
        resolve
      );
    });
  });

  await loadOptions();

  render(<OptionsPage />, document.body.appendChild(document.createElement("div")));
})();
