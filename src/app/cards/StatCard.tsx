import { Card } from "../ui/Card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-ulv-blue">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </Card>
  );
}
