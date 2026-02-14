import { AuthProvider, Prisma, PrismaClient, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function seedColleges() {
  const [college1, college2] = await Promise.all([
    prisma.college.upsert({
      where: { emailDomain: "example.edu" },
      update: {},
      create: {
        name: "Example Institute of Technology",
        emailDomain: "example.edu",
        code: "1601",
      },
    }),
    prisma.college.upsert({
      where: { emailDomain: "univ.ac.in" },
      update: {},
      create: {
        name: "University of Engineering",
        emailDomain: "univ.ac.in",
        code: "1602",
      },
    }),
  ]);

  return { college1, college2 };
}

async function seedUsers(collegeId: number) {
  const passwordHash = await hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@campuslink.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@campuslink.com",
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.PASSWORD,
    },
  });

  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@bigtech.com" },
    update: {},
    create: {
      name: "Recruiter User",
      email: "recruiter@bigtech.com",
      passwordHash,
      role: Role.RECRUITER,
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.PASSWORD,
      collegeId,
    },
  });

  const students = await Promise.all(
    Array.from({ length: 5 }).map(async (_, index) => {
      const rollNumber = `16042173300${index + 1}`;
      const email = `${rollNumber}@example.edu`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          collegeId,
          emailVerifiedAt: new Date(),
        },
        create: {
          name: `Student User ${index + 1}`,
          email,
          passwordHash,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
          authProvider: AuthProvider.PASSWORD,
          collegeId,
          emailVerifiedAt: new Date(),
        },
      });

      return {
        user,
        rollNumber,
        branch: index % 2 === 0 ? "Computer Science and Engineering" : "Information Technology",
        batchYear: 2024,
        currentCgpa: Number((7.5 + index * 0.2).toFixed(2)),
      };
    })
  );

  return { admin, recruiter, students };
}

async function seedAcademicData(
  collegeId: number,
  students: Array<{
    user: { id: number; name: string };
    rollNumber: string;
    branch: string;
    batchYear: number;
    currentCgpa: number;
  }>
) {
  const resultLinkSem1 = await prisma.resultLink.upsert({
    where: { url: "https://example.edu/results/sem1" },
    update: { title: "Semester 1 Results", isProcessed: true },
    create: {
      url: "https://example.edu/results/sem1",
      title: "Semester 1 Results",
      isProcessed: true,
    },
  });

  const resultLinkSem2 = await prisma.resultLink.upsert({
    where: { url: "https://example.edu/results/sem2" },
    update: { title: "Semester 2 Results", isProcessed: true },
    create: {
      url: "https://example.edu/results/sem2",
      title: "Semester 2 Results",
      isProcessed: true,
    },
  });

  const examSem1 =
    (await prisma.exam.findFirst({
      where: {
        resultLinkId: resultLinkSem1.id,
        name: "Semester 1",
        semester: 1,
      },
    })) ??
    (await prisma.exam.create({
      data: {
        name: "Semester 1",
        semester: 1,
        monthYear: "Dec-2024",
        type: "MAIN",
        resultLinkId: resultLinkSem1.id,
      },
    }));

  const examSem2 =
    (await prisma.exam.findFirst({
      where: {
        resultLinkId: resultLinkSem2.id,
        name: "Semester 2",
        semester: 2,
      },
    })) ??
    (await prisma.exam.create({
      data: {
        name: "Semester 2",
        semester: 2,
        monthYear: "Jun-2025",
        type: "MAIN",
        resultLinkId: resultLinkSem2.id,
      },
    }));

  for (let index = 0; index < students.length; index += 1) {
    const student = students[index];

    const academic = await prisma.studentAcademic.upsert({
      where: {
        collegeId_rollNumber: {
          collegeId,
          rollNumber: student.rollNumber,
        },
      },
      update: {
        studentName: student.user.name,
        branch: student.branch,
        batchYear: student.batchYear,
        currentCgpa: new Prisma.Decimal(student.currentCgpa),
        overallSgpa: new Prisma.Decimal(student.currentCgpa),
      },
      create: {
        collegeId,
        rollNumber: student.rollNumber,
        studentName: student.user.name,
        branch: student.branch,
        batchYear: student.batchYear,
        currentCgpa: new Prisma.Decimal(student.currentCgpa),
        overallSgpa: new Prisma.Decimal(student.currentCgpa),
        semesters: Prisma.JsonNull,
        rawPayload: Prisma.JsonNull,
      },
    });

    await prisma.studentProfile.upsert({
      where: { userId: student.user.id },
      update: {
        academicId: academic.id,
        profileCompleted: true,
      },
      create: {
        userId: student.user.id,
        academicId: academic.id,
        headline: "Aspiring Software Engineer",
        about: "Passionate about building reliable software systems.",
        yearOfStudy: 2,
        ussScore: new Prisma.Decimal(78 + index),
        profileCompleted: true,
      },
    });

    await prisma.studentResult.upsert({
      where: {
        rollNumber_examId: {
          rollNumber: student.rollNumber,
          examId: examSem1.id,
        },
      },
      update: {
        sgpa: new Prisma.Decimal((student.currentCgpa - 0.4).toFixed(2)),
        backlogCount: index % 3 === 0 ? 1 : 0,
        resultStatus: "PASSED",
        studentAcademicId: academic.id,
      },
      create: {
        rollNumber: student.rollNumber,
        examId: examSem1.id,
        sgpa: new Prisma.Decimal((student.currentCgpa - 0.4).toFixed(2)),
        backlogCount: index % 3 === 0 ? 1 : 0,
        resultStatus: "PASSED",
        studentAcademicId: academic.id,
      },
    });

    await prisma.studentResult.upsert({
      where: {
        rollNumber_examId: {
          rollNumber: student.rollNumber,
          examId: examSem2.id,
        },
      },
      update: {
        sgpa: new Prisma.Decimal(student.currentCgpa.toFixed(2)),
        backlogCount: index % 4 === 0 ? 1 : 0,
        resultStatus: "PASSED",
        studentAcademicId: academic.id,
      },
      create: {
        rollNumber: student.rollNumber,
        examId: examSem2.id,
        sgpa: new Prisma.Decimal(student.currentCgpa.toFixed(2)),
        backlogCount: index % 4 === 0 ? 1 : 0,
        resultStatus: "PASSED",
        studentAcademicId: academic.id,
      },
    });
  }
}

async function main() {
  console.log("Start seeding...");
  const { college1 } = await seedColleges();
  const { admin, recruiter, students } = await seedUsers(college1.id);

  await seedAcademicData(college1.id, students);

  console.log("Seeding finished.", {
    admin: admin.email,
    recruiter: recruiter.email,
    students: students.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
