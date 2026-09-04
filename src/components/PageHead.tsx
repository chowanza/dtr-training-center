export function PageHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mb-8">
      <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-copper mb-2">{eyebrow}</p>
      <h1 className="font-[var(--font-display)] font-bold text-3xl tracking-tight mb-2">{title}</h1>
      <p className="text-ink-2 max-w-2xl text-[15px]">{desc}</p>
    </div>
  );
}
