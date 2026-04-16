import { Link } from "react-router-dom";
import type { Debate } from "../../types/debate";
import { Badge } from "../ui/Badge";

const rotationClasses = ["rotate-[-0.5deg]", "rotate-[1.2deg]", "rotate-[-1deg]"];

function getActionLabel(status: Debate["status"]) {
  switch (status) {
    case "active":
      return "Resume";
    case "pending":
      return "Join Debate";
    case "completed":
      return "View Analysis";
    case "failed":
      return "Review";
    case "starting":
      return "Preparing";
    case "ending":
      return "Wrapping Up";
    default:
      return "Open";
  }
}

export function DebateCard({ debate, index }: { debate: Debate; index: number }) {
  const rotationClass = rotationClasses[index % rotationClasses.length];

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-8 sticker-shadow ${rotationClass} border border-outline-variant/10 hover:rotate-0 transition-transform duration-300 flex flex-col min-h-[320px]`}
    >
      <div className="flex justify-between items-start mb-6">
        <Badge status={debate.status} />
        <span className="material-symbols-outlined text-primary-container">trending_up</span>
      </div>
      <h3 className="text-2xl font-headline font-extrabold text-on-background mb-4 leading-tight">
        {debate.title}
      </h3>
      <p className="text-on-surface-variant text-sm mb-auto">{debate.topic}</p>
      <div className="mt-8 pt-6 border-t border-surface-container">
        <Link
          to={debate.status === "completed" ? `/analysis/${debate.id}` : `/debates/${debate.id}`}
          className="w-full inline-flex items-center justify-center bg-primary text-on-primary py-4 rounded-full font-headline font-bold uppercase tracking-wider text-sm spring-bounce-interaction"
        >
          {getActionLabel(debate.status)}
        </Link>
      </div>
    </div>
  );
}
