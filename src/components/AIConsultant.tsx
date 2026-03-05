import { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MessageSquare } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Transaction } from '../types';

interface AIConsultantProps {
  transactions: Transaction[];
}

export function AIConsultant({ transactions }: AIConsultantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Olá! Sou seu consultor financeiro IA. Como posso ajudar com seu orçamento hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Use the provided API key as requested by the user, or fallback to env
      const apiKey = "AIzaSyCrqECbdY29Vw1mKHt0Gfjdmsm2KGauIVo" || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key not configured');

      const ai = new GoogleGenAI({ apiKey });
      
      const transactionsContext = transactions.map(t => 
        `${t.type}: ${t.description} - R$ ${t.value} em ${t.date} (${t.category})`
      ).join('\n');

      const systemInstruction = `Você é um consultor financeiro especialista do sistema FinanceUP. 
Responda de forma concisa, educada e sofisticada.
Aqui estão as movimentações financeiras atuais do usuário:
${transactionsContext || 'Nenhuma movimentação registrada ainda.'}
Ajude o usuário a analisar seus gastos, dar dicas de economia e organizar o orçamento.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || 'Desculpe, não consegui processar sua solicitação.' }]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Desculpe, ocorreu um erro ao conectar com o consultor IA. Verifique sua chave de API.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#39FF14] text-black p-4 rounded-full shadow-lg hover:bg-[#32e612] transition-transform hover:scale-105 z-40"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col" style={{ height: '500px' }}>
          <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#39FF14]" />
              <h3 className="text-white font-bold">Consultor FinanceUP</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#39FF14] text-black rounded-tr-none' 
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 p-3 rounded-2xl rounded-tl-none text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-zinc-950 border-t border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte algo..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#39FF14]"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-[#39FF14] text-black p-2 rounded-lg hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
