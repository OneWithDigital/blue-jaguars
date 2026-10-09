import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Boot } from "@/components/boot";
import { LoginStage } from "@/components/login-stage";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Boot />;
  if (user) return <Navigate to="/" />;
  return <LoginStage />;
}
