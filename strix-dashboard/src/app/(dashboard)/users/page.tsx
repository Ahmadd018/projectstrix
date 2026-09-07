"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Shield, ShieldOff, AlertTriangle, Users, Trash2, Key, X, KeyRound } from "lucide-react";
import { useDialog } from "@/components/DialogProvider";

type UserData = {
  id: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
  resetRequested?: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { alert, confirm } = useDialog();

  // Admin "reset password" modal — admin types the new password so they can hand
  // it to the user verbally.
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [resetPw, setResetPw] = useState({ newPassword: "", confirmPassword: "" });
  const [resetState, setResetState] = useState<{ saving: boolean; error: string }>({ saving: false, error: "" });

  const openReset = (user: UserData) => {
    setResetTarget(user);
    setResetPw({ newPassword: "", confirmPassword: "" });
    setResetState({ saving: false, error: "" });
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    if (resetPw.newPassword !== resetPw.confirmPassword) {
      setResetState({ saving: false, error: "Passwords do not match" });
      return;
    }
    setResetState({ saving: true, error: "" });
    try {
      const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPw.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      const name = resetTarget.username;
      setResetTarget(null);
      fetchUsers();
      alert(`Password reset for "${name}". They've been signed out everywhere — give them the new password so they can sign in and change it in Settings.`, "Password reset");
    } catch (e: any) {
      setResetState({ saving: false, error: e.message || "Failed to reset password" });
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, updates: { status?: string, role?: string }) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update user");
      }
      fetchUsers(); // refresh list
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete user");
      }
      fetchUsers(); // refresh list
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page" style={{ justifyContent: "center", alignItems: "center" }}><div className="loading-spinner" /></div>;
  if (error) return <div className="page"><div className="card" style={{ color: "var(--sev-critical)" }}><AlertTriangle /> {error}</div></div>;

  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 12 }}>
            <Users size={28} style={{ color: "var(--sev-high)" }} />
            User Access Control
          </h1>
          <p style={{ color: "var(--fg-3)", margin: 0 }}>Manage team members, approve registrations, and assign roles.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
              <th style={{ padding: "16px 20px", fontWeight: 600, color: "var(--fg-2)", fontSize: 13, textTransform: "uppercase" }}>User</th>
              <th style={{ padding: "16px 20px", fontWeight: 600, color: "var(--fg-2)", fontSize: 13, textTransform: "uppercase" }}>Role</th>
              <th style={{ padding: "16px 20px", fontWeight: 600, color: "var(--fg-2)", fontSize: 13, textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "16px 20px", fontWeight: 600, color: "var(--fg-2)", fontSize: 13, textTransform: "uppercase" }}>Joined</th>
              <th style={{ padding: "16px 20px", fontWeight: 600, color: "var(--fg-2)", fontSize: 13, textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--bg-2)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--fg)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.username}</div>
                      <div style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "monospace" }}>{user.id.split("-")[0]}...</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <span style={{ 
                    padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: user.username === "admin" ? "rgba(234,179,8,0.15)" : user.role === "ADMIN" ? "rgba(168,85,247,0.1)" : "var(--bg-3)",
                    color: user.username === "admin" ? "#eab308" : user.role === "ADMIN" ? "#a855f7" : "var(--fg-2)",
                    border: user.username === "admin" ? "1px solid rgba(234,179,8,0.3)" : "none",
                    display: "inline-flex", alignItems: "center", gap: 4
                  }}>
                    {user.role === "ADMIN" ? <Shield size={12} /> : null}
                    {user.username === "admin" ? "SUPER ADMIN" : user.role}
                  </span>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: user.status === "APPROVED" ? "rgba(74,222,128,0.1)" : user.status === "PENDING" ? "rgba(250,204,21,0.1)" : "rgba(248,113,113,0.1)",
                      color: user.status === "APPROVED" ? "#4ade80" : user.status === "PENDING" ? "#facc15" : "#f87171"
                    }}>
                      {user.status}
                    </span>
                    {user.resetRequested && (
                      <span title="This user requested a password reset" style={{
                        padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: "rgba(245,158,11,0.12)", color: "var(--sev-high)",
                        border: "1px solid rgba(245,158,11,0.3)", display: "inline-flex", alignItems: "center", gap: 4
                      }}>
                        <KeyRound size={11} /> Reset requested
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "16px 20px", color: "var(--fg-3)", fontSize: 13 }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {user.username === "admin" ? (
                      <span style={{ fontSize: 12, color: "var(--fg-3)", fontStyle: "italic", padding: "6px 8px" }}>
                        Protected Super Admin
                      </span>
                    ) : (
                      <>
                        {user.status === "PENDING" && (
                          <>
                            <button className="btn-primary" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, background: "#4ade80", color: "#000", border: "none" }} onClick={() => updateUser(user.id, { status: "APPROVED" })}>
                              <UserCheck size={14} /> Approve
                            </button>
                            <button className="btn-danger" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }} onClick={() => updateUser(user.id, { status: "REJECTED" })}>
                              <UserX size={14} /> Reject
                            </button>
                          </>
                        )}
                        {user.status === "APPROVED" && (
                          <>
                            {user.role === "USER" ? (
                              <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#a855f7" }} onClick={() => updateUser(user.id, { role: "ADMIN" })} title="Make Admin">
                                <Shield size={14} /> Make Admin
                              </button>
                            ) : (
                              <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--fg-3)" }} onClick={() => updateUser(user.id, { role: "USER" })} title="Remove Admin">
                                <ShieldOff size={14} /> Demote
                              </button>
                            )}
                            <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--sev-critical)" }} onClick={() => { confirm("Reject and disable this user?", () => updateUser(user.id, { status: "REJECTED" })) }}>
                              <UserX size={14} /> Disable
                            </button>
                          </>
                        )}
                        {user.status === "REJECTED" && (
                          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#4ade80" }} onClick={() => updateUser(user.id, { status: "APPROVED" })}>
                            <UserCheck size={14} /> Restore
                          </button>
                        )}
                        {/* Reset Password */}
                        <button
                          className="btn-ghost"
                          style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: user.resetRequested ? "var(--sev-high)" : "var(--fg-3)" }}
                          onClick={() => openReset(user)}
                          title="Reset this user's password"
                        >
                          <Key size={14} /> Reset password
                        </button>
                        {/* Permanent Delete Button */}
                        <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--sev-critical)" }} onClick={() => { confirm("Are you sure you want to PERMANENTLY delete this user? This action cannot be undone.", () => deleteUser(user.id)) }} title="Permanently Delete">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--fg-3)" }}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reset-password modal */}
      {resetTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => { if (!resetState.saving) setResetTarget(null); }}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 440, padding: 0, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
                <Key size={16} style={{ color: "var(--sev-high)" }} /> Reset password
              </div>
              <button className="btn-icon" onClick={() => { if (!resetState.saving) setResetTarget(null); }} title="Close">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>
                Set a new password for <strong style={{ color: "var(--fg)" }}>{resetTarget.username}</strong>. Give it to them directly — they'll be signed out everywhere and can change it themselves in Settings.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-2)" }}>New password</label>
                <input
                  className="field-input"
                  style={{ height: 40, fontSize: 14, padding: "0 12px" }}
                  type="text"
                  autoComplete="new-password"
                  placeholder="At least 12 chars, mixed case + a number"
                  value={resetPw.newPassword}
                  onChange={(e) => setResetPw({ ...resetPw, newPassword: e.target.value })}
                  autoFocus
                />
                <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Shown as text so you can read it back to the user.</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-2)" }}>Confirm password</label>
                <input
                  className="field-input"
                  style={{ height: 40, fontSize: 14, padding: "0 12px" }}
                  type="text"
                  autoComplete="new-password"
                  placeholder="Re-enter the password"
                  value={resetPw.confirmPassword}
                  onChange={(e) => setResetPw({ ...resetPw, confirmPassword: e.target.value })}
                />
              </div>
              {resetState.error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-critical)" }}>
                  <AlertTriangle size={13} /> {resetState.error}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setResetTarget(null)} disabled={resetState.saving} style={{ fontSize: 13 }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitReset}
                disabled={resetState.saving || !resetPw.newPassword || !resetPw.confirmPassword}
                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Key size={13} /> {resetState.saving ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
