"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, FileText } from "lucide-react";
import { useDialog } from "@/components/DialogProvider";
import Header from "@/components/Header";

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
    <div className="min-h-screen bg-strix-bg text-strix-text">
      <Header />
      <main className="max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-32">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-strix-blue to-strix-cyan">
              Instruction Pool
            </h1>
            <p className="text-strix-text/70 mt-1">
              Manage custom prompts and notes to pass to Strix AI Agents.
            </p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center justify-center gap-2">
            <Plus size={18} /> New Instruction
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instructions.map((inst) => (
              <div key={inst.id} className="bg-strix-card border border-strix-border rounded-xl p-6 relative group hover:border-strix-blue/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold pr-16 line-clamp-1" title={inst.title}>
                    {inst.title}
                  </h3>
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(inst)}
                      className="p-2 bg-strix-blue/10 text-strix-blue rounded-lg hover:bg-strix-blue/20 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteInstruction(inst.id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="bg-strix-bg/50 rounded-lg p-3 text-sm text-strix-text/70 line-clamp-4 h-24 mb-4 font-mono">
                  {inst.content}
                </div>
                <div className="text-xs text-strix-text/40">
                  Last updated: {new Date(inst.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-strix-card border border-strix-border rounded-2xl w-full max-w-xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">{editing ? "Edit Instruction" : "New Instruction"}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Aggressive SQLi Check"
                  className="w-full bg-strix-bg border border-strix-border rounded-lg px-4 py-2 focus:outline-none focus:border-strix-blue"
                  disabled={saving}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Content (Prompt)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. Focus exclusively on testing parameter 'id' for blind SQL injection..."
                  className="w-full bg-strix-bg border border-strix-border rounded-lg px-4 py-3 h-48 focus:outline-none focus:border-strix-blue font-mono text-sm"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-lg border border-strix-border hover:bg-strix-border/50 transition-colors"
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
