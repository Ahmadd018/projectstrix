import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Fallback is only used during build time or if .env is missing. deploy.py generates a secure one.
const secretKey = process.env.SESSION_SECRET || "strix-fallback-secret-change-me";
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(userId: string, username: string, role: string = "USER", status: string = "APPROVED") {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await new SignJWT({ userId, username, role, status })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set("strix_session", session, {
    httpOnly: true,
    secure: process.env.HTTPS_ENABLED === "true", // Must be false for HTTP access (localhost/IP)
    expires: expiresAt,
    sameSite: "strict",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("strix_session");
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("strix_session")?.value;
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null; // Invalid or expired token
  }
}
