import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  apiKeys: string | null;
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

  if (username.toLowerCase() === "admin" && username !== "admin") {
    throw new Error("Variations of 'admin' are not allowed");
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  
  const totalUsers = await prisma.user.count();
  const role = (totalUsers === 0 || username === "admin") ? "ADMIN" : "USER";
  const status = (totalUsers === 0 || username === "admin") ? "APPROVED" : "PENDING";

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
