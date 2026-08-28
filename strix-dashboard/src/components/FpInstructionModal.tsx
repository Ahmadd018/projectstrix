"use client";

import { useState } from "react";
import { ShieldOff, X, Copy, Check } from "lucide-react";

// Copyable false-positive instruction popup. Renders nothing when `text` is null.
export function FpInstructionModal({ text, onClose }: { text: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }

  if (text === null) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <ShieldOff size={16} /> False-positive instruction
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-2)" }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>
          Saved to this target's <strong>FP instructions</strong> — it will be applied automatically on future scans of this domain. You can also paste it into the <strong>Instruction</strong> field of any scan.
        </p>
        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", minHeight: 150, resize: "vertical", padding: 12, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5 }}
        />
        <button
          className="btn-primary"
          onClick={copy}
          style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy instruction"}
        </button>
      </div>
    </div>
  );
}
