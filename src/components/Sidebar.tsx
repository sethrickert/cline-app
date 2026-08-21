import { ChevronDown, Edit3, MessageCircle, MoreHorizontal, Pin, PinOff, Plus, Search, Settings, Share2, Trash2, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Conversation } from "../types";
import { BrandMark } from "./BrandMark";
import { ProfileAvatar } from "./ProfileAvatar";

function relativeLabel(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(diff / 86_400_000));
  if (days === 0) return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  active,
  onSelect,
  onContextMenu,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, id: string) => void;
}) {
  return (
    <button className={`conversation-row ${active ? "active" : ""}`} onContextMenu={(event) => onContextMenu(event, conversation.id)} onClick={() => onSelect(conversation.id)}>
      <MessageCircle size={17} />
      <span>{conversation.title}</span>
      <time>{relativeLabel(conversation.updatedAt)}</time>
    </button>
  );
});

export function Sidebar({
  conversations,
  activeId,
  search,
  account,
  onSearch,
  onSelect,
  onNew,
  onSettings,
  onAccount,
  pinnedConversationIds,
  onPin,
  onRename,
  onDelete,
  onShare,
}: {
  conversations: Conversation[];
  activeId: string;
  search: string;
  account: Account;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  onAccount: () => void;
  pinnedConversationIds: string[];
  onPin: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number }>();
  const [todayOpen, setTodayOpen] = useState(true);
  const [previousOpen, setPreviousOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => {
    const visible = conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const previous: Conversation[] = [];
    for (const conversation of visible) {
      if (pinnedConversationIds.includes(conversation.id)) { pinned.push(conversation); continue; }
      Date.now() - new Date(conversation.updatedAt).getTime() < 86_400_000 ? today.push(conversation) : previous.push(conversation);
    }
    return { pinned, today, previous };
  }, [conversations, pinnedConversationIds, search]);

  useEffect(() => {
    const close = () => setContextMenu(undefined);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("blur", close); };
  }, []);

  const openContextMenu = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ id, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 180) });
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-name"><BrandMark size={32} /><strong>Cline Chat</strong></div>
        <button className="new-chat" onClick={onNew}><Plus size={18} /><span>New chat</span></button>
        <label className="search-box">
          <Search size={17} />
          <input ref={searchRef} aria-label="Search conversations" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search conversations" />
          {search ? <button type="button" aria-label="Clear search" onClick={() => { onSearch(""); searchRef.current?.focus(); }}><X size={14} /></button> : <kbd title="Focus conversation search">Ctrl+K</kbd>}
        </label>
      </div>
      <nav className="conversation-list" aria-label="Conversation history">
        {groups.pinned.length > 0 ? <section><div className="history-static-label"><Pin size={12} />Pinned</div>{groups.pinned.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={activeId === conversation.id} onSelect={onSelect} onContextMenu={openContextMenu} />)}</section> : null}
        {groups.today.length > 0 ? (
          <section>
            <button className="history-group-button" aria-expanded={todayOpen} onClick={() => setTodayOpen((value) => !value)}>Today <ChevronDown size={14} className={todayOpen ? "" : "collapsed"} /></button>
            {todayOpen ? groups.today.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={activeId === conversation.id} onSelect={onSelect} onContextMenu={openContextMenu} />) : null}
          </section>
        ) : null}
        {groups.previous.length > 0 ? (
          <section>
            <button className="history-group-button" aria-expanded={previousOpen} onClick={() => setPreviousOpen((value) => !value)}>Previous 7 days <ChevronDown size={14} className={previousOpen ? "" : "collapsed"} /></button>
            {previousOpen ? groups.previous.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={activeId === conversation.id} onSelect={onSelect} onContextMenu={openContextMenu} />) : null}
          </section>
        ) : null}
        {groups.pinned.length + groups.today.length + groups.previous.length === 0 ? <p className="empty-search">No conversations found</p> : null}
      </nav>
      <div className="sidebar-footer">
        <button className="account-row" onClick={onAccount}>
          <ProfileAvatar photoUrl={account.photoUrl} fallback={account.avatar} online={account.signedIn} />
          <span className="account-copy"><strong>{account.signedIn ? account.name : "Sign in"}</strong><small>{account.signedIn ? account.email : "Connect your Cline account"}</small></span>
          <MoreHorizontal size={17} />
        </button>
        <button className="icon-button" aria-label="Settings" onClick={onSettings}><Settings size={18} /></button>
      </div>
      {contextMenu ? <div className="conversation-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={() => { onPin(contextMenu.id); setContextMenu(undefined); }}>{pinnedConversationIds.includes(contextMenu.id) ? <PinOff size={15} /> : <Pin size={15} />}{pinnedConversationIds.includes(contextMenu.id) ? "Unpin" : "Pin"}</button>
        <button onClick={() => { onRename(contextMenu.id); setContextMenu(undefined); }}><Edit3 size={15} />Rename</button>
        <button onClick={() => { onShare(contextMenu.id); setContextMenu(undefined); }}><Share2 size={15} />Share</button>
        <button className="danger" onClick={() => { onDelete(contextMenu.id); setContextMenu(undefined); }}><Trash2 size={15} />Delete</button>
      </div> : null}
    </aside>
  );
}
