const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting Strix DB Migration...");

  const dataDir = path.join(process.cwd(), "data");
  const usersFile = path.join(dataDir, "users.json");

  let adminUserId = null;

  // Migrate Users
  if (fs.existsSync(usersFile)) {
    console.log("Found users.json, migrating users...");
    const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
    
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const role = i === 0 ? "ADMIN" : "USER"; // First user is admin
      
      try {
        const created = await prisma.user.upsert({
          where: { username: u.username.toLowerCase() },
          update: {},
          create: {
            id: u.id,
            username: u.username.toLowerCase(),
            passwordHash: u.passwordHash,
            role,
            createdAt: new Date(u.createdAt)
          }
        });
        console.log(`Migrated user: ${created.username} (${role})`);
        
        if (role === "ADMIN" && !adminUserId) {
          adminUserId = created.id;
        }
      } catch (e) {
        console.error(`Failed to migrate user ${u.username}`, e);
      }
    }
  } else {
    console.log("No users.json found.");
  }

  // Migrate Scans
  if (adminUserId) {
    const runsDir = path.join(os.tmpdir(), "strix_runs");
    if (fs.existsSync(runsDir)) {
      console.log("Found strix_runs, migrating scans to ADMIN user...");
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      
      let recurringMap = {};
      const recurringFile = path.join(runsDir, "recurring.json");
      if (fs.existsSync(recurringFile)) {
        try {
          const recurring = JSON.parse(fs.readFileSync(recurringFile, "utf-8"));
          for (const r of recurring) {
            recurringMap[r.originalScanId] = { period: r.period, nextRunAt: r.nextRunAt };
          }
        } catch (e) {}
      }

      for (const d of dirs) {
        const runFile = path.join(runsDir, d.name, "run.json");
        if (fs.existsSync(runFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(runFile, "utf-8"));
            if (!data.id) continue;

            const vulnFile = path.join(runsDir, d.name, "vulnerabilities.json");
            let vulnCount = 0;
            if (fs.existsSync(vulnFile)) {
              try {
                const vulns = JSON.parse(fs.readFileSync(vulnFile, "utf-8"));
                vulnCount = Array.isArray(vulns) ? vulns.length : 0;
              } catch (e2) {}
            }

            const scanId = data.id;
            await prisma.scan.upsert({
              where: { id: scanId },
              update: {},
              create: {
                id: scanId,
                userId: adminUserId,
                target: data.target || "Unknown Target",
                projectName: data.projectName || "",
                llmModel: data.llmModel || "Unknown",
                scanMode: data.scanMode || "standard",
                status: data.status || "failed",
                startedAt: new Date(data.startedAt || Date.now()),
                vulnCount,
                period: recurringMap[scanId]?.period || "none",
                nextRunAt: recurringMap[scanId]?.nextRunAt ? new Date(recurringMap[scanId].nextRunAt) : null
              }
            });
            console.log(`Migrated scan: ${scanId}`);
          } catch (e) {
            console.error(`Failed to migrate scan in ${d.name}`, e);
          }
        }
      }
    }
  } else {
    console.log("No ADMIN user found to bind old scans to. Skipping scan migration.");
  }

  console.log("Migration complete!");
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
