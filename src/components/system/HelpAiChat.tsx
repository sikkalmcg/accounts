"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Send, 
  X, 
  Maximize2, 
  Minimize2, 
  Minus, 
  Sparkles, 
  Trash2, 
  ArrowUpRight, 
  HelpCircle,
  Database,
  Building2,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { TCODE_METADATA } from "@/lib/tcode-metadata";
import { playGlobalSound } from "@/hooks/use-sounds";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedTcodes?: string[];
  timestamp: string;
}

interface HelpAiChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentTcode?: string;
  userData?: any;
}

export function HelpAiChat({
  isOpen,
  onClose,
  currentTcode,
  userData
}: HelpAiChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isFullWindow, setIsFullWindow] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active tcode from props or pathname
  const activeCode = currentTcode || (pathname.startsWith('/tcode/') ? pathname.replace('/tcode/', '').toUpperCase() : 'DB01');
  const activeTitle = (TCODE_METADATA as Record<string, string>)[activeCode] || 'Main Dashboard';

  // Initialize welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcome: ChatMessage = {
        id: "welcome-1",
        role: "assistant",
        content: `👋 **Namaste! I am your Sikka LMC Project AI Assistant.**\n\nI have real-time access to the system's database. You can ask me any question about:\n- 📄 **Invoices & Billing** (Amounts, pending invoices, IRN status)\n- 🏢 **Master Data** (Registered Plants, Firms, Materials, Customers, Vendors)\n- 🔍 **SAP T-Codes** (Which screen to use and step-by-step guidance)\n- 🛠️ **Troubleshooting & Errors** (Save failures, permissions, duplicate alerts)\n\n*Aap mujhse Hindi ya English dono me pooch sakte hain.*`,
        suggestedTcodes: ["DB01", "VF01", "FB03", "OP03"],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([welcome]);
    }
  }, [messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  if (!isOpen) return null;

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text || loading) return;

    playGlobalSound("button_click");
    setInputMessage("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: newHistory.map(m => ({ role: m.role, content: m.content })),
          context: {
            currentTcode: activeCode,
            username: userData?.username || "ajaysomra",
            name: userData?.name || "User",
            role: userData?.role || "user"
          }
        })
      });

      const data = await res.json();
      if (data.reply) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          suggestedTcodes: data.suggestedTcodes || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
        playGlobalSound("success");
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Sorry, I encountered an issue connecting to the AI service: ${err.message || 'Please retry.'}\n\nYou can ask about invoices, plants, firms, or specific T-Codes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      playGlobalSound("warning");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    playGlobalSound("button_click");
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `Conversation cleared. How can I help you with **Sikka LMC Accounts** today?`,
        suggestedTcodes: ["DB01", "VF01", "FB03"],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const navigateToTcode = (tcode: string) => {
    playGlobalSound("tab_switch");
    if (!isFullWindow) {
      // If docked, let user stay in chat while navigating
      router.push(`/tcode/${tcode}`);
    } else {
      // If full window, minimize or close so user sees the navigated page
      setIsFullWindow(false);
      router.push(`/tcode/${tcode}`);
    }
  };

  // Quick prompt suggestions
  const suggestions = [
    { label: "📊 Recent Invoices", prompt: "Show me recent invoices and their status." },
    { label: "⏳ Pending Invoices", prompt: "Are there any pending or unpaid invoices?" },
    { label: "🏭 Registered Plants", prompt: "List all registered plants in the system." },
    { label: "🏢 Registered Firms", prompt: "What firms are configured in Sikka LMC?" },
    { label: "💳 Post Payment", prompt: "How do I post an outgoing payment or view payment proof?" },
    { label: "🛠️ Help With Screen", prompt: `Explain how to use current transaction code [${activeCode}].` }
  ];

  // Helper to format assistant message with clickable T-Codes
  const renderFormattedText = (content: string) => {
    // Regex for [TCODE] like [VF01], [FB03], [OP03]
    const parts = content.split(/(\[[A-Z0-9]{3,6}\])/g);

    return (
      <div className="space-y-1.5 text-[13px] leading-relaxed break-words">
        {parts.map((part, i) => {
          const match = part.match(/^\[([A-Z0-9]{3,6})\]$/);
          if (match && match[1]) {
            const code = match[1];
            const title = (TCODE_METADATA as Record<string, string>)[code];
            return (
              <button
                key={i}
                type="button"
                onClick={() => navigateToTcode(code)}
                title={title ? `Go to ${code} - ${title}` : `Open ${code}`}
                className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded bg-primary/15 hover:bg-primary hover:text-white text-primary font-mono font-semibold text-xs transition-colors align-baseline border border-primary/30"
              >
                <span>{code}</span>
                {title && <span className="opacity-80 font-sans text-[10px]">({title})</span>}
                <ArrowUpRight className="h-3 w-3 inline" />
              </button>
            );
          }

          // Format basic markdown bolding
          const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
          return (
            <span key={i}>
              {boldParts.map((bp, j) => {
                if (bp.startsWith("**") && bp.endsWith("**")) {
                  return <strong key={j} className="font-semibold text-foreground">{bp.slice(2, -2)}</strong>;
                }
                if (bp.startsWith("`") && bp.endsWith("`")) {
                  return <code key={j} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{bp.slice(1, -1)}</code>;
                }
                return <span key={j}>{bp}</span>;
              })}
            </span>
          );
        })}
      </div>
    );
  };

  // Minimized Bar
  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-6 z-[9999] flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-xl cursor-pointer hover:bg-primary/90 hover:scale-105 transition-all border border-white/20"
      >
        <Bot className="h-5 w-5 animate-pulse" />
        <span className="text-xs font-semibold">Sikka AI Help</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[9999] flex flex-col bg-card border border-border shadow-2xl transition-all duration-200 overflow-hidden ${
        isFullWindow
          ? "inset-4 md:inset-8 rounded-xl"
          : "bottom-3 right-3 sm:right-5 w-[420px] max-w-[calc(100vw-24px)] h-[560px] max-h-[calc(100vh-80px)] rounded-t-xl rounded-b-lg"
      }`}
      style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 text-white border-b border-slate-800 select-none shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative p-1.5 bg-primary/20 rounded-lg shrink-0">
            <Bot className="h-4 w-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wide">Sikka AI Assistant</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                ONLINE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Screen: <span className="text-slate-200 font-mono font-medium">[{activeCode}]</span> {activeTitle}
            </div>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={clearChat}
            title="Clear conversation"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            title="Minimize to dock"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullWindow(!isFullWindow)}
            title={isFullWindow ? "Dock to corner" : "Expand to full window"}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isFullWindow ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Assistant"
            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-background no-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                    : "bg-card border border-border text-card-foreground rounded-tl-none shadow-sm"
                }`}
              >
                {renderFormattedText(msg.content)}

                {/* Suggested Action T-Codes */}
                {msg.suggestedTcodes && msg.suggestedTcodes.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Open T-Code:
                    </span>
                    {msg.suggestedTcodes.map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        onClick={() => navigateToTcode(tc)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-mono font-medium transition-colors"
                      >
                        <span>{tc}</span>
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[9px] mt-1.5 text-right ${
                    isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
              <Bot className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="bg-card border border-border rounded-lg rounded-tl-none p-3 shadow-sm flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Checking live data...</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="px-3 py-1.5 bg-muted/40 border-t border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 ml-0.5" />
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(s.prompt)}
            disabled={loading}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-card hover:bg-primary/10 border border-border text-[11px] font-medium text-foreground hover:text-primary transition-colors disabled:opacity-50 shrink-0 shadow-2xs"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-2.5 bg-card border-t border-border flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask anything about invoices, plants, payments, or T-Codes..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs rounded-md bg-background border border-input focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={loading || !inputMessage.trim()}
          className="p-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors shrink-0"
          title="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
