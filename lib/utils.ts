import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGrade(grade: string | null): string {
  if (!grade) return "-";
  return grade;
}

export function formatSGPA(sgpa: number | null): string {
  if (sgpa === null || sgpa === undefined) return "-";
  return sgpa.toFixed(2);
}

export function getGradeColor(grade: string | null): string {
  if (!grade) return "text-gray-400";
  switch (grade) {
    case "O":
      return "text-green-400";
    case "A+":
      return "text-emerald-400";
    case "A":
      return "text-cyan-400";
    case "B+":
      return "text-blue-400";
    case "B":
      return "text-indigo-400";
    case "C":
      return "text-yellow-400";
    case "D":
      return "text-orange-400";
    case "F":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

export function getSGPAColor(sgpa: number | null): string {
  if (sgpa === null) return "text-gray-400";
  if (sgpa >= 9) return "text-green-400";
  if (sgpa >= 8) return "text-emerald-400";
  if (sgpa >= 7) return "text-cyan-400";
  if (sgpa >= 6) return "text-blue-400";
  if (sgpa >= 5) return "text-yellow-400";
  return "text-red-400";
}

export function getBranchName(code: string): string {
  const branches: Record<string, string> = {
    "732": "Civil Engineering",
    "733": "Computer Science & Engineering",
    "734": "Electrical & Electronics Engineering",
    "735": "Electronics & Communication Engineering",
    "736": "Mechanical Engineering",
    "737": "Information Technology",
    "739": "AI & Machine Learning",
    "747": "AI & Data Science",
  };
  return branches[code] || `Branch ${code}`;
}

export function getBranchShortName(code: string): string {
  const branches: Record<string, string> = {
    "732": "Civil",
    "733": "CSE",
    "734": "EEE",
    "735": "ECE",
    "736": "Mech",
    "737": "IT",
    "739": "AI&ML",
    "747": "AI&DS",
  };
  return branches[code] || code;
}

export function getYearFromRollNumber(rollNumber: string): number {
  // Format: 1604YYBBBXXX where YY is year
  const yearCode = rollNumber.substring(4, 6);
  return 2000 + parseInt(yearCode, 10);
}

export function getBranchFromRollNumber(rollNumber: string): string {
  // Format: 1604YYBBBXXX where BBB is branch
  return rollNumber.substring(6, 9);
}
