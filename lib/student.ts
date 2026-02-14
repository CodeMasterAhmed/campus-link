export function extractRollNumberFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const [localPart] = normalized.split("@");
  if (!localPart || !/^\d{12}$/.test(localPart)) return null;
  return localPart;
}

export function getCollegeCodeFromRoll(rollNumber: string | null | undefined): string | null {
  if (!rollNumber || !/^\d{12}$/.test(rollNumber)) return null;
  return rollNumber.slice(0, 4);
}
