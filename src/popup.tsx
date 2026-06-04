import { createPubSub } from "create-pubsub";
import { usePubSub } from "create-pubsub/react";
import { useState, useRef, useEffect } from "react";
import { render } from "react-dom";
import {
  LinkedInUrl,
  MessageId,
  emitChromePortConnected,
  getChromePort,
  loadOptions,
  maximumAutoConnectionsPerSessionStorePubSub,
  onChromePortConnected,
  onChromePortMessageReceived,
  postChromePortMessage,
  startListeningToChromePortMessages,
} from "./shared";
import "./styles.css";

const [emitStartButtonClicked, onStartButtonClicked] = createPubSub();
const [emitStopButtonClicked, onStopButtonClicked] = createPubSub();
const buttonClicksCountStorePubSub = createPubSub(0);
const [emitButtonClicksCountUpdated] = buttonClicksCountStorePubSub;
const isAutoConnectionRunningPubSub = createPubSub(false);
const [emitIsAutoConnectionRunning] = isAutoConnectionRunningPubSub;
const isActiveTabConnectedPubSub = createPubSub(false);
const [emitIsActiveTabConnected] = isActiveTabConnectedPubSub;

async function connectToActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    const port = chrome.tabs.connect(tab.id);
    emitChromePortConnected(port);
  }
}

function GearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BackIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 20c0-4 3.1-7 7-7s7 3 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 3.5c2 0 3.5 1.5 3.5 3.5S18 10.5 16 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 20c0-3.3-2-6-4.5-6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Ring({ count, max }: { count: number; max: number }) {
  const size = 176, stroke = 12, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(count / max, 1) : 0;
  const offset = c * (1 - frac);
  return (
    <div className="ring">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--li-blue)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .55s cubic-bezier(.22,.61,.36,1)" }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-num">{count}</div>
        <div className="ring-max">of {max}</div>
      </div>
    </div>
  );
}

function PageSelection() {
  return (
    <div className="page-selection-body">
      <p className="page-selection-hint">Open a LinkedIn page to start</p>
      <button className="btn btn-primary" onClick={() => chrome.tabs.create({ url: LinkedInUrl.MyNetworkPage })}>
        <PeopleIcon />
        People You May Know
      </button>
      <button className="btn btn-outline" onClick={() => chrome.tabs.create({ url: LinkedInUrl.SearchPeoplePage })}>
        <SearchIcon />
        Search People
      </button>
    </div>
  );
}

function MainView() {
  const [isAutoConnectionRunning] = usePubSub(isAutoConnectionRunningPubSub);
  const [buttonClicksCount] = usePubSub(buttonClicksCountStorePubSub);
  const [maximumAutoConnectionsPerSession] = usePubSub(maximumAutoConnectionsPerSessionStorePubSub);
  const max = Number(maximumAutoConnectionsPerSession);

  return (
    <div className="popup-body">
      <p className="stat-label">Invitations Sent</p>
      <div className="ring-wrap">
        <Ring count={buttonClicksCount} max={max} />
      </div>
      {isAutoConnectionRunning ? (
        <button className="btn btn-stop" onClick={() => emitStopButtonClicked()}>
          <span className="dot" />
          Stop connecting
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => emitStartButtonClicked()}>
          Start connecting
        </button>
      )}
    </div>
  );
}

function SettingsView() {
  const [maximumAutoConnectionsPerSession, setMaximumAutoConnectionsPerSession] = usePubSub(
    maximumAutoConnectionsPerSessionStorePubSub
  );
  const [draftMax, setDraftMax] = useState(maximumAutoConnectionsPerSession);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftMax(maximumAutoConnectionsPerSession);
  }, [maximumAutoConnectionsPerSession]);

  function saveSettings() {
    const v = Math.max(1, Math.min(1000, parseInt(draftMax, 10) || 1));
    const vStr = String(v);
    setMaximumAutoConnectionsPerSession(vStr);
    setDraftMax(vStr);
    chrome.storage.sync.set({ maximumAutoConnectionsPerSession: vStr });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="popup-body">
      <div className="settings-title">
        <GearIcon size={16} />
        Settings
      </div>
      <label className="field-label" htmlFor="pmax">Maximum auto-connections per session</label>
      <input
        id="pmax"
        className="num-input"
        type="number"
        min="1"
        max="1000"
        value={draftMax}
        onChange={(e) => setDraftMax(e.target.value)}
      />
      <p className="field-hint">Automatically stops connecting after reaching this value.</p>
      <div className="settings-actions">
        <button className="btn btn-primary btn-inline" onClick={saveSettings}>Save</button>
        <span className={`saved-flag${saved ? " show" : ""}`}>
          <CheckIcon /> Saved
        </span>
      </div>
    </div>
  );
}

function Popup() {
  const [isActiveTabConnected] = usePubSub(isActiveTabConnectedPubSub);
  const [view, setView] = useState<"main" | "settings">("main");

  return (
    <div className="popup">
      <div className="popup-head">
        <div className="brand">
          <img
            src="../../images/icon128.png"
            width={28}
            height={28}
            style={{ borderRadius: 6, display: "block", flexShrink: 0, boxShadow: "0 1px 2px rgba(10,102,194,0.35)" }}
            alt=""
          />
          <span className="brand-name">LinkedIn AutoConnect</span>
        </div>
        {isActiveTabConnected && (
          <button
            className={`icon-btn${view === "settings" ? " active" : ""}`}
            onClick={() => setView(view === "settings" ? "main" : "settings")}
            aria-label={view === "settings" ? "Back" : "Settings"}
          >
            {view === "settings" ? <BackIcon /> : <GearIcon />}
          </button>
        )}
      </div>

      {!isActiveTabConnected ? (
        <PageSelection />
      ) : view === "main" ? (
        <MainView />
      ) : (
        <SettingsView />
      )}
    </div>
  );
}

(async () => {
  onChromePortConnected(startListeningToChromePortMessages);

  onChromePortMessageReceived(({ message }) => {
    switch (message.id) {
      case MessageId.ConnectionEstablished:
        return emitIsActiveTabConnected(true);
      case MessageId.RunningStateUpdated:
        return emitIsAutoConnectionRunning(message.content);
      case MessageId.ButtonClicksCountUpdated:
        return emitButtonClicksCountUpdated(message.content);
    }
  });

  onStartButtonClicked(() => {
    const port = getChromePort();
    if (port) {
      postChromePortMessage({ message: { id: MessageId.StartAutoConnect }, port });
      emitIsAutoConnectionRunning(true);
    }
  });

  onStopButtonClicked(() => {
    const port = getChromePort();
    if (port) {
      postChromePortMessage({ message: { id: MessageId.StopAutoConnect }, port });
      emitIsAutoConnectionRunning(false);
    }
  });

  await loadOptions();
  await connectToActiveTab();

  render(<Popup />, document.body.appendChild(document.createElement("div")));
})();
