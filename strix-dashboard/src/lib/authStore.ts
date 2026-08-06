import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
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
  
  const role = (username === "admin") ? "ADMIN" : "USER";

  const newUser = await prisma.user.create({
    data: {
      username: username,
      passwordHash,
      role,
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
