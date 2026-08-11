import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status, role } = await req.json();

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (role) dataToUpdate.role = role;

    // Prevent changing the last admin to a regular user or rejecting them
    if (role === "USER" || status === "REJECTED") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", status: "APPROVED" }
      });
      const targetUser = await prisma.user.findUnique({ where: { id } });
      
      if (adminCount <= 1 && targetUser?.role === "ADMIN") {
        return NextResponse.json({ error: "Cannot demote or reject the last administrator" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, username: true, role: true, status: true }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
