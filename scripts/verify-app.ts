type Check = {
  name: string;
  ok: boolean;
  details?: string;
};

type JsonMap = Record<string, unknown>;

const baseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:3001";

function asObject(value: unknown): JsonMap {
  return typeof value === "object" && value !== null ? (value as JsonMap) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(path: string): Promise<{ status: number; json: JsonMap }> {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  const text = await response.text();
  let parsed: JsonMap = {};
  try {
    parsed = JSON.parse(text) as JsonMap;
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, json: parsed };
}

async function postJson(path: string, payload: JsonMap): Promise<{ status: number; json: JsonMap }> {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let parsed: JsonMap = {};
  try {
    parsed = JSON.parse(text) as JsonMap;
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, json: parsed };
}

async function checkRoute(path: string): Promise<Check> {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  return {
    name: `route:${path}`,
    ok: response.status === 200,
    details: `status=${response.status}`,
  };
}

async function assertAppReachable() {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const reachable = await assertAppReachable();
  if (!reachable) {
    console.error(
      `[VERIFY_PRECONDITION] Could not reach ${baseUrl}. Start the app first (example: npm run dev -- --hostname 127.0.0.1 --port 3001) and rerun verify:app.`
    );
    process.exit(1);
  }

  const checks: Check[] = [];

  const health = await getJson("/api/health");
  checks.push({
    name: "api:health",
    ok: health.status === 200 && health.json.status === "ok",
    details: `status=${health.status}`,
  });

  const ready = await getJson("/api/ready");
  checks.push({
    name: "api:ready",
    ok: ready.status === 200 && ready.json.status === "ready",
    details: `status=${ready.status}`,
  });

  const stats = await getJson("/api/stats");
  const statsData = asObject(stats.json.data);
  const totalStudents = Number(statsData.totalStudents ?? 0);
  checks.push({
    name: "api:stats",
    ok: stats.status === 200 && stats.json.success === true && totalStudents > 0,
    details: `status=${stats.status}, totalStudents=${totalStudents}`,
  });

  const students = await getJson("/api/students?limit=5&page=1");
  const studentsData = asObject(students.json.data);
  const studentRows = asArray(studentsData.students);
  checks.push({
    name: "api:students",
    ok: students.status === 200 && students.json.success === true && studentRows.length > 0,
    details: `status=${students.status}, rows=${studentRows.length}`,
  });

  const firstStudent = asObject(studentRows[0]);
  const firstRoll = String(firstStudent.rollNumber ?? "");
  if (firstRoll) {
    const studentDetail = await getJson(`/api/students/${firstRoll}`);
    const studentDetailData = asObject(studentDetail.json.data);
    checks.push({
      name: "api:student-detail",
      ok:
        studentDetail.status === 200 &&
        studentDetail.json.success === true &&
        String(studentDetailData.rollNumber ?? "") === firstRoll,
      details: `status=${studentDetail.status}, roll=${firstRoll}`,
    });
  } else {
    checks.push({
      name: "api:student-detail",
      ok: false,
      details: "Could not determine first student roll number",
    });
  }

  const studentsBacklog = await getJson("/api/students?hasBacklogs=1&limit=5&page=1");
  const studentBacklogRows = asArray(asObject(studentsBacklog.json.data).students);
  const studentBacklogValid = studentBacklogRows.every((row) => Number(asObject(row).totalBacklogs ?? 0) > 0);
  checks.push({
    name: "api:students-backlog-filter",
    ok: studentsBacklog.status === 200 && studentsBacklog.json.success === true && studentBacklogValid,
    details: `status=${studentsBacklog.status}, rows=${studentBacklogRows.length}`,
  });

  const leaderboardBacklog = await getJson("/api/leaderboard?hasBacklogs=1&limit=5&page=1");
  const leaderboardRows = asArray(asObject(leaderboardBacklog.json.data).students);
  const leaderboardBacklogValid = leaderboardRows.every((row) => Number(asObject(row).totalBacklogs ?? 0) > 0);
  checks.push({
    name: "api:leaderboard-backlog-filter",
    ok: leaderboardBacklog.status === 200 && leaderboardBacklog.json.success === true && leaderboardBacklogValid,
    details: `status=${leaderboardBacklog.status}, rows=${leaderboardRows.length}`,
  });

  const unauthorizedMessages = await postJson("/api/messages", { receiverId: 1, body: "hello" });
  checks.push({
    name: "security:messages-unauth",
    ok: unauthorizedMessages.status === 401,
    details: `status=${unauthorizedMessages.status}`,
  });

  const unauthorizedAdmin = await postJson("/api/admin/colleges", {
    name: "Unauthorized Test College",
    emailDomain: "unauth.test",
    code: "9999",
  });
  checks.push({
    name: "security:admin-colleges-unauth",
    ok: unauthorizedAdmin.status === 401,
    details: `status=${unauthorizedAdmin.status}`,
  });

  const pageChecks = await Promise.all([
    checkRoute("/"),
    checkRoute("/students"),
    checkRoute("/leaderboard"),
    checkRoute("/login"),
    checkRoute("/signup"),
    checkRoute("/dashboard"),
    checkRoute("/assistant"),
    checkRoute("/messages"),
  ]);
  checks.push(...pageChecks);

  const failed = checks.filter((check) => !check.ok);
  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("[VERIFY_ERROR]", error);
  process.exit(1);
});
