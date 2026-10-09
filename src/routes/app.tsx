import { createFileRoute } from "@tanstack/react-router";
import { TeamRoom } from "@/components/team-room";
import { isSection, type Section } from "@/lib/dojo";

export const Route = createFileRoute("/app")({
  validateSearch: (search: Record<string, unknown>): { section: Section } => {
    const section = typeof search.section === "string" ? search.section : "home";
    return { section: isSection(section) ? section : "home" };
  },
  component: AppPage,
});

function AppPage() {
  const { section } = Route.useSearch();
  return <TeamRoom section={section} />;
}
