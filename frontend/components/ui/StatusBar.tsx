type StatusBarProps = {
  date: string;
};

export function StatusBar({ date }: StatusBarProps) {
  return (
    <div className="rounded-md border border-border bg-surface px-md py-sm text-xs font-medium text-inkSecondary shadow-panel">
      {date ? `기준일: ${date}` : "데이터 없음"}
    </div>
  );
}
