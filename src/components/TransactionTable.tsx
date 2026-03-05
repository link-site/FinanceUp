import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import { cn } from './Dashboard';

interface TransactionTableProps {
  transactions: Transaction[];
  onTogglePaid: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
}

export function TransactionTable({ transactions, onTogglePaid, onDelete }: TransactionTableProps) {
  return (
    <div className="bg-zinc-900 rounded-2xl shadow-lg overflow-hidden border border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-950/50 border-b border-zinc-800">
              <th className="p-4 text-sm font-semibold text-zinc-400">Status</th>
              <th className="p-4 text-sm font-semibold text-zinc-400">Data</th>
              <th className="p-4 text-sm font-semibold text-zinc-400">Descrição</th>
              <th className="p-4 text-sm font-semibold text-zinc-400">Categoria</th>
              <th className="p-4 text-sm font-semibold text-zinc-400 text-right">Valor</th>
              <th className="p-4 text-sm font-semibold text-zinc-400 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  Nenhuma movimentação encontrada neste período.
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors",
                    t.isPaid ? "bg-[#39FF14]/10" : ""
                  )}
                >
                  <td className="p-4">
                    <button
                      onClick={() => onTogglePaid(t.id, t.isPaid)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      {t.isPaid ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-[#39FF14]" />
                          <span className="text-[#39FF14]">Pago</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-5 h-5 text-red-500" />
                          <span className="text-red-500">Não pago</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-zinc-300">
                    {format(parseISO(t.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="p-4">
                    <div className="text-white font-medium">{t.description}</div>
                    {t.isRecurring && (
                      <span className="text-xs text-zinc-500 mt-1">Recorrente</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {t.category}
                    </div>
                    {t.category === 'Salário' && t.receiptDate && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Recebimento: {format(parseISO(t.receiptDate), 'dd MMM', { locale: ptBR })}
                      </div>
                    )}
                    {t.category === 'Cartão de Credito' && t.dueDate && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Vencimento: {format(parseISO(t.dueDate), 'dd MMM', { locale: ptBR })}
                      </div>
                    )}
                  </td>
                  <td className={cn(
                    "p-4 text-right font-bold",
                    t.type === 'Entrada' ? "text-[#39FF14]" : "text-red-500"
                  )}>
                    {t.type === 'Saída' ? '- ' : '+ '}
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-zinc-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-zinc-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
