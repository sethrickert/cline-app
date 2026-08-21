import { BarChart3, Check, ChevronDown, Edit3, MoreHorizontal, Share2, Star, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useEffect, useRef, useState } from "react";
import type { ModelOption, Usage } from "../types";

export function ChatHeader({
  title,
  models,
  modelId,
  usage,
  signedIn,
  onModelChange,
  onSignIn,
  onShare,
  onRename,
  onDelete,
  onManageModels,
  favoriteModelIds,
  onToggleFavorite,
}: {
  title: string;
  models: ModelOption[];
  modelId: string;
  usage: Usage;
  signedIn: boolean;
  onModelChange: (modelId: string) => void;
  onSignIn: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  onManageModels: () => void;
  favoriteModelIds: string[];
  onToggleFavorite: (modelId: string) => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = models.find((model) => model.id === modelId) ?? models[0];
  const favoriteModels = useMemo(() => models.filter((model) => favoriteModelIds.includes(model.id)), [favoriteModelIds, models]);
  const otherModels = useMemo(() => models.filter((model) => !favoriteModelIds.includes(model.id)), [favoriteModelIds, models]);

  const modelRow = (model: ModelOption) => (
    <div className="model-row" key={model.id}>
      <button className="model-choice" onClick={() => { onModelChange(model.id); setModelOpen(false); }}>
        <span><strong>{model.label}{model.tier ? <em className={`model-tier ${model.tier}`}>{model.tier}</em> : null}</strong><small>{model.provider} · {(model.contextWindow / 1000).toFixed(0)}K context{model.supportsVision ? " · Vision" : ""}</small></span>
        {model.id === modelId ? <Check size={16} className="accent-icon" /> : null}
      </button>
      <button className={`favorite-button ${favoriteModelIds.includes(model.id) ? "active" : ""}`} aria-label={`${favoriteModelIds.includes(model.id) ? "Remove" : "Add"} ${model.label} ${favoriteModelIds.includes(model.id) ? "from" : "to"} favorites`} onClick={() => onToggleFavorite(model.id)}><Star size={15} fill={favoriteModelIds.includes(model.id) ? "currentColor" : "none"} /></button>
    </div>
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setModelOpen(false);
        setUsageOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  return (
    <header className="chat-header" ref={wrapRef}>
      <h1>{title}</h1>
      <div className="chat-header-actions">
        <div className="popover-anchor">
          <button className="model-select" onClick={() => { if (!signedIn) { onSignIn(); return; } setModelOpen((value) => !value); setUsageOpen(false); setMenuOpen(false); }}>
            <span>{signedIn ? selected?.label ?? "Choose a model" : "Sign in to choose a model"}</span><ChevronDown size={15} />
          </button>
          {modelOpen ? (
            <div className="popover model-menu">
              <div className="popover-heading"><strong>Models for your account</strong><small>Loaded from Cline after sign-in</small></div>
              <div className="model-menu-scroll">
                {favoriteModels.length ? <><div className="model-section-label"><Star size={12} />Favorites</div>{favoriteModels.map(modelRow)}<div className="model-section-label">All models</div></> : null}
                {otherModels.map(modelRow)}
              </div>
              {models.length ? null : <p className="model-menu-empty">No models were returned for this account.</p>}
              <button className="manage-models" onClick={() => { setModelOpen(false); onManageModels(); }}>Account and model details</button>
            </div>
          ) : null}
        </div>
        <div className="popover-anchor">
          <button className="usage-button" onClick={() => { setUsageOpen((value) => !value); setModelOpen(false); setMenuOpen(false); }}>
            <BarChart3 size={16} /><span>Usage</span><strong>{usage.contextPercent}%</strong>
            <span className="mini-progress"><i style={{ width: `${usage.contextPercent}%` }} /></span>
          </button>
          {usageOpen ? (
            <div className="popover usage-menu">
              <div className="popover-heading"><strong>Conversation usage</strong><small>Current session</small></div>
              <div className="usage-stat"><span>Input tokens</span><strong>{usage.inputTokens.toLocaleString()}</strong></div>
              <div className="usage-stat"><span>Output tokens</span><strong>{usage.outputTokens.toLocaleString()}</strong></div>
              <div className="usage-stat"><span>Estimated cost</span><strong>${usage.totalCost.toFixed(2)}</strong></div>
              <div className="usage-context"><span>Context window</span><strong>{usage.contextPercent}%</strong><i><b style={{ width: `${usage.contextPercent}%` }} /></i></div>
            </div>
          ) : null}
        </div>
        <div className="popover-anchor">
          <button className="icon-button" aria-label="Conversation menu" onClick={() => { setMenuOpen((value) => !value); setModelOpen(false); setUsageOpen(false); }}><MoreHorizontal size={18} /></button>
          {menuOpen ? <div className="popover conversation-menu">
            <button onClick={() => { onShare(); setMenuOpen(false); }}><Share2 size={15} />Share</button>
            <button onClick={() => { onRename(); setMenuOpen(false); }}><Edit3 size={15} />Rename</button>
            <button className="danger" onClick={() => { onDelete(); setMenuOpen(false); }}><Trash2 size={15} />Delete conversation</button>
          </div> : null}
        </div>
      </div>
    </header>
  );
}
