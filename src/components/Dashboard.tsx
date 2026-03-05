import { ArrowDownCircle, ArrowUpCircle, DollarSign } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  incomes: number;
  expenses: number;
}

export function Dashboard({ incomes, expenses }: DashboardProps) {
  const balance = incomes - expenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card
        title="Entradas"
        amount={incomes}
        icon={<ArrowUpCircle className="w-6 h-6 text-[#39FF14]" />}
        className="border-l-4 border-[#39FF14]"
      />
      <Card
        title="Saídas"
        amount={expenses}
        icon={<ArrowDownCircle className="w-6 h-6 text-red-500" />}
        className="border-l-4 border-red-500"
      />
      <Card
        title="Disponível"
        amount={balance}
        icon={<DollarSign className="w-6 h-6 text-white" />}
        className={cn(
          "border-l-4",
          balance >= 0 ? "border-[#39FF14]" : "border-red-500"
        )}
      />
    </div>
  );
}

function Card({ title, amount, icon, className }: { title: string; amount: number; icon: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-zinc-900 p-6 rounded-2xl shadow-lg flex items-center justify-between", className)}>
      <div>
        <p className="text-zinc-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
        </h3>
      </div>
      <div className="p-3 bg-zinc-800 rounded-full">
        {icon}
      </div>
    </div>
  );
}
