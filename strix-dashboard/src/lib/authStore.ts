import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  apiKeys: string | null;
  tokenVersion: number;
  createdAt: Date;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { username: username }
  });
  return user;
}

export async function createUser(username: string, passwordPlain: string): Promise<User> {
  const existing = await findUserByUsername(username);
  if (existing) {
    throw new Error("Username already exists");
  }

// Username is case-sensitive and stored exactly as entered by the user.

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  
  // M-5: Only the first ever user gets ADMIN. Username-based promotion is removed
  // to prevent account takeover via the "admin" username trick.
  const totalUsers = await prisma.user.count();
  const isFirstUser = totalUsers === 0;
  const role = isFirstUser ? "ADMIN" : "USER";
  const status = isFirstUser ? "APPROVED" : "PENDING";

  const newUser = await prisma.user.create({
    data: {
      username: username,
      passwordHash,
      role,
      status
    }
  });

  return newUser;
}

export async function verifyUser(username: string, passwordPlain: string): Promise<User | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;

  const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
  return isValid ? user : null;
}
