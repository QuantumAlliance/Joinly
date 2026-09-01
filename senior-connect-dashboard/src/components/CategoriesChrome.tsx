/**
 * Heading block shared by Categories and Add Category — `Dashboard figma
 * design/Users-2.svg` and `Users-4.svg` draw the same eyebrow, title and pair of
 * count chips on both screens.
 */
function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-field border border-line bg-card px-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-lg font-bold text-action">{value}</span>
    </div>
  );
}

export default function CategoriesHeading({
  title,
  stats,
}: {
  title: string;
  stats?: { totalCategories: number; activeNow: number };
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Management</p>
        <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <CountChip label="Total Categories" value={stats?.totalCategories ?? 0} />
        <CountChip label="Active Now" value={stats?.activeNow ?? 0} />
      </div>
    </div>
  );
}
