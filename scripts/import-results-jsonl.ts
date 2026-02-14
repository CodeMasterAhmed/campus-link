import fs from "fs";
import path from "path";
import readline from "readline";
import * as dotenv from "dotenv";
import { Prisma, PrismaClient, ResultStatus } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_SOURCE_FILE = "/Users/ahmedraza/downloads/results (1).jsonl";
const REPORT_DIR = path.join(process.cwd(), "scripts", "reports");
const REPORT_FILE = path.join(REPORT_DIR, "results-import-report.json");
const IMPORT_TAG = "jsonl-results-import-v1";

type RawRow = {
  roll_number?: string;
  ok?: boolean;
  error?: string | null;
  found?: boolean;
  invalid_message?: string | null;
  name?: string | null;
  college?: string | null;
  program?: string | null;
  status?: string | null;
  graduation?: string | null;
  cgpa?: number | string | null;
  semesters?: Record<string, { sgpa?: number | string | null; backlogs?: number | string | null }> | null;
  roll_number_seen_on_page?: boolean;
};

type CandidateRow = {
  raw: RawRow;
  lineNo: number;
  rollNumber: string;
  isFound: boolean;
  rollSeen: boolean;
  validName: boolean;
  validProgram: boolean;
  validCollege: boolean;
  semCount: number;
  cgpa: number | null;
  score: number;
};

type ProgramInfo = {
  branchLabel: string;
  startYear: number;
  endYear: number;
};

type NormalizedSemester = {
  semester: number;
  sgpa: number | null;
  backlogCount: number;
  status: ResultStatus;
};

type CollegeMeta = {
  code: string;
  name: string;
  emailDomain: string;
  alias: string;
};

const COLLEGE_BY_CODE: Record<string, CollegeMeta> = {
  "1601": {
    code: "1601",
    name: "Chaitanya Bharathi Institute of Technology",
    emailDomain: "cbit.ac.in",
    alias: "CBIT",
  },
  "1602": {
    code: "1602",
    name: "Vasavi College of Engineering",
    emailDomain: "vasavi.ac.in",
    alias: "VASAVI",
  },
  "1603": {
    code: "1603",
    name: "Deccan College of Engineering and Technology",
    emailDomain: "dcet.ac.in",
    alias: "DCET",
  },
  "1604": {
    code: "1604",
    name: "Muffakham Jah College of Engineering and Technology",
    emailDomain: "mjcollege.ac.in",
    alias: "MJCET",
  },
  "1605": {
    code: "1605",
    name: "ISL Engineering College",
    emailDomain: "isl.ac.in",
    alias: "ISL",
  },
  "1606": {
    code: "1606",
    name: "Stanley College of Engineering and Technology for Women",
    emailDomain: "stanley.ac.in",
    alias: "STANLEY",
  },
  "1607": {
    code: "1607",
    name: "Methodist College of Engineering and Technology",
    emailDomain: "methodist.ac.in",
    alias: "METHODIST",
  },
  "1608": {
    code: "1608",
    name: "Matrusri Engineering College",
    emailDomain: "matrusri.ac.in",
    alias: "MATRUSRI",
  },
};

const BRANCH_NAME_BY_CODE: Record<string, string> = {
  "732": "Civil Engineering",
  "733": "Computer Science and Engineering",
  "735": "Electronics and Communication Engineering",
  "736": "Mechanical Engineering",
  "747": "Artificial Intelligence and Data Science",
  "748": "Artificial Intelligence and Machine Learning",
  "750": "Data Science",
  "754": "Artificial Intelligence",
};

function normalizeSpaces(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function decodeBasicHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#10;/g, " ");
}

function parseProgramInfo(program: string | null | undefined): ProgramInfo | null {
  if (!program) return null;
  const decoded = normalizeSpaces(decodeBasicHtml(program));
  const match = decoded.match(/^(.+?)\s*:\s*(\d{4})\s*-\s*(\d{4})$/);
  if (!match) return null;

  const startYear = Number(match[2]);
  const endYear = Number(match[3]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || startYear >= endYear) return null;

  return {
    branchLabel: normalizeSpaces(match[1]),
    startYear,
    endYear,
  };
}

function isSuspiciousText(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.includes("notification") ||
    v.includes("youtube") ||
    v.includes("drag handle") ||
    v.includes("minimized player") ||
    v.includes("expand mini player")
  );
}

function validName(name: string | null | undefined): boolean {
  if (!name) return false;
  const cleaned = normalizeSpaces(name);
  if (cleaned.length < 3) return false;
  if (isSuspiciousText(cleaned)) return false;
  if (!/[a-z]/i.test(cleaned)) return false;
  return true;
}

