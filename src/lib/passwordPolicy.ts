// Shared between server-side validation (signup/reset-password/settings
// actions) and the client-side strength meter — pure string checks with no
// server-only dependencies (unlike lib/password.ts's hashPassword, which
// needs node:crypto), so this is safe to import from a "use client" file.
export const PASSWORD_REQUIREMENTS: { key: string; label: string; test: (password: string) => boolean }[] = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  { key: "symbol", label: "One symbol (e.g. ! ? . #)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordRequirementErrors(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter((r) => !r.test(password)).map((r) => r.label);
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(password));
}
