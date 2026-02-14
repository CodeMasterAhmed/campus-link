import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

function usage() {
  console.error(
    "Usage: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> npm run admin:create\n" +
      "or: npm run admin:create -- <email> <password>"
  );
}

async function main() {
  const cliEmail = process.argv[2];
  const cliPassword = process.argv[3];
  const email = (process.env.ADMIN_EMAIL || cliEmail || "").trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD || cliPassword || "").trim();

  if (!email || !password) {
    usage();
    process.exit(1);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error("Invalid admin email format.");
  }
  if (password.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash,
        authProvider: "PASSWORD",
        collegeId: null,
      },
      select: { id: true, email: true, role: true, status: true },
    });
    console.log(
      JSON.stringify({ ok: true, action: "updated_existing_user", user: updated }, null, 2)
    );
    return;
  }

  const created = await prisma.user.create({
    data: {
      name: "Admin User",
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      authProvider: "PASSWORD",
    },
    select: { id: true, email: true, role: true, status: true },
  });

  console.log(JSON.stringify({ ok: true, action: "created_new_user", user: created }, null, 2));
}

main()
  .catch((err) => {
    console.error("[CREATE_ADMIN_ERROR]", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
