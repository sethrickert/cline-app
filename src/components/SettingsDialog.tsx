import { Check, Copy, ExternalLink, Github, Info, Link, Palette, RefreshCw, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccentId, Account, AppPreferences, SettingsSection, UpdateState } from "../types";
import { ACCENTS, normalizeHexColor, type ThemePreference } from "../lib/theme";
import { ProfileAvatar } from "./ProfileAvatar";
import { APP_VERSION } from "../lib/version";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>;
}

export function SettingsDialog({
  open, section, theme, account, preferences, updateState, onSectionChange, onThemeChange, onPreferencesChange,
  authBusy, authError, deviceCode, onSignIn, onSignOut, onChangePhoto, onEditPhoto, onSetPhotoUrl, onRemovePhoto, onCheckUpdates, onInstallUpdate, onOpenExternal, onClose,
}: {
  open: boolean;
  section: SettingsSection;
  theme: ThemePreference;
  account: Account;
  preferences: AppPreferences;
  updateState: UpdateState;
  onSectionChange: (section: SettingsSection) => void;
  onThemeChange: (theme: ThemePreference) => void;
  onPreferencesChange: (preferences: AppPreferences) => void;
  authBusy: boolean;
  authError?: string;
  deviceCode?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onChangePhoto: () => void;
  onEditPhoto: () => void;
  onSetPhotoUrl: (url: string) => void;
  onRemovePhoto: () => void;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
}) {
  const [customDraft, setCustomDraft] = useState(theme.customAccent.toUpperCase());
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  useEffect(() => setCustomDraft(theme.customAccent.toUpperCase()), [theme.customAccent]);
  if (!open) return null;
  const commitCustom = () => {
    const customAccent = normalizeHexColor(customDraft);
    if (customAccent) onThemeChange({ accentId: "custom", customAccent });
    else setCustomDraft(theme.customAccent.toUpperCase());
  };
  const selectPreset = (accentId: AccentId) => onThemeChange({ ...theme, accentId });
  const nav: { id: SettingsSection; label: string; icon: typeof Palette }[] = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "general", label: "General", icon: Settings2 },
    { id: "account", label: "Account", icon: UserRound },
    { id: "updates", label: "Updates", icon: RefreshCw },
    { id: "about", label: "About", icon: Info },
  ];
  const heading = {
    appearance: ["Appearance", "Make Cline Chat feel at home on your desktop."],
    general: ["General", "Choose how chat input and conversation details behave."],
    account: ["Account", "Manage your Cline connection and local profile photo."],
    updates: ["Updates", "Keep Cline Chat current through signed GitHub Releases."],
    about: ["About", "Open source, attribution, and project information."],
  }[section];
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <aside className="settings-nav">
          <div><h2 id="settings-title">Settings</h2>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`settings-nav-item ${section === id ? "active" : ""}`} onClick={() => onSectionChange(id)}><Icon size={17} />{label}</button>)}</div>
          <small>Cline Chat {APP_VERSION}</small>
        </aside>
        <div className="settings-content">
          <button className="dialog-close" aria-label="Close settings" onClick={onClose}><X size={18} /></button>
          <div className="settings-heading"><h3>{heading[0]}</h3><p>{heading[1]}</p></div>
          {section === "appearance" ? <>
            <div className="setting-row static-setting"><span><strong>Theme</strong><small>Cline Chat is intentionally dark-only.</small></span><span className="theme-value">Dark</span></div>
            <div className="setting-section">
              <div className="setting-title"><strong>Accent color</strong><small>Used for selections, progress, focus, and primary actions.</small></div>
              <div className="accent-grid">
                {(Object.entries(ACCENTS) as [Exclude<AccentId, "custom">, string][]).map(([id, color]) => <button key={id} className={theme.accentId === id ? "selected" : ""} onClick={() => selectPreset(id)} aria-label={`${id} accent`}><i style={{ background: color }}>{theme.accentId === id ? <Check size={17} /> : null}</i><span>{id}</span></button>)}
                <button className={theme.accentId === "custom" ? "selected custom-accent" : "custom-accent"} onClick={() => selectPreset("custom")} aria-label="Custom accent"><i style={{ background: theme.customAccent }}>{theme.accentId === "custom" ? <Check size={17} /> : null}</i><span>custom</span></button>
              </div>
              <label className="custom-color-row"><span><strong>Custom color</strong><small>Choose any six-digit color.</small></span><span className="color-input"><input aria-label="Custom color picker" type="color" value={theme.customAccent} onChange={(event) => { setCustomDraft(event.target.value.toUpperCase()); onThemeChange({ accentId: "custom", customAccent: event.target.value }); }} /><input className="hex-input" aria-label="Custom color hex value" value={customDraft} maxLength={7} onChange={(event) => setCustomDraft(event.target.value)} onBlur={commitCustom} onKeyDown={(event) => { if (event.key === "Enter") commitCustom(); }} /></span></label>
              <div className="accent-preview"><div className="preview-sidebar"><i /><i /><i /></div><div className="preview-main"><span>Accent preview</span><i><b /></i><button>Primary action</button></div></div>
            </div>
          </> : null}
          {section === "general" ? <div className="settings-stack">
            <div className="setting-row"><span><strong>Send with Enter</strong><small>Use Shift+Enter for a new line when enabled.</small></span><Toggle label="Send with Enter" checked={preferences.sendWithEnter} onChange={(sendWithEnter) => onPreferencesChange({ ...preferences, sendWithEnter })} /></div>
            <div className="setting-row"><span><strong>Show timestamps</strong><small>Display a time beside each message.</small></span><Toggle label="Show timestamps" checked={preferences.showTimestamps} onChange={(showTimestamps) => onPreferencesChange({ ...preferences, showTimestamps })} /></div>
            <div className="setting-row"><span><strong>Check for updates automatically</strong><small>Checks GitHub Releases when the app starts.</small></span><Toggle label="Automatic update checks" checked={preferences.autoCheckUpdates} onChange={(autoCheckUpdates) => onPreferencesChange({ ...preferences, autoCheckUpdates })} /></div>
            <div className="shortcut-card"><strong>Keyboard shortcuts</strong><span><kbd>Ctrl</kbd><kbd>S</kbd> Focus conversation search</span><span><kbd>Ctrl</kbd><kbd>,</kbd> Open settings</span><span><kbd>Esc</kbd> Close menus</span></div>
          </div> : null}
          {section === "account" ? <div className="settings-stack">
            <div className="settings-account-card"><ProfileAvatar photoUrl={account.photoUrl} fallback={account.avatar || "?"} crop={account.photoCrop} size="large" /><span><strong>{account.signedIn ? account.name : "Not connected"}</strong><small>{account.signedIn ? account.email : "Sign in to load your Cline models and account usage."}</small></span>{account.signedIn ? <button className="danger-inline" onClick={onSignOut}>Sign out</button> : <button className="primary-inline" disabled={authBusy} onClick={onSignIn}>{authBusy ? "Waiting…" : "Sign in"}</button>}</div>
            {deviceCode ? <div className="device-code-panel"><span>Confirm this code is shown in your browser</span><div><strong>{deviceCode}</strong><button aria-label="Copy activation code" onClick={() => void navigator.clipboard.writeText(deviceCode)}><Copy size={15} /></button></div><small>Complete sign-in in the browser. This page updates automatically.</small></div> : null}
            {authError ? <p className="dialog-error">{authError}</p> : null}
            <div className="setting-row"><span><strong>Profile picture</strong><small>Stored locally on this Windows device; it does not change your Cline account.</small></span><span className="inline-actions"><button onClick={onChangePhoto}>Choose image</button>{account.photoUrl ? <button onClick={onEditPhoto}>Crop</button> : null}{preferences.profilePhoto ? <button onClick={onRemovePhoto}>Remove</button> : null}</span></div>
            <div className="profile-url-row"><span><Link size={15} /><input aria-label="Profile image URL" type="url" placeholder="https://example.com/profile.png" value={photoUrlDraft} onChange={(event) => setPhotoUrlDraft(event.target.value)} /></span><button className="secondary-inline" disabled={!/^https:\/\//i.test(photoUrlDraft)} onClick={() => { onSetPhotoUrl(photoUrlDraft); setPhotoUrlDraft(""); }}>Preview and crop</button></div>
            {account.signedIn ? <div className="account-detail-grid"><span><small>Plan</small><strong>{account.plan || "Cline"}</strong></span><span><small>Credit balance</small><strong>{account.credits === undefined ? "Unavailable" : `$${account.credits.toFixed(2)}`}</strong></span><span><small>Organizations</small><strong>{account.organizations ?? 0}</strong></span></div> : null}
          </div> : null}
          {section === "updates" ? <div className="settings-stack">
            <div className="update-card"><span className={`update-icon ${updateState.available ? "available" : ""}`}><Sparkles size={22} /></span><div><strong>{updateState.available ? `Version ${updateState.version} is ready` : updateState.checking ? "Checking for updates…" : `Cline Chat ${updateState.currentVersion}`}</strong><small>{updateState.error || updateState.statusMessage || (updateState.available ? "A signed update is available from GitHub Releases." : updateState.lastChecked ? "You’re running the latest available version." : "Check GitHub Releases for a newer signed build.")}</small>{updateState.notes ? <p>{updateState.notes}</p> : null}</div></div>
            {updateState.installing ? <div className="update-progress"><i><b style={{ width: `${updateState.progress ?? 0}%` }} /></i><span>Installing… {updateState.progress ?? 0}%</span></div> : null}
            <div className="update-actions"><button className="secondary-action" disabled={updateState.checking || updateState.installing} onClick={onCheckUpdates}><RefreshCw size={16} className={updateState.checking ? "spin" : ""} />Check for updates</button>{updateState.available ? <button className="primary-action" disabled={updateState.installing} onClick={onInstallUpdate}>Download and install</button> : null}</div>
            <p className="settings-note">Updates are downloaded only from this project’s public GitHub Releases and verified with the app’s signing key before installation.</p>
          </div> : null}
          {section === "about" ? <div className="settings-stack about-stack">
            <div className="about-mark"><Sparkles size={24} /><span><strong>Cline Chat</strong><small>Version {APP_VERSION} · Windows only · Dark by design</small></span></div>
            <p>Cline Chat is free and open-source software created by Seth Rickert with development assistance from OpenAI Codex.</p>
            <button className="external-row" onClick={() => onOpenExternal("https://github.com/sethrickert/cline-app")}><Github size={18} /><span><strong>Source code and releases</strong><small>github.com/sethrickert/cline-app</small></span><ExternalLink size={15} /></button>
            <button className="external-row" onClick={() => onOpenExternal("https://cline.bot")}><Sparkles size={18} /><span><strong>Visit Cline</strong><small>The official Cline project and service</small></span><ExternalLink size={15} /></button>
            <div className="license-copy"><strong>Licensing and attribution</strong><p>Cline Chat is distributed under the MIT License. Cline and its SDK are separate projects distributed under the Apache License 2.0. This app is not an official Cline product.</p></div>
          </div> : null}
        </div>
      </section>
    </div>
  );
}
