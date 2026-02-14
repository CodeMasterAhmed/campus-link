type NumericLike = number | string | { toString(): string } | null | undefined;

export type AcademicResultLike = {
  sgpa: NumericLike;
  backlogCount: number | null | undefined;
  exam?: {
    semester: number | null;
  } | null;
  createdAt?: Date;
};

function toNumber(value: NumericLike) {
  if (value === null || value === undefined) return null;
  const parsed = Number(typeof value === "number" ? value : value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function byLatestResult(a: AcademicResultLike, b: AcademicResultLike) {
  const semA = a.exam?.semester ?? -1;
  const semB = b.exam?.semester ?? -1;
  if (semA !== semB) return semB - semA;

  const timeA = a.createdAt?.getTime() ?? 0;
  const timeB = b.createdAt?.getTime() ?? 0;
  return timeB - timeA;
}

export function deriveAcademicMetrics(results: AcademicResultLike[]) {
  const normalized = [...results].sort(byLatestResult);

  const latestWithSgpa = normalized.find((row) => toNumber(row.sgpa) !== null);
  const latestSgpa = latestWithSgpa ? toNumber(latestWithSgpa.sgpa) : null;

  const sgpaValues = normalized
    .map((row) => toNumber(row.sgpa))
    .filter((value): value is number => value !== null);

  const averageSgpa =
    sgpaValues.length > 0
      ? Number((sgpaValues.reduce((sum, value) => sum + value, 0) / sgpaValues.length).toFixed(2))
      : null;

  const totalBacklogs = normalized.reduce((sum, row) => {
    const count = Number(row.backlogCount ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      return sum;
    }
    return sum + count;
  }, 0);

  return {
    latestSgpa,
    averageSgpa,
    totalBacklogs,
    latestSemester: latestWithSgpa?.exam?.semester ?? null,
  };
}

export function firstAvailableSgpa(...values: NumericLike[]) {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

export function parseOptionalBoolean(value: string | null): boolean | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
}
