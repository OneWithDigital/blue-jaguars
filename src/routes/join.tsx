import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Boot } from "@/components/boot";
import { rememberJoinCode } from "@/lib/join-code";

/**
 * Join link for new families: /join?code=PARENTCODE. Remembers the code, skips
 * the intro film, opens sign-up, and the team code fills itself after sign-in.
 */
export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: JoinLink,
});

function JoinLink() {
  const { code } = Route.useSearch();
  useEffect(() => {
    if (code) rememberJoinCode(code);
    try {
      sessionStorage.setItem("bj-intro", "1");
      sessionStorage.setItem("bj-signup", "1");
    } catch {
      // storage unavailable
    }
    window.location.replace("/");
  }, [code]);
  return <Boot label="Opening the team room" />;
}
