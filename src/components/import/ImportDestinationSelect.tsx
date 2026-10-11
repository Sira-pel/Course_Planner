export type ImportDestination = 'pool' | 'active' | 'new';

export function ImportDestinationSelect({
  value,
  activePlanName,
  newPlanName,
  onChange,
}: {
  value: ImportDestination;
  activePlanName: string;
  newPlanName: string;
  onChange: (value: ImportDestination) => void;
}) {
  return (
    <select
      aria-label="Where to put the courses"
      value={value}
      onChange={(event) => onChange(event.target.value as ImportDestination)}
      className="min-w-0 flex-1 max-w-[16rem] min-h-11 sm:min-h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-base sm:text-xs font-semibold text-slate-800 dark:text-slate-100"
    >
      <option value="pool">Pool only</option>
      <option value="active">{activePlanName}</option>
      <option value="new">New {newPlanName}</option>
    </select>
  );
}