function validCollegeAlias(alias: string | null | undefined): boolean {
  if (!alias) return false;
  const cleaned = normalizeSpaces(alias).toUpperCase();
  return ["MJCET", "DCET", "ISL"].includes(cleaned);
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseSemesters(raw: RawRow["semesters"]): NormalizedSemester[] {
  if (!raw || typeof raw !== "object") return [];

  const out: NormalizedSemester[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const semMatch = key.match(/semester\s*(\d+)/i);
    if (!semMatch) continue;

    const semester = Number(semMatch[1]);
    if (!Number.isFinite(semester) || semester < 1 || semester > 12) continue;

    const sgpa = parseNumeric(value?.sgpa ?? null);
    const backlogRaw = parseNumeric(value?.backlogs ?? null);
    const backlogCount = backlogRaw && backlogRaw > 0 ? Math.trunc(backlogRaw) : 0;

    const status = backlogCount > 0 ? ResultStatus.FAILED : ResultStatus.PASSED;

    out.push({ semester, sgpa, backlogCount, status });
  }

  return out.sort((a, b) => a.semester - b.semester);
}

function mapTopStatus(status: string | null | undefined): ResultStatus {
  const normalized = normalizeSpaces((status ?? "").toUpperCase());
  if (normalized === "PASSED") return ResultStatus.PASSED;
  if (normalized === "FAILED") return ResultStatus.FAILED;
  if (normalized === "PROMOTED") return ResultStatus.PROMOTED;
  if (normalized === "DETAINED") return ResultStatus.DETAINED;
  if (normalized === "ABSENT") return ResultStatus.ABSENT;
  if (normalized === "MALPRACTICE") return ResultStatus.MALPRACTICE;
  return ResultStatus.FAILED;
}

function scoreRow(raw: RawRow, semCount: number): number {
  let score = 0;

  if (raw.found === true) score += 100;
  if (raw.found === false) score -= 40;
  if (raw.roll_number_seen_on_page === true) score += 20;
  if (raw.roll_number_seen_on_page === false) score -= 20;
  if (validName(raw.name)) score += 10;
  if (parseProgramInfo(raw.program)) score += 10;
  if (validCollegeAlias(raw.college)) score += 5;
  if (semCount > 0) score += Math.min(semCount, 4) * 2;
  if (parseNumeric(raw.cgpa) !== null) score += 4;
  if (raw.error) score -= 30;
  if (raw.invalid_message) score -= 10;
  if (isSuspiciousText(raw.name) || isSuspiciousText(raw.program) || isSuspiciousText(raw.college)) score -= 80;

  return score;
}

function betterCandidate(a: CandidateRow, b: CandidateRow): CandidateRow {
  if (a.score !== b.score) return a.score > b.score ? a : b;
  if (a.isFound !== b.isFound) return a.isFound ? a : b;
  if (a.rollSeen !== b.rollSeen) return a.rollSeen ? a : b;
  if (a.semCount !== b.semCount) return a.semCount > b.semCount ? a : b;
  if (a.validProgram !== b.validProgram) return a.validProgram ? a : b;
  return a.lineNo > b.lineNo ? a : b;
}

async function ensureCollege(code: string): Promise<{ id: number; code: string }> {
  const existing = await prisma.college.findUnique({ where: { code }, select: { id: true, code: true } });
  if (existing) return existing;

  const meta = COLLEGE_BY_CODE[code] ?? {
    code,
    name: `Engineering College ${code}`,
    emailDomain: `college${code}.edu`,
    alias: code,
  };

  const created = await prisma.college.create({
    data: {
      code: meta.code,
      name: meta.name,
      emailDomain: meta.emailDomain,
      isActive: true,
    },
    select: { id: true, code: true },
  });

  return created;
}

function toDecimal(value: number | null): Prisma.Decimal | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value.toFixed(2));
}

function toSemesterJson(semesters: NormalizedSemester[]): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  if (semesters.length === 0) return Prisma.JsonNull;
  return semesters.map((s) => ({
    semester: s.semester,
    sgpa: s.sgpa,
    backlogs: s.backlogCount,
    status: s.status,
  })) as Prisma.InputJsonValue;
}

