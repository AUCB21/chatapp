"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type DragEvent } from "react";
import { Paperclip, Send, X, FileText, Film, Music } from "lucide-react";
import { MAX_FILE_SIZE, MAX_FILES_PER_MESSAGE, ALLOWED_MIME_TYPES } from "@/lib/validation";

interface MessageInputProps {
  canWrite: boolean;
  replyTo: { id: string; content: string } | null;
  onSend: (content: string, files?: File[]) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
  onJumpToReplyMessage: () => void;
  onCancelReply: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) return <Film className="w-4 h-4" />;
  if (mimeType.startsWith("audio/")) return <Music className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export default function MessageInput({
  canWrite,
  replyTo,
  onSend,
  onTypingChange,
  onJumpToReplyMessage,
  onCancelReply,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => onTypingChange(false);
  }, [onTypingChange]);

  function validateAndAddFiles(incoming: File[]) {
    setFileError(null);
    const current = files.length;
    const allowed = MAX_FILES_PER_MESSAGE - current;

    if (allowed <= 0) {
      setFileError(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`);
      return;
    }

    const valid: File[] = [];
    for (const file of incoming.slice(0, allowed)) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`"${file.name}" exceeds 10 MB limit`);
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setFileError(`"${file.name}" — file type not allowed`);
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = input.trim();
    if (!content && files.length === 0) return;
    const filesToSend = files.length > 0 ? [...files] : undefined;
    setInput("");
    setFiles([]);
    setFileError(null);
    onTypingChange(false);
    await onSend(content, filesToSend);
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;

    e.preventDefault();
    if (!input.trim() && files.length === 0) return;
    const form = e.currentTarget.form;
    form?.requestSubmit();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) validateAndAddFiles(dropped);
  }

  if (!canWrite) {
    return (
      <div className="px-5 py-4 border-t border-border shrink-0 bg-background">
        <p className="text-xs text-muted-foreground text-center">
          You have read-only access to this chat.
        </p>
      </div>
    );
  }

  const hasContent = input.trim().length > 0 || files.length > 0;

  return (
    <>
      {replyTo && (
        <div className="px-4 md:px-5 pt-3 pb-0 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2.5 bg-muted/60 border border-border/60 rounded-xl px-3 py-2">
            <div className="w-0.5 h-8 rounded-full bg-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.6rem] font-medium text-primary uppercase tracking-wider mb-0.5">Replying</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button
              onClick={onJumpToReplyMessage}
              className="text-[0.65rem] text-muted-foreground hover:text-foreground px-1.5 transition-colors shrink-0"
            >
              Jump
            </button>
            <button
              onClick={onCancelReply}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-border transition-colors shrink-0"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* File preview strip */}
      {files.length > 0 && (
        <div className="px-4 md:px-5 pt-3 pb-0 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {files.map((file, i) => {
              const isImage = file.type.startsWith("image/");
              return (
                <div
                  key={`${file.name}-${i}`}
                  className="relative group rounded-xl border border-border/60 bg-muted/40 overflow-hidden"
                >
                  {isImage ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-20 h-20 object-cover"
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                  ) : (
                    <div className="w-20 h-20 flex flex-col items-center justify-center gap-1 px-1">
                      <FileIcon mimeType={file.type} />
                      <p className="text-[0.5rem] text-muted-foreground text-center truncate w-full">
                        {file.name}
                      </p>
                      <p className="text-[0.45rem] text-muted-foreground/60">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fileError && (
        <div className="px-4 md:px-5 pt-2 shrink-0">
          <p className="text-[0.65rem] text-destructive">{fileError}</p>
        </div>
      )}

      <form
        onSubmit={handleSend}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`px-4 md:px-5 py-3 border-t border-border bg-background flex items-end gap-2.5 shrink-0 transition-colors ${
          dragOver ? "bg-primary/5 border-primary/30" : ""
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length > 0) validateAndAddFiles(selected);
            e.target.value = ""; // reset so same file can be re-selected
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            setInput(value);
            onTypingChange(value.trim().length > 0);
          }}
          onKeyDown={handleComposerKeyDown}
          placeholder={replyTo ? "Write a reply…" : files.length > 0 ? "Add a caption…" : "Type a message…"}
          rows={1}
          className="flex-1 rounded-2xl min-h-9 max-h-36 bg-muted/60 border border-border/60 text-sm px-4 py-2 outline-none resize-none focus:ring-1 focus:ring-ring/40 focus:border-border transition-all placeholder:text-muted-foreground/50"
        />

        <button
          type="submit"
          disabled={!hasContent}
          className="mb-0.5 w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}
