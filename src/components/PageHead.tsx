export function PageHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">{title}</h1>
      <p className="text-ink-2 max-w-2xl text-[14.5px]">{desc}</p>
    </div>
  );
}
