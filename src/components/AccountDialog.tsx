import { Check, Copy, ExternalLink, ImagePlus, LogOut, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { Account } from "../types";
import { BrandMark } from "./BrandMark";
import { ProfileAvatar } from "./ProfileAvatar";

export function AccountDialog({
  open, account, busy, error, deviceCode, onSignIn, onSignOut, onChangePhoto, onClose,
}: {
  open: boolean;
  account: Account;
  busy: boolean;
  error?: string;
  deviceCode?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onChangePhoto: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="dialog-close" aria-label="Close account" onClick={onClose}><X size={18} /></button>
        <div className="account-brand"><BrandMark size={42} /><h2 id="account-title">{account.signedIn ? "Your Cline account" : "Sign in to Cline"}</h2><p>{account.signedIn ? "Models, balance, and account details are loaded directly from Cline." : "Connect your Cline account in a secure browser window to load the models available to you."}</p></div>
        {account.signedIn ? <>
          <div className="account-profile"><ProfileAvatar photoUrl={account.photoUrl} fallback={account.avatar} size="large" /><span><strong>{account.name}</strong><small>{account.email}</small></span><ShieldCheck size={19} /></div>
          <button className="photo-action" onClick={onChangePhoto}><ImagePlus size={15} />Choose local profile picture</button>
          <div className="account-stats"><span><small>Plan</small><strong>{account.plan || "Cline"}</strong></span><span><small>Credit balance</small><strong>{account.credits === undefined ? "Unavailable" : `$${account.credits.toFixed(2)}`}</strong></span></div>
          <button className="secondary-action" onClick={onSignOut}><LogOut size={16} />Sign out</button>
        </> : <>
          {deviceCode ? <div className="device-code-panel"><span>Confirm this code in your browser</span><div><strong>{deviceCode}</strong><button aria-label="Copy device code" onClick={() => { void navigator.clipboard.writeText(deviceCode); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div><small>Keep this window open while Cline completes sign-in.</small></div> : <button className="primary-action" disabled={busy} onClick={onSignIn}>{busy ? "Opening browser…" : "Continue in browser"}<ExternalLink size={16} /></button>}
          <p className="account-security"><ShieldCheck size={15} />Authentication is completed securely in your default browser.</p>
        </>}
        {error ? <p className="dialog-error">{error}</p> : null}
      </section>
    </div>
  );
}
