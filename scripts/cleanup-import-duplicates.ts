import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const IMPORT_TAG = "jsonl-results-import-v1";
const IMPORT_PREFIX = `local://import/${IMPORT_TAG}/%`;

type CountRow = { count: bigint | number };

function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

async function getDuplicateGroupCount(): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int as count
    FROM (
      SELECT sr."rollNumber", e."semester"
      FROM "StudentResult" sr
      JOIN "Exam" e ON e.id = sr."examId"
      WHERE e."semester" IS NOT NULL
      GROUP BY sr."rollNumber", e."semester"
      HAVING COUNT(*) > 1
    ) d
  `;
  return toNumber(rows[0]?.count ?? 0);
}

async function runCleanup(): Promise<void> {
  const duplicateGroupsBefore = await getDuplicateGroupCount();

  const canonicalRolls = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int as count
    FROM "StudentAcademic"
    WHERE "rawPayload"->>'source' = ${IMPORT_TAG}
  `;

  // 1) Remove non-import results for canonical imported students.
  await prisma.$executeRaw`
    DELETE FROM "SubjectResult" s
    USING "StudentResult" sr
    JOIN "Exam" e ON e.id = sr."examId"
    JOIN "ResultLink" rl ON rl.id = e."resultLinkId"
    WHERE s."studentResultId" = sr.id
      AND sr."rollNumber" IN (
        SELECT "rollNumber"
        FROM "StudentAcademic"
        WHERE "rawPayload"->>'source' = ${IMPORT_TAG}
      )
      AND rl.url NOT LIKE ${IMPORT_PREFIX}
  `;

  await prisma.$executeRaw`
    DELETE FROM "StudentResult" sr
    USING "Exam" e, "ResultLink" rl
    WHERE sr."examId" = e.id
      AND e."resultLinkId" = rl.id
      AND sr."rollNumber" IN (
        SELECT "rollNumber"
        FROM "StudentAcademic"
        WHERE "rawPayload"->>'source' = ${IMPORT_TAG}
      )
      AND rl.url NOT LIKE ${IMPORT_PREFIX}
  `;

  // 2) Deduplicate remaining roll+semester groups deterministically.
  const duplicates = await prisma.$queryRaw<{ id: number }[]>`
    WITH ranked AS (
      SELECT
        sr.id,
        ROW_NUMBER() OVER (
          PARTITION BY sr."rollNumber", e."semester"
          ORDER BY
            CASE WHEN rl.url LIKE ${IMPORT_PREFIX} THEN 1 ELSE 0 END DESC,
            CASE WHEN sr.sgpa IS NOT NULL THEN 1 ELSE 0 END DESC,
            CASE WHEN sr."backlogCount" IS NOT NULL THEN 1 ELSE 0 END DESC,
            (
              SELECT COUNT(*)
              FROM "SubjectResult" s2
              WHERE s2."studentResultId" = sr.id
            ) DESC,
            sr.id DESC
        ) AS rn
      FROM "StudentResult" sr
      JOIN "Exam" e ON e.id = sr."examId"
      JOIN "ResultLink" rl ON rl.id = e."resultLinkId"
      WHERE e."semester" IS NOT NULL
    )
    SELECT id FROM ranked WHERE rn > 1
  `;

  if (duplicates.length > 0) {
    const duplicateIds = duplicates.map((row) => row.id);
    await prisma.subjectResult.deleteMany({ where: { studentResultId: { in: duplicateIds } } });
    await prisma.studentResult.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  const duplicateGroupsAfter = await getDuplicateGroupCount();

  console.log("========================================");
  console.log("Duplicate Cleanup Complete");
  console.log("========================================");
  console.log(`Canonical imported rolls: ${toNumber(canonicalRolls[0]?.count ?? 0)}`);
  console.log(`Duplicate roll+semester groups before: ${duplicateGroupsBefore}`);
  console.log(`Duplicate rows deleted: ${duplicates.length}`);
  console.log(`Duplicate roll+semester groups after: ${duplicateGroupsAfter}`);
}

runCleanup()
  .catch((error) => {
    console.error("[CLEANUP_ERROR]", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