async function main() {
  const sourceFile = process.argv[2] ?? DEFAULT_SOURCE_FILE;
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source file not found: ${sourceFile}`);
  }

  const grouped = new Map<string, CandidateRow[]>();
  let totalRows = 0;
  let malformedRows = 0;

  const reader = readline.createInterface({
    input: fs.createReadStream(sourceFile, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  for await (const line of reader) {
    lineNo += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    totalRows += 1;
    let parsed: RawRow;
    try {
      parsed = JSON.parse(trimmed) as RawRow;
    } catch {
      malformedRows += 1;
      continue;
    }

    const rollNumber = String(parsed.roll_number ?? "").trim();
    if (!/^\d{12}$/.test(rollNumber)) continue;

    const semCount = parseSemesters(parsed.semesters).length;
    const candidate: CandidateRow = {
      raw: parsed,
      lineNo,
      rollNumber,
      isFound: parsed.found === true,
      rollSeen: parsed.roll_number_seen_on_page === true,
      validName: validName(parsed.name),
      validProgram: Boolean(parseProgramInfo(parsed.program)),
      validCollege: validCollegeAlias(parsed.college),
      semCount,
      cgpa: parseNumeric(parsed.cgpa),
      score: scoreRow(parsed, semCount),
    };

    const bucket = grouped.get(rollNumber);
    if (!bucket) grouped.set(rollNumber, [candidate]);
    else bucket.push(candidate);
  }

  const selected = new Map<string, CandidateRow>();
  let duplicateRolls = 0;
  let conflictRolls = 0;

  for (const [roll, rows] of grouped.entries()) {
    if (rows.length > 1) duplicateRolls += 1;

    const picked = rows.reduce((best, row) => betterCandidate(best, row));
    selected.set(roll, picked);

    const foundRows = rows.filter((r) => r.isFound);
    if (foundRows.length > 1) {
      const names = new Set(foundRows.map((r) => normalizeSpaces(r.raw.name ?? "")));
      const cgpas = new Set(foundRows.map((r) => r.cgpa ?? null));
      const semShapes = new Set(
        foundRows.map((r) => JSON.stringify((r.raw.semesters ?? {}) as Record<string, unknown>, Object.keys((r.raw.semesters ?? {}) as object).sort()))
      );
      if (names.size > 1 || cgpas.size > 1 || semShapes.size > 1) conflictRolls += 1;
    }
  }

  const collegesByCode = new Map<string, { id: number; code: string }>();
  const resultLinkByCollege = new Map<string, { id: number }>();
  const examByCollegeAndSemester = new Map<string, { id: number }>();

  for (const roll of selected.keys()) {
    const code = roll.slice(0, 4);
    if (!collegesByCode.has(code)) {
      const college = await ensureCollege(code);
      collegesByCode.set(code, college);

      const resultLink = await prisma.resultLink.upsert({
        where: { url: `local://import/${IMPORT_TAG}/${code}` },
        update: {
          title: `${IMPORT_TAG} - College ${code}`,
          isProcessed: true,
        },
        create: {
          url: `local://import/${IMPORT_TAG}/${code}`,
          title: `${IMPORT_TAG} - College ${code}`,
          isProcessed: true,
          publishedDate: new Date(),
        },
        select: { id: true },
      });
      resultLinkByCollege.set(code, resultLink);
    }
  }

  let importedAcademics = 0;
  let importedStudentResults = 0;
  let missingResultRows = 0;

  const students = Array.from(selected.values()).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

  for (const row of students) {
    const roll = row.rollNumber;
    const collegeCode = roll.slice(0, 4);
    const branchCode = roll.slice(6, 9);
    const batchYear = 2000 + Number(roll.slice(4, 6));

    const college = collegesByCode.get(collegeCode);
    const resultLink = resultLinkByCollege.get(collegeCode);
    if (!college || !resultLink) {
      throw new Error(`Missing college/resultLink cache for ${collegeCode}`);
    }

    const semesters = parseSemesters(row.raw.semesters);
    const latestSemester = semesters.length > 0 ? semesters[semesters.length - 1] : null;
    const cgpa = row.cgpa;

    if (!row.isFound) missingResultRows += 1;

    const academic = await prisma.studentAcademic.upsert({
      where: {
        collegeId_rollNumber: {
          collegeId: college.id,
          rollNumber: roll,
        },
      },
      update: {
        studentName: row.validName ? normalizeSpaces(row.raw.name ?? "") : null,
        currentCgpa: toDecimal(cgpa),
        overallSgpa: toDecimal(latestSemester?.sgpa ?? null),
        batchYear,
        branch: branchCode,
        semesters: toSemesterJson(semesters),
        lastScrapedAt: new Date(),
        rawPayload: {
          source: IMPORT_TAG,
          sourceLine: row.lineNo,
          score: row.score,
          selectedFromDuplicates: grouped.get(roll)?.length ?? 1,
          found: row.isFound,
          topLevelStatus: row.raw.status,
          graduation: row.raw.graduation,
          collegeAlias: row.raw.college,
          program: row.raw.program,
          invalidMessage: row.raw.invalid_message,
          error: row.raw.error,
        } as Prisma.InputJsonValue,
      },
      create: {
        collegeId: college.id,
        rollNumber: roll,
        studentName: row.validName ? normalizeSpaces(row.raw.name ?? "") : null,
        currentCgpa: toDecimal(cgpa),
        overallSgpa: toDecimal(latestSemester?.sgpa ?? null),
        batchYear,
        branch: branchCode,
        semesters: toSemesterJson(semesters),
        lastScrapedAt: new Date(),
        rawPayload: {
          source: IMPORT_TAG,
          sourceLine: row.lineNo,
          score: row.score,
          selectedFromDuplicates: grouped.get(roll)?.length ?? 1,
          found: row.isFound,
          topLevelStatus: row.raw.status,
          graduation: row.raw.graduation,
          collegeAlias: row.raw.college,
          program: row.raw.program,
          invalidMessage: row.raw.invalid_message,
          error: row.raw.error,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, rollNumber: true },
    });

    importedAcademics += 1;

    for (const sem of semesters) {
      const examKey = `${collegeCode}:${sem.semester}`;
      let exam = examByCollegeAndSemester.get(examKey);
      if (!exam) {
        const existingExam = await prisma.exam.findFirst({
          where: {
            resultLinkId: resultLink.id,
            semester: sem.semester,
          },
          select: { id: true },
        });

        exam =
          existingExam ??
          (await prisma.exam.create({
            data: {
              name: `${IMPORT_TAG} - ${collegeCode} - Semester ${sem.semester}`,
              monthYear: "Imported Dataset",
              semester: sem.semester,
              type: "MAIN",
              resultLinkId: resultLink.id,
            },
            select: { id: true },
          }));

        examByCollegeAndSemester.set(examKey, exam);
      }

      const studentResult = await prisma.studentResult.upsert({
        where: {
          rollNumber_examId: {
            rollNumber: roll,
            examId: exam.id,
          },
        },
        update: {
          sgpa: toDecimal(sem.sgpa),
          resultStatus: sem.status ?? mapTopStatus(row.raw.status),
          studentAcademicId: academic.id,
          backlogCount: sem.backlogCount,
        },
        create: {
          rollNumber: roll,
          examId: exam.id,
          sgpa: toDecimal(sem.sgpa),
          resultStatus: sem.status ?? mapTopStatus(row.raw.status),
          studentAcademicId: academic.id,
          backlogCount: sem.backlogCount,
        },
        select: { id: true },
      });

      // Current source has no subject-wise data, so clear any stale subject rows for this imported result.
      await prisma.subjectResult.deleteMany({ where: { studentResultId: studentResult.id } });
      importedStudentResults += 1;
    }
  }

  const branchCounts = new Map<string, number>();
  for (const roll of selected.keys()) {
    const code = roll.slice(6, 9);
    branchCounts.set(code, (branchCounts.get(code) ?? 0) + 1);
  }

  const collegeCounts = new Map<string, number>();
  for (const roll of selected.keys()) {
    const code = roll.slice(0, 4);
    collegeCounts.set(code, (collegeCounts.get(code) ?? 0) + 1);
  }

  const report = {
    sourceFile,
    generatedAt: new Date().toISOString(),
    totals: {
      totalRows,
      malformedRows,
      uniqueRollNumbers: selected.size,
      duplicateRollNumbers: duplicateRolls,
      conflictingDuplicateRollNumbers: conflictRolls,
      importedAcademics,
      importedStudentResults,
      missingResultRows,
      foundRowsSelected: Array.from(selected.values()).filter((r) => r.isFound).length,
    },
    byCollegeCode: Array.from(collegeCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        college: COLLEGE_BY_CODE[code]?.name ?? `Engineering College ${code}`,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    byBranchCode: Array.from(branchCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        branch: BRANCH_NAME_BY_CODE[code] ?? `Branch ${code}`,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log("========================================");
  console.log("Campus Link JSONL Import Complete");
  console.log("========================================");
  console.log(`Source: ${sourceFile}`);
  console.log(`Rows parsed: ${totalRows}`);
  console.log(`Unique roll numbers: ${selected.size}`);
  console.log(`Imported academics: ${importedAcademics}`);
  console.log(`Imported semester results: ${importedStudentResults}`);
  console.log(`Students with no result row: ${missingResultRows}`);
  console.log(`Duplicate rolls: ${duplicateRolls}`);
  console.log(`Conflicting duplicates: ${conflictRolls}`);
  console.log(`Report: ${REPORT_FILE}`);
}

main()
  .catch((error) => {
    console.error("[IMPORT_ERROR]", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
