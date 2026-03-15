"use client";

import { Fragment, memo, useMemo, useState, useEffect, type ReactNode } from "react";
import { Pencil, Trash2, FileText, Download, Film, Music, MessageSquare, Code2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Message } from "@/db/schema";
import type { ReactionGroup, AttachmentWithUrl, ReadReceiptEntry } from "@/store/chatStore";

import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];
const FENCED_CODE_REGEX = /```([\w+-]*)\n?([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const RAW_URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]\}])/g;

type MessageSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string };

function splitMarkdownMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(FENCED_CODE_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, index) });
    }

    segments.push({
      type: "code",
      language: match[1] || undefined,
      value: match[2].replace(/\n$/, ""),
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

function renderLink(href: string, label: string, key: string, className: string) {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}

function renderLinks(text: string, keyPrefix: string, linkClassName: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const plainText = text.slice(lastIndex, index);
      nodes.push(...renderRawUrls(plainText, `${keyPrefix}-plain-${index}`, linkClassName));
    }

    nodes.push(
      renderLink(
        match[2],
        match[1],
        `${keyPrefix}-md-link-${index}`,
        linkClassName
      )
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderRawUrls(text.slice(lastIndex), `${keyPrefix}-tail`, linkClassName));
  }

  return nodes;
}

function renderRawUrls(text: string, keyPrefix: string, linkClassName: string): ReactNode[] {
  return text.split(RAW_URL_REGEX).map((part, index) => {
    if (!part) return null;

    if (part.match(RAW_URL_REGEX)) {
      return renderLink(part, part, `${keyPrefix}-raw-link-${index}`, linkClassName);
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
  });
}

/** Process bold, italic, strikethrough in a plain-text string (no inline code). */
function renderInlineFormatting(text: string, keyPrefix: string, linkClassName: string): ReactNode[] {
  // Combined regex: bold (**), strikethrough (~~), italic (* or _ but not mid-word _)
  const INLINE_FMT = /(\*\*(.+?)\*\*|~~(.+?)~~|(?<!\w)\*(.+?)\*(?!\w)|(?<!\w)_(.+?)_(?!\w))/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_FMT)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      nodes.push(...renderLinks(text.slice(lastIndex, idx), `${keyPrefix}-p-${idx}`, linkClassName));
    }

    const key = `${keyPrefix}-fmt-${idx}`;
    if (match[2] != null) {
      // bold
      nodes.push(<strong key={key}>{renderLinks(match[2], key, linkClassName)}</strong>);
    } else if (match[3] != null) {
      // strikethrough
      nodes.push(<s key={key}>{renderLinks(match[3], key, linkClassName)}</s>);
    } else {
      // italic (* or _)
      const content = match[4] ?? match[5] ?? "";
      nodes.push(<em key={key}>{renderLinks(content, key, linkClassName)}</em>);
    }

    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderLinks(text.slice(lastIndex), `${keyPrefix}-tail`, linkClassName));
  }

  return nodes;
}

const BULLET_RE = /^[-*] (.+)$/;
const ORDERED_RE = /^\d+\. (.+)$/;

/** Render a text segment, splitting into list blocks and inline-formatted paragraphs. */
function renderTextSegment(text: string, keyPrefix: string, isOwn: boolean): ReactNode[] {
  const linkClassName = isOwn
    ? "underline underline-offset-2 break-all text-primary-foreground/80 hover:text-primary-foreground"
    : "underline underline-offset-2 break-all text-primary hover:text-primary/80";

  const lines = text.split("\n");
  const result: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    // Check for bullet list
    if (BULLET_RE.test(lines[i])) {
      const items: ReactNode[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        const content = lines[i].match(BULLET_RE)![1];
        items.push(
          <li key={`${keyPrefix}-bli-${i}`} className="text-sm">
            {renderMarkdownText(content, `${keyPrefix}-bl-${i}`, isOwn)}
          </li>
        );
        i++;
      }
      result.push(
        <ul key={`${keyPrefix}-ul-${i}`} className="list-disc pl-4 space-y-0.5">
          {items}
        </ul>
      );
      continue;
    }

    // Check for ordered list
    if (ORDERED_RE.test(lines[i])) {
      const items: ReactNode[] = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        const content = lines[i].match(ORDERED_RE)![1];
        items.push(
          <li key={`${keyPrefix}-oli-${i}`} className="text-sm">
            {renderMarkdownText(content, `${keyPrefix}-ol-${i}`, isOwn)}
          </li>
        );
        i++;
      }
      result.push(
        <ol key={`${keyPrefix}-ol-${i}`} className="list-decimal pl-4 space-y-0.5">
          {items}
        </ol>
      );
      continue;
    }

    // Regular line — collect consecutive non-list lines
    const startI = i;
    const normalLines: string[] = [];
    while (i < lines.length && !BULLET_RE.test(lines[i]) && !ORDERED_RE.test(lines[i])) {
      normalLines.push(lines[i]);
      i++;
    }
    const joined = normalLines.join("\n");
    if (joined) {
      result.push(
        <Fragment key={`${keyPrefix}-txt-${startI}`}>
          {renderMarkdownText(joined, `${keyPrefix}-t-${startI}`, isOwn)}
        </Fragment>
      );
    } else {
      // Empty line (newline preserved by whitespace-pre-wrap)
      result.push(<Fragment key={`${keyPrefix}-nl-${startI}`}>{"\n"}</Fragment>);
    }
  }

  return result;
}

function renderMarkdownText(text: string, keyPrefix: string, isOwn: boolean): ReactNode[] {
  const linkClassName = isOwn
    ? "underline underline-offset-2 break-all text-primary-foreground/80 hover:text-primary-foreground"
    : "underline underline-offset-2 break-all text-primary hover:text-primary/80";

  return text.split(INLINE_CODE_REGEX).map((part, index) => {
    const key = `${keyPrefix}-inline-${index}`;

    if (index % 2 === 1) {
      return (
        <code
          key={key}
          className={`rounded-md px-1.5 py-0.5 font-mono text-[0.75rem] ${
            isOwn ? "bg-white/10 text-white/90" : "bg-muted border border-border text-foreground"
          }`}
        >
          {part}
        </code>
      );
    }

    return <Fragment key={key}>{renderInlineFormatting(part, key, linkClassName)}</Fragment>;
  });
}

function highlightCode(code: string, language?: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    // fallback to plain text
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

/** Map file extension → highlight.js language name */
const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  py: "python", pyw: "python",
  go: "go",
  rs: "rust",
  java: "java",
  html: "html", htm: "html", svg: "html",
  xml: "xml", xsl: "xml",
  css: "css", scss: "css", less: "css",
  json: "json", jsonc: "json",
  sh: "bash", bash: "bash", zsh: "bash",
  sql: "sql",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
  cs: "csharp",
  rb: "ruby", rake: "ruby",
  php: "php",
  yaml: "yaml", yml: "yaml",
  md: "markdown", mdx: "markdown",
  diff: "diff", patch: "diff",
};

/** MIME types that indicate code/text files */
const CODE_MIME_TYPES = new Set([
  "text/plain", "text/html", "text/css", "text/javascript", "text/csv", "text/markdown",
  "text/xml", "text/x-python",
  "application/javascript", "application/json", "application/xml",
  "application/x-yaml", "application/x-httpd-php", "application/x-sh", "application/x-python",
]);

function getLanguageFromFileName(fileName: string): string | undefined {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? EXT_TO_LANG[ext] : undefined;
}

function isCodeAttachment(mimeType: string, fileName: string): boolean {
  if (CODE_MIME_TYPES.has(mimeType)) return true;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return !!ext && ext in EXT_TO_LANG;
}

const MAX_PREVIEW_LINES = 12;

function CodePreview({ src, fileName, isOwn }: { src: string; fileName: string; isOwn: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!src) return;
    setLoading(true);
    setError(false);
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then((text) => { setCode(text); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [src]);

  const language = getLanguageFromFileName(fileName);
  const highlighted = useMemo(
    () => (code ? highlightCode(code, language) : ""),
    [code, language]
  );

  const lines = code?.split("\n") ?? [];
  const needsTruncation = lines.length > MAX_PREVIEW_LINES;
  const displayHtml = useMemo(() => {
    if (!code) return "";
    if (!needsTruncation || expanded) return highlighted;
    const truncated = lines.slice(0, MAX_PREVIEW_LINES).join("\n");
    return highlightCode(truncated, language);
  }, [code, highlighted, needsTruncation, expanded, lines, language]);

  if (loading) {
    return (
      <div className={`rounded-xl border border-border/60 overflow-hidden ${isOwn ? "bg-black/20" : "bg-muted/30"}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <svg className="w-3.5 h-3.5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-[0.65rem] text-muted-foreground">Loading preview…</span>
        </div>
      </div>
    );
  }

  if (error || !code) return null;

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden text-left">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Code2 className="w-3 h-3 text-muted-foreground" />
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground">
            {language ?? fileName.split(".").pop() ?? "code"}
          </span>
        </div>
        <span className="text-[0.55rem] text-muted-foreground">{lines.length} lines</span>
      </div>
      <pre className={`hljs overflow-x-auto px-3 py-2.5 text-[0.7rem] leading-relaxed ${
        isOwn ? "bg-black/20 text-white/90" : "bg-muted/30 text-foreground"
      }`}>
        <code
          className="font-mono whitespace-pre"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />
      </pre>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-border/60 bg-muted/30 text-[0.6rem] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

