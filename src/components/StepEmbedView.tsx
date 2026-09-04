import { toEmbedUrl } from "@/lib/embed";
import type { StepEmbed } from "@/lib/types";

export function StepEmbedView({ embed }: { embed: StepEmbed }) {
  if (embed.kind === "video") {
    const playerUrl = toEmbedUrl(embed.url);
    if (playerUrl) {
      return (
        <div className="aspect-video rounded-lg overflow-hidden border border-rule bg-surface-2">
          <iframe src={playerUrl} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={embed.label} />
        </div>
      );
    }
    return <EmbedLink embed={embed} icon="▶" />;
  }
  if (embed.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={embed.url} alt={embed.label} className="rounded-lg border border-rule max-h-96" />;
  }
  return <EmbedLink embed={embed} icon="🔗" />;
}

function EmbedLink({ embed, icon }: { embed: StepEmbed; icon: string }) {
  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 border border-rule rounded-lg bg-surface-2 px-4 py-3 text-sm text-navy hover:border-navy w-fit"
    >
      <span>{icon}</span>
      {embed.label || embed.url}
      <span className="text-ink-3">↗</span>
    </a>
  );
}
