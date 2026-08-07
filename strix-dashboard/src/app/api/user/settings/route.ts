import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId as string },
      include: {
        settings: true,
        customModels: true
      }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      settings: user.settings || { aggressiveness: 50, maxThreads: 4, webhookUrl: "", notifyOnStart: false, notifyOnFinish: true },
      customModels: user.customModels
    });
  } catch (e: any) {
    log.error("GET /api/user/settings", "Failed to fetch settings", e);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const userId = session.userId as string;

    if (body.type === "settings") {
      const { aggressiveness, maxThreads, webhookUrl, notifyOnStart, notifyOnFinish } = body.data;
      
      const settings = await prisma.userSettings.upsert({
        where: { userId },
        update: { aggressiveness, maxThreads, webhookUrl, notifyOnStart, notifyOnFinish },
        create: { userId, aggressiveness, maxThreads, webhookUrl, notifyOnStart, notifyOnFinish }
      });
      
      return NextResponse.json({ success: true, settings });
    } 
    
    if (body.type === "customModels") {
      // The frontend sends the entire array of custom models
      const models = body.data; // Array of { value, label }
      
      // Delete existing
      await prisma.customModel.deleteMany({ where: { userId } });
      
      // Create new
      if (models && models.length > 0) {
        await prisma.customModel.createMany({
          data: models.map((m: any) => ({
            userId,
            value: m.value,
            label: m.label
          }))
        });
      }
      
      const updatedModels = await prisma.customModel.findMany({ where: { userId } });
      return NextResponse.json({ success: true, customModels: updatedModels });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    log.error("POST /api/user/settings", "Failed to update settings", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