function renderMarkdownMessage(content: string, isOwn: boolean) {
  return splitMarkdownMessage(content).map((segment, index) => {
    if (segment.type === "code") {
      const highlighted = highlightCode(segment.value, segment.language);
      return (
        <div key={`code-${index}`} className="my-2 overflow-hidden rounded-xl border border-border/60 text-left">
          {segment.language && (
            <div className="border-b border-border/60 bg-muted/50 px-3 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground">
              {segment.language}
            </div>
          )}
          <pre className={`hljs overflow-x-auto px-3 py-2.5 text-[0.75rem] ${
            isOwn ? "bg-black/20 text-white/90" : "bg-muted/30 text-foreground"
          }`}>
            <code
              className="font-mono whitespace-pre"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        </div>
      );
    }

    return (
      <span key={`text-${index}`} className="whitespace-pre-wrap wrap-break-word">
        {renderTextSegment(segment.value, `segment-${index}`, isOwn)}
      </span>
    );
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) return <Film className="w-4 h-4 shrink-0" />;
  if (mimeType.startsWith("audio/")) return <Music className="w-4 h-4 shrink-0" />;
  return <FileText className="w-4 h-4 shrink-0" />;
}

function AttachmentGrid({
  attachments,
  isOwn,
  onMediaClick,
}: {
  attachments: AttachmentWithUrl[];
  isOwn: boolean;
  onMediaClick?: (src: string, mimeType: string, fileName: string) => void;
}) {
  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  const mediaFiles = files.filter(
    (a) => a.mimeType.startsWith("video/") || a.mimeType.startsWith("audio/")
  );
  const codeFiles = files.filter(
    (a) => !a.mimeType.startsWith("video/") && !a.mimeType.startsWith("audio/") && isCodeAttachment(a.mimeType, a.fileName)
  );
  const otherFiles = files.filter(
    (a) => !a.mimeType.startsWith("video/") && !a.mimeType.startsWith("audio/") && !isCodeAttachment(a.mimeType, a.fileName)
  );

  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((att) => (
            <button
              type="button"
              key={att.id}
              onClick={() => onMediaClick?.(att.signedUrl ?? "", att.mimeType, att.fileName)}
              className="block rounded-lg overflow-hidden cursor-pointer text-left"
            >
              <img
                src={att.signedUrl ?? ""}
                alt={att.fileName}
                loading="lazy"
                className="w-full max-h-64 object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            </button>
          ))}
        </div>
      )}
      {mediaFiles.length > 0 && (
        <div className="space-y-1">
          {mediaFiles.map((att) => (
            <button
              type="button"
              key={att.id}
              onClick={() => onMediaClick?.(att.signedUrl ?? "", att.mimeType, att.fileName)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer ${
                isOwn
                  ? "bg-white/10 hover:bg-white/20 text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted border border-border/40"
              }`}
            >
              <AttachmentFileIcon mimeType={att.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{att.fileName}</p>
                <p className={`text-[0.6rem] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {formatFileSize(att.fileSize)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {codeFiles.length > 0 && (
        <div className="space-y-1.5">
          {codeFiles.map((att) => (
            <div key={att.id}>
              <div className="flex items-center gap-2 px-2 py-1">
                <Code2 className={`w-3.5 h-3.5 shrink-0 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium truncate ${isOwn ? "text-primary-foreground" : "text-foreground"}`}>{att.fileName}</span>
                <span className={`text-[0.6rem] ${isOwn ? "text-primary-foreground/40" : "text-muted-foreground"}`}>{formatFileSize(att.fileSize)}</span>
                <a
                  href={att.signedUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  download={att.fileName}
                  onClick={(e) => e.stopPropagation()}
                  className={`ml-auto ${isOwn ? "text-primary-foreground/50 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"} transition-colors`}
                >
                  <Download className="w-3 h-3" />
                </a>
              </div>
              <CodePreview src={att.signedUrl ?? ""} fileName={att.fileName} isOwn={isOwn} />
            </div>
          ))}
        </div>
      )}
      {otherFiles.length > 0 && (
        <div className="space-y-1">
          {otherFiles.map((att) => (
            <a
              key={att.id}
              href={att.signedUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              download={att.fileName}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isOwn
                  ? "bg-white/10 hover:bg-white/20 text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted border border-border/40"
              }`}
            >
              <AttachmentFileIcon mimeType={att.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{att.fileName}</p>
                <p className={`text-[0.6rem] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {formatFileSize(att.fileSize)}
                </p>
              </div>
              <Download className="w-3.5 h-3.5 shrink-0 opacity-50" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  isOptimistic: boolean;
  isSameUser: boolean;
  parentMsg: Message | null;
  isHighlighted?: boolean;
  msgReactions?: ReactionGroup;
  attachments?: AttachmentWithUrl[];
  /** Non-null when THIS message is being edited; holds current edit text */
  editContent: string | null;
  /** True when any message in the list is in edit mode */
  isAnyEditing: boolean;
  isPickerOpen: boolean;
  userId: string;
  canWrite: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onEditContent: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleReaction: (emoji: string) => void;
  onSetPickerOpen: (open: boolean) => void;
  onReply: () => void;
  onJumpToMessage: (messageId: string) => void;
  onRetry?: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  /** Readers (other than the sender) who have seen this message */
  seenBy?: ReadReceiptEntry[];
  onMediaClick?: (src: string, mimeType: string, fileName: string) => void;
  replyCount?: number;
  onViewThread?: () => void;
}

function MessageBubble({
  msg,
  isOwn,
  isOptimistic,
  isSameUser,
  parentMsg,
  isHighlighted = false,
  msgReactions,
  attachments,
  editContent,
  isAnyEditing,
  isPickerOpen,
  userId,
  canWrite,
  onContextMenu,
  onEditContent,
  onSaveEdit,
  onCancelEdit,
  onToggleReaction,
  onSetPickerOpen,
  onReply,
  onJumpToMessage,
  onRetry,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  seenBy,
  onMediaClick,
  replyCount,
  onViewThread,
}: MessageBubbleProps) {
  const [deletePickerOpen, setDeletePickerOpen] = useState(false);
  const isFailed = msg.id.startsWith("failed-");
  const isEditing = editContent !== null;
  const isDeleted = !!msg.deletedAt;
  const isEdited = !!msg.editedAt && !isDeleted;

  const renderedContent = useMemo(
    () => renderMarkdownMessage(msg.content, isOwn),
    [msg.content, isOwn]
  );

  function handleDoubleClick() {
    if (!canWrite || isDeleted || isEditing) return;
    onReply();
  }

  return (
    <div
      className={`w-full flex ${isOwn ? "justify-end" : "justify-start"} ${
        isSameUser ? "mt-0.5" : "mt-4"
      } group relative px-3 py-0.5 rounded-xl transition-colors duration-200 ${
        isHighlighted ? "bg-primary/10 ring-1 ring-primary/20" : "bg-transparent"
      }`}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div className="max-w-[80%] md:max-w-[65%] relative">
        {/* Reply preview */}
        {parentMsg && (
          <button
            type="button"
            onClick={() => onJumpToMessage(parentMsg.id)}
            className={`text-[0.65rem] px-3 py-1.5 mb-1 rounded-t-lg flex items-center gap-1.5 border-l-2 border-primary/50 bg-muted/60 text-muted-foreground ${
              isOwn ? "ml-auto" : ""
            } hover:bg-muted transition-colors`}
            title="Jump to original message"
          >
            <span className="text-primary">↩</span>
            <span className="truncate max-w-50">
              {parentMsg.content.slice(0, 60)}{parentMsg.content.length > 60 ? "…" : ""}
            </span>
          </button>
        )}

        {/* Edit mode */}
        {isEditing ? (
          <div className="flex gap-2 items-center">
            <Input
              value={editContent}
              onChange={(e) => onEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="text-sm"
              autoFocus
            />
            <Button size="sm" onClick={onSaveEdit}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        ) : (
          <div
            className={`group/message relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-all duration-300 ease-in-out ${
              isOwn
                ? `bg-primary text-primary-foreground rounded-br-sm shadow-sm shadow-primary/20 ${
                    isFailed ? "opacity-60" : isOptimistic ? "optimistic-pulse" : ""
                  }`
                : "bg-card border border-border rounded-bl-sm shadow-sm"
            } ${isDeleted ? "opacity-40 italic" : ""}`}
          >
            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <div className={msg.content ? "mb-1.5" : ""}>
                <AttachmentGrid attachments={attachments} isOwn={isOwn} onMediaClick={onMediaClick} />
              </div>
            )}

            <div className="flex items-end gap-1.5">
              <div className="space-y-1 min-w-0">
                {msg.content
                  ? renderedContent
                  : !attachments?.length && !isDeleted
                    ? <span className="text-xs italic opacity-50">[Attachment]</span>
                    : null}
              </div>
              <div className="flex items-center gap-1 shrink-0 self-end mb-0.5">
                {isEdited && (
                  <span className="text-[0.55rem] opacity-50 font-medium uppercase tracking-wider">edited</span>
                )}
                {isFailed && (
                  <button
                    onClick={onRetry}
                    className="text-[0.6rem] font-medium text-destructive-foreground/80 hover:text-destructive-foreground underline cursor-pointer"
                  >
                    Failed — tap to retry
                  </button>
                )}
                {isOwn && !isOptimistic && !isFailed && !isDeleted && (
                  <span className="text-[0.65rem]">
                    {msg.status === "read" ? (
                      <span className="text-primary-foreground/70">✓✓</span>
                    ) : msg.status === "delivered" ? (
                      <span className="text-primary-foreground/50">✓✓</span>
                    ) : (
                      <span className="text-primary-foreground/30">✓</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div
              className={`absolute top-1/2 -translate-y-1/2 text-[0.55rem] font-medium text-muted-foreground opacity-0 group-hover/message:opacity-100 transition-opacity whitespace-nowrap ${
                isOwn ? "-left-12" : "-right-12"
              }`}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>

            {/* Inline action bar — appears above bubble on row hover */}
            {!isDeleted && !isAnyEditing && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-1/2 -translate-y-1/2 ${
                  isOwn ? "right-full mr-1" : "left-full ml-1"
                } z-10 flex items-center gap-0.5 bg-popover border border-border shadow-md rounded-xl px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}
              >
                {/* React */}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletePickerOpen(false); onSetPickerOpen(!isPickerOpen); }}
                  className="w-7 h-7 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-sm"
                  title="React"
                >
                  😊
                </button>

                {/* Reply */}
                {canWrite && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReply(); onSetPickerOpen(false); }}
                    className="w-7 h-7 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-muted-foreground"
                    title="Reply"
                  >
                    <span className="text-sm">↩</span>
                  </button>
                )}

                {/* View thread */}
                {replyCount && replyCount > 0 && onViewThread && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewThread(); onSetPickerOpen(false); }}
                    className="w-7 h-7 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-muted-foreground"
                    title="View thread"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="w-px h-4 bg-border mx-0.5" />

                {/* Edit — own messages only */}
                {isOwn && canWrite && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); onSetPickerOpen(false); }}
                    className="w-7 h-7 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-muted-foreground"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete — opens inline picker */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletePickerOpen((v) => !v); onSetPickerOpen(false); }}
                    className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center ${deletePickerOpen ? "bg-destructive/10 text-destructive" : "hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground"}`}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {deletePickerOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute -top-1 ${isOwn ? "right-8" : "left-8"} z-30 flex flex-col gap-0.5 px-1 py-1 rounded-xl bg-popover border border-border shadow-lg shadow-black/10 animate-in fade-in slide-in-from-bottom-2 duration-150 whitespace-nowrap`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletePickerOpen(false); onDeleteForMe(); }}
                        className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-left text-foreground"
                      >
                        Delete for me
                      </button>
                      {isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletePickerOpen(false); onDeleteForEveryone(); }}
                          className="px-3 py-1.5 text-xs rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                        >
                          Delete for everyone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emoji picker popup — positioned beside bubble to avoid overlapping content */}
            {isPickerOpen && !isDeleted && !isAnyEditing && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-full mb-2 ${
                  isOwn ? "right-0" : "left-0"
                } z-20 flex items-center gap-0.5 px-2 py-1.5 rounded-2xl bg-popover border border-border shadow-lg shadow-black/10 animate-in fade-in slide-in-from-bottom-2 duration-150`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onToggleReaction(emoji);
                      onSetPickerOpen(false);
                    }}
                    className="text-base w-8 h-8 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {msgReactions && Object.keys(msgReactions).length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            {Object.entries(msgReactions).map(([emoji, data]) => {
              const isMine = data.users.includes(userId);
              return (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction(emoji)}
                  className={`animate-reaction-pop inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all active:scale-125 ${
                    isMine
                      ? "bg-primary/10 border-primary/25 text-primary"
                      : "bg-muted/50 border-transparent hover:border-border/60 text-foreground"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground text-[0.6rem] font-medium">{data.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread indicator */}
        {replyCount && replyCount > 0 && onViewThread && (
          <button
            onClick={onViewThread}
            className={`flex items-center gap-1 mt-0.5 px-2 text-[0.65rem] text-primary hover:underline ${
              isOwn ? "ml-auto" : ""
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}

        {/* Seen by — shown only on own messages when others have read past it */}
        {isOwn && seenBy && seenBy.length > 0 && (
          <div className="flex justify-end mt-0.5 px-1">
            <span className="text-[0.6rem] text-muted-foreground/70 italic">
              Seen by{" "}
              {seenBy.length <= 3
                ? seenBy.map((r) => r.displayName).join(", ")
                : `${seenBy.slice(0, 2).map((r) => r.displayName).join(", ")} +${seenBy.length - 2} more`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
