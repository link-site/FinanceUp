import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { TransactionType } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  categories: { id: string; name: string; type: TransactionType }[];
  onAddCategory: (name: string, type: TransactionType) => void;
}

export function TransactionModal({ isOpen, onClose, onSave, categories, onAddCategory }: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('Entrada');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [receiptDate, setReceiptDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType('Entrada');
      setDescription('');
      setValue('');
      setDate('');
      setCategory('');
      setIsRecurring(false);
      setReceiptDate('');
      setDueDate('');
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter(c => c.type === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      description,
      value: parseFloat(value.replace(',', '.')),
      date,
      type,
      category,
      isRecurring,
      isPaid: type === 'Entrada' ? true : false,
      receiptDate: category === 'Salário' ? receiptDate : undefined,
      dueDate: category === 'Cartão de Credito' ? dueDate : undefined,
    });
    onClose();
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-zinc-800">
        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Novo Lançamento</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-zinc-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setType('Entrada'); setCategory(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === 'Entrada' ? 'bg-[#39FF14] text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => { setType('Saída'); setCategory(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === 'Saída' ? 'bg-red-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Saída
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Descrição</label>
            <input
              required
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
              placeholder="Ex: Conta de Luz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Data</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Categoria</label>
            <div className="flex gap-2">
              <select
                required
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
              >
                <option value="" disabled>Selecione...</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-zinc-400 hover:text-[#39FF14] hover:border-[#39FF14] transition-colors"
                title="Adicionar nova categoria"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isAddingCategory && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nova categoria"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] text-sm"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="bg-[#39FF14] text-black px-4 rounded-lg text-sm font-medium hover:bg-[#32e612] transition-colors"
              >
                Adicionar
              </button>
            </div>
          )}

          {category === 'Salário' && type === 'Entrada' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Data de Recebimento</label>
              <input
                required
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
              />
            </div>
          )}

          {category === 'Cartão de Credito' && type === 'Saída' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Data de Vencimento</label>
              <input
                required
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#39FF14] transition-colors"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 text-[#39FF14] focus:ring-[#39FF14] bg-zinc-800"
            />
            <label htmlFor="recurring" className="text-sm font-medium text-zinc-400">
              Lançamento Recorrente
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-[#39FF14] text-black font-bold py-3 rounded-lg mt-6 hover:bg-[#32e612] transition-colors"
          >
            Salvar Registro
          </button>
        </form>
      </div>
    </div>
  );
}
