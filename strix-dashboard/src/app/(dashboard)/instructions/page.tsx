"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, FileText, Loader2, Play } from "lucide-react";
import { useDialog } from "@/components/DialogProvider";

interface Instruction {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Instruction | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const { confirm, alert } = useDialog();

  const fetchInstructions = async () => {
    try {
      const res = await fetch("/api/instructions");
      if (res.ok) {
        const data = await res.json();
        setInstructions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, []);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setShowModal(true);
  };

  const openEdit = (inst: Instruction) => {
    setEditing(inst);
    setTitle(inst.title);
    setContent(inst.content);
    setShowModal(true);
  };

  const saveInstruction = async () => {
    if (!title.trim() || !content.trim()) {
      alert("Title and content are required.", "Error");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/instructions/${editing.id}` : "/api/instructions";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      setShowModal(false);
      fetchInstructions();
    } catch (e: any) {
      alert(e.message, "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteInstruction = async (id: string) => {
    confirm("Are you sure you want to delete this instruction?", async () => {
      try {
        const res = await fetch(`/api/instructions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        fetchInstructions();
      } catch (e: any) {
        alert(e.message, "Error");
      }
    }, "Delete Instruction");
  };

  return (
    <div className="page" style={{ height: "100%", maxWidth: "none", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-heading">Instruction Pool</h1>
          <p className="page-desc">Manage custom prompts and notes to pass to Strix AI Agents.</p>
        </div>
        <button onClick={openNew} className="btn-primary" style={{ gap: 8 }}>
          <Plus size={16} /> New Instruction
        </button>
      </div>

        {loading ? (
          <div className="text-center text-strix-text/50 py-12">Loading...</div>
        ) : instructions.length === 0 ? (
          <div className="text-center py-16 bg-strix-card rounded-xl border border-strix-border">
            <FileText size={48} className="mx-auto text-strix-text/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No instructions yet</h2>
            <p className="text-strix-text/60 mb-6 max-w-md mx-auto">
              Create reusable prompts to guide the AI during scans, like specifying custom logic or focusing on certain vulnerabilities.
            </p>
            <button onClick={openNew} className="btn-primary px-6">
              Create First Instruction
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {instructions.map((inst) => (
              <div key={inst.id} className="status-badge" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 16, gap: 12, background: "var(--bg-2)", border: "1px solid var(--border)", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 40 }}>
                    {inst.title}
                  </h3>
                  <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(inst)} className="btn-icon" title="Edit">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => deleteInstruction(inst.id)} className="btn-icon" style={{ color: "var(--sev-critical)" }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ background: "var(--bg-1)", padding: 12, borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--fg-2)", fontFamily: "monospace", minHeight: 80, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}>
                  {inst.content}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
                  Last updated: {new Date(inst.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? "Edit Instruction" : "New Instruction"}</div>
            </div>
            
            <div className="modal-body">
              <div className="field">
                <label className="field-label">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Aggressive SQLi Check"
                  className="field-input"
                  disabled={saving}
                />
              </div>
              
              <div className="field">
                <label className="field-label">Content (Prompt)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. Focus exclusively on testing parameter 'id' for blind SQL injection..."
                  className="field-input"
                  style={{ minHeight: 160, fontFamily: "monospace", resize: "vertical" }}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowModal(false)}
                className="btn-ghost"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveInstruction}
                className="btn-primary"
                disabled={saving || !title.trim() || !content.trim()}
              >
                {saving ? "Saving..." : "Save Instruction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
