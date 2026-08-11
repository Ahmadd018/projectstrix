"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Shield, ShieldOff, AlertTriangle, Users } from "lucide-react";

type UserData = {
  id: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                    background: user.role === "ADMIN" ? "rgba(168,85,247,0.1)" : "var(--bg-3)",
                    color: user.role === "ADMIN" ? "#a855f7" : "var(--fg-2)",
                    display: "inline-flex", alignItems: "center", gap: 4
                  }}>
                    {user.role === "ADMIN" ? <Shield size={12} /> : null}
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <span style={{ 
                    padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: user.status === "APPROVED" ? "rgba(74,222,128,0.1)" : user.status === "PENDING" ? "rgba(250,204,21,0.1)" : "rgba(248,113,113,0.1)",
                    color: user.status === "APPROVED" ? "#4ade80" : user.status === "PENDING" ? "#facc15" : "#f87171"
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: "16px 20px", color: "var(--fg-3)", fontSize: 13 }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
                        <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--sev-critical)" }} onClick={() => { if(confirm("Reject and disable this user?")) updateUser(user.id, { status: "REJECTED" }) }}>
                          <UserX size={14} /> Disable
                        </button>
                      </>
                    )}
                    {user.status === "REJECTED" && (
                      <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#4ade80" }} onClick={() => updateUser(user.id, { status: "APPROVED" })}>
                        <UserCheck size={14} /> Restore
                      </button>
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
    </div>
  );
}
