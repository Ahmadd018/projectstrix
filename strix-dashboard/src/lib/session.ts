import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// In production, this should be an environment variable. 
// We use a fallback so it works out-of-the-box for Strix users.
const secretKey = process.env.JWT_SECRET || "strix-super-secret-key-change-in-prod";
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(userId: string, username: string, role: string = "USER") {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await new SignJWT({ userId, username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set("strix_session", session, {
    httpOnly: true,
    secure: false, // Force false for simple local/IP access without HTTPS
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
