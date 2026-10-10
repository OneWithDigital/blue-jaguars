import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boot } from "@/components/boot";
import { IntroFilm } from "@/components/intro-film";
import { JoinStage } from "@/components/join-stage";
import { LoginStage } from "@/components/login-stage";
import { getMembership } from "@/lib/dojo-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    setSeen(sessionStorage.getItem("bj-intro") === "1");
  }, []);

  if (seen === null) return <Boot />;
  // The splash plays once per browser session for everyone, signed in or not.
  if (!seen) {
    return (
      <IntroFilm
        onDone={() => {
          sessionStorage.setItem("bj-intro", "1");
          setSeen(true);
        }}
      />
    );
  }
  if (isPending) return <Boot />;
  if (user) return <MemberDoor />;
  return <LoginStage />;
}

function MemberDoor() {
  const membership = useQuery({
    queryKey: ["membership"],
    queryFn: () => getMembership(),
  });

  if (membership.isLoading) return <Boot label="Checking the team list" />;
  if (membership.data?.joined) return <Navigate to="/app" search={{ section: "home" }} />;
  return <JoinStage />;
}
