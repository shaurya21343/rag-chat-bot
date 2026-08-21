"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Upload,
  Send,
  Bot,
  User,
  Paperclip,
  Loader2,
  Trash2,
} from "lucide-react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    if (file.type !== "application/pdf") {
      toast.error("File must be a PDF");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be 5 MB or smaller");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/file/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("File upload failed");
      }

      const data = await response.json();

      console.log("Upload successful:", data);
      toast.success("File successfully uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("File upload failed");
    }
  };

  const sendMessage = async () => {
    const content = message.trim();

    if (!content || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      const reply = data.reply ?? data.message ?? data.content;

      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("The server returned an empty response");
      }

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (error) {
      console.error("Message error:", error);
      toast.error("Unable to send message");
    } finally {
      setLoading(false);
    }
  };

  const deleteAllFiles = async () => {
    if (deletingFiles) return;

    setDeletingFiles(true);

    try {
      const response = await fetch("/api/file/delete", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to delete files");
      }

      toast.success("All files deleted");
    } catch (error) {
      console.error("Delete files error:", error);
      toast.error("Unable to delete files");
    } finally {
      setDeletingFiles(false);
    }
  };

  return (
    <main className="h-dvh overflow-hidden bg-[#09090b] text-white">
      {/* ================= HEADER ================= */}
      <header className="h-14 sm:h-16 border-b border-white/10 flex items-center justify-between px-3 sm:px-6 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white text-black flex items-center justify-center shrink-0">
            <Bot size={18} className="sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <h1 className="font-semibold text-sm sm:text-base">
              DocChat AI
            </h1>

            <p className="hidden sm:block text-xs text-zinc-500">
              Chat with your documents
            </p>
          </div>
        </div>

        <UserButton />
      </header>

      {/* ================= MAIN ================= */}
      <div className="h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] flex flex-col lg:flex-row min-h-0">

        {/* ================= DOCUMENTS ================= */}
        <aside
          className="
            w-full
            lg:w-[320px]
            xl:w-[360px]
            shrink-0
            border-b
            lg:border-b-0
            lg:border-r
            border-white/10
            p-3
            sm:p-5
            overflow-y-auto
            max-h-[230px]
            sm:max-h-[280px]
            lg:max-h-none
            lg:h-full
          "
        >
          <div className="mb-3 sm:mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">
                Documents
              </h2>

              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Upload PDFs to chat with them.
              </p>
            </div>

            <button
              type="button"
              onClick={deleteAllFiles}
              disabled={deletingFiles}
              aria-label="Delete all uploaded files"
              title="Delete all uploaded files"
              className="p-2 rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {deletingFiles ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>

          {/* Upload */}
          <label className="group cursor-pointer block">
            <div
              className="
                border
                border-dashed
                border-zinc-700
                hover:border-zinc-500
                rounded-xl
                sm:rounded-2xl
                p-4
                sm:p-8
                transition
                bg-zinc-900/40
                hover:bg-zinc-900
              "
            >
              <div className="flex flex-row lg:flex-col items-center justify-center gap-3 sm:gap-0 text-center">
                <div
                  className="
                    w-10
                    h-10
                    sm:w-12
                    sm:h-12
                    rounded-xl
                    bg-zinc-800
                    flex
                    items-center
                    justify-center
                    sm:mb-4
                    group-hover:bg-zinc-700
                    transition
                    shrink-0
                  "
                >
                  <Upload size={20} className="text-zinc-300" />
                </div>

                <div>
                  <p className="font-medium text-sm sm:text-base">
                    Upload documents
                  </p>

                  <p className="text-xs sm:text-sm text-zinc-500 mt-1 sm:mt-2">
                    Drag & drop or click to browse
                  </p>

                  <p className="text-[10px] sm:text-xs text-zinc-600 mt-2 sm:mt-3">
                    PDF
                  </p>
                </div>
              </div>
            </div>

            <input
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {/* Files can be rendered here */}
        </aside>

        {/* ================= CHAT ================= */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Chat Header */}
          <div className="h-14 sm:h-16 border-b border-white/10 px-3 sm:px-6 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-medium text-sm sm:text-base">
                AI Assistant
              </h2>

              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500" />

                <span className="text-[10px] sm:text-xs text-zinc-500">
                  Ready to help
                </span>
              </div>
            </div>
          </div>

          {/* ================= MESSAGES ================= */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 md:px-8 py-4 sm:py-8">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 sm:gap-3 ${
                    msg.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {/* Assistant Icon */}
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <Bot size={15} className="sm:w-[17px] sm:h-[17px]" />
                    </div>
                  )}

                  {/* Message */}
                  <div
                    className={`
                      max-w-[85%]
                      sm:max-w-[80%]
                      rounded-2xl
                      px-3
                      sm:px-4
                      py-2.5
                      sm:py-3
                      text-xs
                      sm:text-sm
                      leading-5
                      sm:leading-6
                      break-words
                      overflow-hidden
                      ${
                        msg.role === "user"
                          ? "bg-white text-black rounded-br-md"
                          : "bg-zinc-900 border border-white/5 text-zinc-300 rounded-bl-md"
                      }
                    `}
                  >
                    {msg.content}
                  </div>

                  {/* User Icon */}
                  {msg.role === "user" && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <User size={15} className="sm:w-[17px] sm:h-[17px]" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Bot size={15} className="sm:w-[17px] sm:h-[17px]" />
                  </div>

                  <div className="bg-zinc-900 border border-white/5 rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3">
                    <Loader2
                      size={17}
                      className="animate-spin text-zinc-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= INPUT ================= */}
          <div className="p-2.5 sm:p-4 md:p-6 shrink-0">
            <div className="max-w-3xl mx-auto">

              <div
                className="
                  relative
                  bg-zinc-900
                  border
                  border-white/10
                  rounded-xl
                  sm:rounded-2xl
                  focus-within:border-white/20
                  transition
                "
              >
                {/* Attachment */}
                <button
                  type="button"
                  className="
                    absolute
                    left-2
                    sm:left-3
                    bottom-2
                    sm:bottom-3
                    p-1.5
                    sm:p-2
                    rounded-lg
                    hover:bg-zinc-800
                    text-zinc-500
                    hover:text-zinc-300
                  "
                >
                  <Paperclip size={17} className="sm:w-[19px] sm:h-[19px]" />
                </button>

                {/* Textarea */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask something about your documents..."
                  rows={1}
                  className="
                    w-full
                    bg-transparent
                    resize-none
                    outline-none
                    px-10
                    sm:px-12
                    py-3
                    sm:py-4
                    pr-12
                    sm:pr-14
                    text-xs
                    sm:text-sm
                    placeholder:text-zinc-600
                    max-h-32
                  "
                />

                {/* Send */}
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || loading}
                  className="
                    absolute
                    right-2
                    sm:right-3
                    bottom-2
                    sm:bottom-3
                    w-8
                    h-8
                    sm:w-9
                    sm:h-9
                    rounded-lg
                    sm:rounded-xl
                    bg-white
                    text-black
                    flex
                    items-center
                    justify-center
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    hover:bg-zinc-200
                    transition
                  "
                >
                  <Send size={15} className="sm:w-[17px] sm:h-[17px]" />
                </button>
              </div>

              <p className="hidden sm:block text-center text-xs text-zinc-700 mt-3">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}