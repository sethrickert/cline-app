import { Check, Copy, File, Folder, Image as ImageIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Account, Attachment, Message } from "../types";
import { BrandMark } from "./BrandMark";
import { ProfileAvatar } from "./ProfileAvatar";
import thinkingAnimation from "../assets/thinking.svg";

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.kind === "folder" ? Folder : attachment.kind === "image" ? ImageIcon : File;
  return (
    <div className="attachment-card"><Icon size={19} /><span><strong>{attachment.name}</strong><small>{attachment.detail}</small></span></div>
  );
}

const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => (
          <div className="code-shell">
            <div className="code-toolbar"><span>TypeScript</span><button onClick={() => { void navigator.clipboard.writeText(String(content)); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div>
            <pre>{children}</pre>
          </div>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

function formatDuration(value?: number) {
  if (value === undefined) return undefined;
  if (value < 1_000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1_000)}s`;
}

const MessageView = memo(function MessageView({ message, account, showTimestamp }: { message: Message; account: Account; showTimestamp: boolean }) {
  const [copied, setCopied] = useState(false);
  if (message.role === "system") return <div className="system-message">{message.content}</div>;
  const assistant = message.role === "assistant";
  const duration = formatDuration(message.completedInMs);
  const copyMessage = () => {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <article className={`message ${assistant ? "assistant" : "user"}`}>
      <div className={`message-avatar ${assistant ? "assistant-avatar" : "user-avatar"}`}>
        {assistant ? <BrandMark size={27} /> : <ProfileAvatar photoUrl={account.photoUrl} fallback={account.avatar || "Y"} />}
      </div>
      <div className="message-content">
        <div className="message-meta"><strong>{assistant ? "Cline" : "You"}</strong>{showTimestamp ? <time>{message.createdAt}</time> : null}</div>
        <div className={`message-card ${message.error ? "error" : ""}`}>
          <div className="message-body">{assistant ? <MarkdownMessage content={message.content} /> : <p className="user-copy">{message.content}</p>}</div>
          {message.attachments?.length ? <div className="attachment-list">{message.attachments.map((attachment) => <AttachmentCard key={attachment.id} attachment={attachment} />)}</div> : null}
        </div>
        {message.streaming ? <div className="thinking-state"><strong>Thinking</strong><img src={thinkingAnimation} alt="" /></div> : null}
        {!message.streaming && message.content ? <div className="message-actions"><button onClick={copyMessage}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>{duration ? <span>Completed in {duration}</span> : null}</div> : null}
      </div>
    </article>
  );
});

export function ChatMessages({ messages, account, showTimestamps }: { messages: Message[]; account: Account; showTimestamps: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);
  return (
    <main className="chat-scroll" aria-live="polite">
      <div className="message-column">
        {messages.map((message) => <MessageView key={message.id} message={message} account={account} showTimestamp={showTimestamps} />)}
        <div ref={endRef} />
      </div>
    </main>
  );
}
