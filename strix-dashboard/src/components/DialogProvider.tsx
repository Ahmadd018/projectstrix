"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AlertCircle, HelpCircle } from "lucide-react";

type DialogType = "alert" | "confirm";

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogContextProps {
  showDialog: (options: DialogOptions) => void;
  confirm: (message: string, onConfirm: () => void, title?: string) => void;
  alert: (message: string, title?: string) => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showDialog = (options: DialogOptions) => setDialog(options);

  const confirm = (message: string, onConfirm: () => void, title?: string) => {
    setDialog({ type: "confirm", message, onConfirm, title });
  };

  const alert = (message: string, title?: string) => {
    setDialog({ type: "alert", message, title });
  };

  const closeDialog = () => setDialog(null);

  const handleConfirm = () => {
    if (dialog?.onConfirm) dialog.onConfirm();
    closeDialog();
  };

  const handleCancel = () => {
    if (dialog?.onCancel) dialog.onCancel();
    closeDialog();
  };

  return (
    <DialogContext.Provider value={{ showDialog, confirm, alert }}>
      {children}
      
      {dialog && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100000,
          opacity: 0,
          animation: "fadeIn 0.2s forwards"
        }} onClick={handleCancel}>
          <div style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: 32,
            width: "100%",
            maxWidth: 400,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            transform: "translateY(20px)",
            opacity: 0,
            animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: dialog.type === "confirm" ? "rgba(168,85,247,0.1)" : "rgba(248,113,113,0.1)",
                color: dialog.type === "confirm" ? "#a855f7" : "#f87171",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {dialog.type === "confirm" ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
              </div>
              <h2 style={{ fontSize: 20, margin: 0, color: "var(--fg)" }}>
                {dialog.title || (dialog.type === "confirm" ? "Confirm Action" : "Alert")}
              </h2>
            </div>
            
            <p style={{ color: "var(--fg-3)", fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
              {dialog.message}
            </p>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {(dialog.type === "confirm") && (
                <button
                  className="btn-ghost"
                  onClick={handleCancel}
                  style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "var(--fg-2)" }}
                >
                  Cancel
                </button>
              )}
              <button
                className={dialog.type === "confirm" ? "btn-primary" : "btn-danger"}
                onClick={handleConfirm}
                style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600, background: dialog.type === "confirm" ? "var(--fg)" : "var(--sev-critical-bg)", color: dialog.type === "confirm" ? "var(--bg)" : "var(--sev-critical)", border: "none", borderRadius: 8 }}
              >
                {dialog.type === "confirm" ? "Confirm" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
