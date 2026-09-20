import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset your password — Proudly" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
