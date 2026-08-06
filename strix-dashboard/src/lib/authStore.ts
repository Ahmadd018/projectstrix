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
    where: { username: username.toLowerCase() }
  });
  return user;
}

export async function createUser(username: string, passwordPlain: string): Promise<User> {
  const existing = await findUserByUsername(username);
  if (existing) {
    throw new Error("Username already exists");
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  
  // First user created becomes ADMIN, others are USER
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : "USER";

  const newUser = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
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
