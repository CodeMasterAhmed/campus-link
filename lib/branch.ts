export type BranchDefinition = {
  code: string;
  shortLabel: string;
  fullName: string;
  aliases: string[];
};

export const BRANCH_DEFINITIONS: BranchDefinition[] = [
  {
    code: "732",
    shortLabel: "Civil",
    fullName: "Civil Engineering",
    aliases: ["civil", "ce", "civil engineering"],
  },
  {
    code: "733",
    shortLabel: "CSE",
    fullName: "Computer Science and Engineering",
    aliases: [
      "cse",
      "computer science",
      "computer science & engineering",
      "computer science and engineering",
    ],
  },
  {
    code: "734",
    shortLabel: "EEE",
    fullName: "Electrical and Electronics Engineering",
    aliases: [
      "eee",
      "electrical",
      "electrical and electronics engineering",
      "electrical & electronics engineering",
    ],
  },
  {
    code: "735",
    shortLabel: "ECE",
    fullName: "Electronics and Communication Engineering",
    aliases: [
      "ece",
      "electronics",
      "electronics and communication engineering",
      "electronics & communication engineering",
    ],
  },
  {
    code: "736",
    shortLabel: "Mech",
    fullName: "Mechanical Engineering",
    aliases: ["me", "mech", "mechanical", "mechanical engineering"],
  },
  {
    code: "737",
    shortLabel: "IT",
    fullName: "Information Technology",
    aliases: ["it", "information technology"],
  },
  {
    code: "739",
    shortLabel: "AI&ML",
    fullName: "Artificial Intelligence and Machine Learning",
    aliases: ["ai&ml", "ai and ml", "aiml", "artificial intelligence and machine learning"],
  },
  {
    code: "747",
    shortLabel: "AI&DS",
    fullName: "Artificial Intelligence and Data Science",
    aliases: [
      "ai&ds",
      "ai and ds",
      "aids",
      "cse (ai & ds)",
      "cse (ai and ds)",
      "artificial intelligence and data science",
    ],
  },
  {
    code: "748",
    shortLabel: "AI&ML",
    fullName: "Artificial Intelligence and Machine Learning",
    aliases: [
      "cse (ai & ml)",
      "cse (ai and ml)",
      "cse aiml",
      "artificial intelligence and machine learning",
      "ai&ml",
      "aiml",
    ],
  },
  {
    code: "750",
    shortLabel: "DS",
    fullName: "Data Science",
    aliases: ["cse (ds)", "data science", "ds"],
  },
  {
    code: "754",
    shortLabel: "AI",
    fullName: "Artificial Intelligence",
    aliases: ["cse (ai)", "artificial intelligence", "ai"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findBranch(value: string): BranchDefinition | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  const byCode = BRANCH_DEFINITIONS.find((b) => b.code === normalized);
  if (byCode) return byCode;

  return (
    BRANCH_DEFINITIONS.find(
      (b) =>
        normalize(b.fullName) === normalized ||
        normalize(b.shortLabel) === normalized ||
        b.aliases.map(normalize).includes(normalized)
    ) ?? null
  );
}

export function getCanonicalBranchCode(value: string | null | undefined): string | null {
  if (!value) return null;
  return findBranch(value)?.code ?? null;
}

export function getBranchDefinition(value: string | null | undefined): BranchDefinition | null {
  if (!value) return null;
  return findBranch(value);
}

export function getBranchDisplayName(value: string | null | undefined): string {
  if (!value) return "Unknown Branch";
  const definition = findBranch(value);
  if (definition) return definition.fullName;
  return value;
}

export function getBranchShortLabel(value: string | null | undefined): string {
  if (!value) return "NA";
  const definition = findBranch(value);
  if (definition) return definition.shortLabel;
  return value;
}

export function getBranchFilterVariants(value: string | null | undefined): string[] {
  if (!value) return [];
  const definition = findBranch(value);
  if (!definition) return [value];

  const variants = new Set<string>([
    definition.code,
    definition.fullName,
    definition.shortLabel,
    ...definition.aliases,
  ]);

  return Array.from(variants);
}
