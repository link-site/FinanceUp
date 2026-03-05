import { useState, useEffect } from 'react';
import { Plus, Calendar, LogOut } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Dashboard } from './components/Dashboard';
import { TransactionModal } from './components/TransactionModal';
import { TransactionTable } from './components/TransactionTable';
import { AIConsultant } from './components/AIConsultant';
import { Transaction, Category, TransactionType } from './types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const YEARS = Array.from({ length: 2035 - 2024 + 1 }, (_, i) => 2024 + i);

const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId'>[] = [
  { name: 'Salário', type: 'Entrada' },
  { name: 'Extra', type: 'Entrada' },
  { name: 'Outros', type: 'Entrada' },
  { name: 'Assinaturas', type: 'Saída' },
  { name: 'Serviços', type: 'Saída' },
  { name: 'Cartão de Credito', type: 'Saída' },
  { name: 'Transporte', type: 'Saída' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error signing in anonymously:", error);
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Initialize default categories
        for (const cat of DEFAULT_CATEGORIES) {
          await addDoc(collection(db, 'categories'), {
            ...cat,
            userId: user.uid
          });
        }
      } else {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        setCategories(data);
      }
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSaveTransaction = async (data: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        ...data,
        userId: user.uid,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Error adding transaction:", error);
    }
  };

  const handleAddCategory = async (name: string, type: TransactionType) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name,
        type,
        userId: user.uid
      });
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleTogglePaid = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'transactions', id), {
        isPaid: !currentStatus
      });
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (error) {
        console.error("Error deleting transaction:", error);
      }
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  const incomes = filteredTransactions
    .filter(t => t.type === 'Entrada')
    .reduce((acc, curr) => acc + curr.value, 0);

  const expenses = filteredTransactions
    .filter(t => t.type === 'Saída')
    .reduce((acc, curr) => acc + curr.value, 0);

  if (!isAuthReady) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-[#39FF14]">Carregando FinanceUP...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#39FF14] selection:text-black pb-24">
      <header className="bg-zinc-950 border-b border-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#39FF14] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.3)]">
              <span className="text-black font-black text-xl tracking-tighter">F</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Finance<span className="text-[#39FF14]">UP</span></h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#39FF14] text-black px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#32e612] transition-all hover:scale-105 shadow-[0_0_20px_rgba(57,255,20,0.2)]"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Novo Lançamento</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h2 className="text-3xl font-light tracking-tight text-zinc-300">
            Visão Geral
          </h2>
          
          <div className="flex bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 shadow-inner">
            <div className="flex items-center gap-2 px-3 border-r border-zinc-800">
              <Calendar className="w-4 h-4 text-[#39FF14]" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-white font-medium focus:outline-none appearance-none cursor-pointer py-1"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i} className="bg-zinc-900">{m}</option>
                ))}
              </select>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-white font-medium focus:outline-none appearance-none cursor-pointer px-4 py-1"
            >
              {YEARS.map(y => (
                <option key={y} value={y} className="bg-zinc-900">{y}</option>
              ))}
            </select>
          </div>
        </div>

        <Dashboard incomes={incomes} expenses={expenses} />

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-zinc-200">Movimentações</h3>
        </div>

        <TransactionTable 
          transactions={filteredTransactions} 
          onTogglePaid={handleTogglePaid}
          onDelete={handleDeleteTransaction}
        />
      </main>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        categories={categories}
        onAddCategory={handleAddCategory}
      />

      <AIConsultant transactions={filteredTransactions} />
    </div>
  );
}
