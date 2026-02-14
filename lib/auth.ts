import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import { extractRollNumberFromEmail, getCollegeCodeFromRoll } from "@/lib/student";
import { prisma } from "@/lib/prisma";

type GoogleSignInError =
  | "GoogleEmailRequired"
  | "GoogleNoCollege"
  | "GoogleNoAcademicRecord"
  | "GoogleInactiveAccount"
  | "GoogleProvisioningFailed";

function toGoogleSignInErrorPath(error: GoogleSignInError) {
  return `/login?error=${error}`;
}

async function ensureGoogleUser(email: string, displayName?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      studentProfile: {
        select: { id: true },
      },
    },
  });

  if (existingUser) {
    if (existingUser.status !== "ACTIVE") {
      return { ok: false as const, error: "GoogleInactiveAccount" as const };
    }

    const updateData: { emailVerifiedAt?: Date; authProvider?: "GOOGLE" | "BOTH" } = {};
    if (existingUser.role === "STUDENT" && !existingUser.emailVerifiedAt) {
      updateData.emailVerifiedAt = new Date();
    }
    if (existingUser.authProvider === "PASSWORD") {
      updateData.authProvider = "BOTH";
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: updateData,
      });
    }

    if (existingUser.role === "STUDENT" && !existingUser.studentProfile) {
      const rollNumber = extractRollNumberFromEmail(normalizedEmail);
      if (!rollNumber || !existingUser.collegeId) {
        return { ok: false as const, error: "GoogleNoAcademicRecord" as const };
      }

      const academic = await prisma.studentAcademic.findUnique({
        where: {
          collegeId_rollNumber: {
            collegeId: existingUser.collegeId,
            rollNumber,
          },
        },
      });

      if (!academic) {
        return { ok: false as const, error: "GoogleNoAcademicRecord" as const };
      }

      await prisma.studentProfile.upsert({
        where: { userId: existingUser.id },
        update: {
          academicId: academic.id,
          profileCompleted: true,
        },
        create: {
          userId: existingUser.id,
          academicId: academic.id,
          profileCompleted: true,
        },
      });
    }

    return { ok: true as const };
  }

  const rollNumber = extractRollNumberFromEmail(normalizedEmail);
  if (!rollNumber) {
    return { ok: false as const, error: "GoogleNoAcademicRecord" as const };
  }

  const domainPart = normalizedEmail.split("@")[1];
  if (!domainPart) {
    return { ok: false as const, error: "GoogleEmailRequired" as const };
  }

  const rollCollegeCode = getCollegeCodeFromRoll(rollNumber);
  let college = await prisma.college.findUnique({
    where: { emailDomain: domainPart },
  });

  if (!college && rollCollegeCode) {
    college = await prisma.college.findUnique({
      where: { code: rollCollegeCode },
    });
  }

  if (!college) {
    return { ok: false as const, error: "GoogleNoCollege" as const };
  }

  const academic = await prisma.studentAcademic.findUnique({
    where: {
      collegeId_rollNumber: {
        collegeId: college.id,
        rollNumber,
      },
    },
  });

  if (!academic) {
    return { ok: false as const, error: "GoogleNoAcademicRecord" as const };
  }

  await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: academic.studentName ?? displayName ?? rollNumber,
        email: normalizedEmail,
        role: "STUDENT",
        status: "ACTIVE",
        authProvider: "GOOGLE",
        emailVerifiedAt: new Date(),
        collegeId: college.id,
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: createdUser.id,
        academicId: academic.id,
        profileCompleted: true,
      },
    });
  });

  return { ok: true as const };
}

const providers: NonNullable<NextAuthOptions["providers"]> = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const normalizedEmail = credentials.email.trim().toLowerCase();
      let user = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      // Allow roll-based login aliases like 160421733001@college by resolving through roll number.
      if (!user) {
        const rollNumber = extractRollNumberFromEmail(normalizedEmail);
        if (rollNumber) {
          const academic = await prisma.studentAcademic.findFirst({
            where: { rollNumber },
            select: {
              studentProfile: {
                select: {
                  user: true,
                },
              },
            },
          });
          user = academic?.studentProfile?.user ?? null;
        }
      }

      if (!user || !user.passwordHash) {
        return null;
      }

      if (user.status !== "ACTIVE") {
        return null;
      }

      if (user.role === "STUDENT" && !user.emailVerifiedAt) {
        return null;
      }

      const isValid = await compare(credentials.password, user.passwordHash);

      if (!isValid) {
        return null;
      }

      return {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        image: user.profileImageUrl ?? undefined,
        role: user.role,
      };
    },
  }),
];

const appEnv = getEnv();

if (appEnv.GOOGLE_CLIENT_ID && appEnv.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: appEnv.GOOGLE_CLIENT_ID,
      clientSecret: appEnv.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      const normalizedEmail = user.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return toGoogleSignInErrorPath("GoogleEmailRequired");
      }

      try {
        const result = await ensureGoogleUser(normalizedEmail, user.name);
        if (!result.ok) {
          return toGoogleSignInErrorPath(result.error);
        }
      } catch (error) {
        logError("auth.google.provisioning.failed", error, { email: normalizedEmail });
        return toGoogleSignInErrorPath("GoogleProvisioningFailed");
      }

      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.image === "string") {
          session.user.image = token.image;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        const userWithRole = user as { role?: string };
        token.id = String(user.id);
        token.role = userWithRole.role;
        if ("image" in user && typeof user.image === "string") {
          token.image = user.image;
        }
      }

      if (token.email && (!token.role || !token.id || Number.isNaN(Number(token.id)))) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, role: true, name: true, email: true, profileImageUrl: true },
        });
        if (dbUser) {
          token.id = String(dbUser.id);
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.image = dbUser.profileImageUrl ?? undefined;
        }
      }
      return token;
    },
  },
};
