export type TransactionType = 'Entrada' | 'Saída';

export interface Transaction {
  id: string;
  userId: string;
  description: string;
  value: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  isRecurring: boolean;
  isPaid: boolean;
  receiptDate?: string; // For Salário
  dueDate?: string; // For Cartão de Credito
  createdAt: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
}
