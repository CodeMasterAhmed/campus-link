import { randomInt } from "crypto";
import { UserRepository } from "../repos/userRepository";
import { CollegeRepository } from "../repos/collegeRepository";
import { prisma } from "../../lib/prisma";
import { hashPassword, hashVerificationToken, verifyPassword } from "../utils/hash";
import { sendEmail } from "../utils/email";
import { getCollegeCodeFromRoll } from "../../lib/student";

const userRepo = new UserRepository();
const collegeRepo = new CollegeRepository();

function generateVerificationToken() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export class AuthService {
  async registerStudent(payload: {
    name: string;
    email: string;
    password?: string;
    rollNumber: string;
    collegeDomain?: string;
  }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const [localPart, domainPart] = normalizedEmail.split("@");
    if (!localPart || !domainPart) throw new Error("Invalid email");
    if (!/^\d{12}$/.test(payload.rollNumber)) throw new Error("Roll number must be 12 digits");
    if (localPart !== payload.rollNumber)
      throw new Error("Email must use roll number as local-part (e.g. 160421733001@college)");

    const rollCollegeCode = getCollegeCodeFromRoll(payload.rollNumber);
    const domain = payload.collegeDomain ?? domainPart;

    let college = await collegeRepo.findByEmailDomain(domain);
    if (!college && rollCollegeCode) {
      college = await collegeRepo.findByCode(rollCollegeCode);
    }
    if (!college) throw new Error("No college found for email domain");

    const canonicalEmail = `${payload.rollNumber}@${college.emailDomain}`;

    const existing = await userRepo.findByEmail(canonicalEmail);
    if (existing) throw new Error("User already exists");

    const academic = await prisma.studentAcademic.findUnique({
      where: {
        collegeId_rollNumber: {
          collegeId: college.id,
          rollNumber: payload.rollNumber,
        },
      },
    });
    if (!academic) {
      throw new Error("No academic record found for this roll number");
    }

    const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;

    const user = await userRepo.create({
      name: academic.studentName ?? payload.name,
      email: canonicalEmail,
      passwordHash,
      role: "STUDENT",
      collegeId: college.id,
      authProvider: payload.password ? "PASSWORD" : "GOOGLE",
      status: "ACTIVE",
    });

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { academicId: academic.id, profileCompleted: true },
      create: {
        userId: user.id,
        academicId: academic.id,
        profileCompleted: true,
      },
    });

    const token = generateVerificationToken();
    const tokenHash = hashVerificationToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id, purpose: "SIGNUP_VERIFICATION", consumedAt: null },
      });

      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          token: null,
          purpose: "SIGNUP_VERIFICATION",
          expiresAt,
        },
      });
      await sendEmail(
        user.email,
        "Your Campus Link verification token",
        `Your token is: ${token}\n\nThis OTP expires in 60 minutes and can only be used once.`
      );
    } catch (error) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      throw error;
    }

    return { user, tokenSent: true };
  }

  async registerRecruiter(payload: {
    name: string;
    email: string;
    password?: string;
    targetCollegeId?: number;
    reason?: string;
  }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = await userRepo.findByEmail(normalizedEmail);
    if (existing) throw new Error("User already exists");

    const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;

    const user = await userRepo.create({
      name: payload.name,
      email: normalizedEmail,
      passwordHash,
      role: "RECRUITER",
      status: "PENDING",
      authProvider: payload.password ? "PASSWORD" : "GOOGLE",
    });

    if (payload.targetCollegeId) {
      await prisma.recruiterCollegeRequest.create({ data: { recruiterId: user.id, targetCollegeId: payload.targetCollegeId, reason: payload.reason } });
    }

    return user;
  }

  async verifyEmail(userId: number, token: string) {
    const normalizedToken = token.trim();
    const tokenHash = hashVerificationToken(normalizedToken);

    const record = await prisma.emailVerificationToken.findUnique({
      where: { userId_purpose_tokenHash: { userId, purpose: "SIGNUP_VERIFICATION", tokenHash } },
    });
    if (!record) throw new Error("Invalid token");
    if (record.consumedAt) throw new Error("Token already used");
    if (record.expiresAt < new Date()) throw new Error("Token expired");

    await prisma.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });

    return true;
  }

  async authenticateByEmail(email: string, password: string) {
    const user = await userRepo.findByEmail(email);
    if (!user) return null;
    if (!user.passwordHash) return null;
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }
}
