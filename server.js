import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const firebaseConfig = {
    apiKey: "AIzaSyAlcupbsBAVhqjl4KbRjNVFe78CnunBiZM",
    authDomain: "financeup-392ae.firebaseapp.com",
    projectId: "financeup-392ae",
    storageBucket: "financeup-392ae.firebasestorage.app",
    messagingSenderId: "299342926526",
    appId: "1:299342926526:web:593cd247b0e277bed2c4ef"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const DEFAULT_TG_TOKEN = "8821145839:AAEEavXarIUeMlze4V-Skd10yU600kD4zIs";
const telegramChatState = {};
const processedUpdateIds = new Set();
let lastOffset = 0;
let isPolling = false;

function formatMoney(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function extractAmountFromText(text, cardName) {
    if (!text) return null;
    let clean = text.trim();
    if (cardName) {
        const cNorm = cardName.toLowerCase();
        clean = clean.replace(new RegExp(cNorm, 'gi'), '').trim();
    }
    clean = clean.replace(/[^\d,\.]/g, '');
    if (!clean) return null;
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
}

async function getFirestoreTransactions() {
    try {
        const snap = await getDocs(collection(db, 'transactions'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error fetching transactions server-side:', err);
        return [];
    }
}

async function getBotSettings() {
    try {
        const snap = await getDoc(doc(db, 'transactions', '_bot_telegram_settings'));
        if (snap.exists()) {
            return snap.data();
        }
    } catch (e) {}
    return { token: DEFAULT_TG_TOKEN, subscribers: {} };
}

async function registerSubscriberServer(chatId, senderName) {
    if (!chatId) return;
    try {
        const cidStr = String(chatId);
        const settings = await getBotSettings();
        const subs = settings.subscribers || {};
        subs[cidStr] = {
            chatId: cidStr,
            senderName: senderName || 'Usuário Telegram',
            lastSeen: Date.now()
        };
        await setDoc(doc(db, 'transactions', '_bot_telegram_settings'), {
            token: settings.token || DEFAULT_TG_TOKEN,
            subscribers: subs,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (e) {
        console.error('Error registering subscriber server-side:', e);
    }
}

function calculateMetricsAndCards(txs) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = `${monthNames[m]} de ${y}`;
    const curPeriodStr = `${y}-${(m + 1).toString().padStart(2, '0')}`;
    const selMonthTotal = y * 12 + m;

    let totalIncomes = 0;
    let paidIncomes = 0;
    let totalExpenses = 0;
    let paidExpenses = 0;
    const upcomingBills = [];

    const filtered = txs.filter(t => {
        if (t.isTombstone || t.id === '_bot_telegram_settings') return false;
        const dateStr = t.dueDate || t.date;
        if (!dateStr || typeof dateStr !== 'string') return false;
        const parts = dateStr.split('-');
        if (parts.length < 2) return false;
        const ty = parseInt(parts[0]);
        const tm = parseInt(parts[1]) - 1;
        const txMonthTotal = ty * 12 + tm;

        const isFixed = Boolean(t.isRecurring);
        if (isFixed) {
            if (txMonthTotal > selMonthTotal) return false;
            const hasOverride = txs.some(ot => ot.parentId === t.id && ot.parentMonth === curPeriodStr);
            return !hasOverride;
        }
        return txMonthTotal === selMonthTotal;
    });

    filtered.forEach(t => {
        const val = parseFloat(t.value) || 0;
        const type = t.type || 'Saída';
        const dStr = t.receiptDate || t.dueDate || t.date || curPeriodStr;

        if (type === 'Entrada') {
            totalIncomes += val;
            if (t.isPaid) paidIncomes += val;
        } else {
            totalExpenses += val;
            if (t.isPaid) paidExpenses += val;
            if (!t.isPaid) {
                upcomingBills.push({
                    id: String(t.id || ''),
                    name: String(t.description || t.name || 'Conta'),
                    description: String(t.description || t.name || 'Conta'),
                    value: val,
                    date: String(dStr || '')
                });
            }
        }
    });

    const cardMap = {};
    txs.forEach(t => {
        if (t.isTombstone || t.id === '_bot_telegram_settings') return;
        const cat = (t.category || '').toLowerCase();
        const isCardCat = cat.includes('cartão') || cat.includes('cartao') || cat.includes('credito') || cat.includes('crédito');
        if (!isCardCat) return;

        const dateStr = t.receiptDate || t.dueDate || t.date;
        if (dateStr && typeof dateStr === 'string') {
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                const ty = parseInt(parts[0]);
                const tm = parseInt(parts[1]) - 1;
                if (ty !== y || tm !== m) return;
            }
        }

        const rawName = (t.description || 'Cartão de Crédito').trim();
        if (!rawName) return;
        const cleanName = rawName.replace(/^fatura\s+/i, '').trim();
        const key = cleanName.toLowerCase();
        const val = parseFloat(t.value) || 0;

        if (!cardMap[key]) {
            cardMap[key] = {
                id: t.cardId || t.id || ('card_' + key.replace(/\s+/g, '_')),
                name: cleanName,
                color: '#8A05BE',
                limit: 5000,
                used: 0,
                invoiceValue: 0
            };
        }
        cardMap[key].used += val;
        cardMap[key].invoiceValue += val;
    });

    const defaultCards = [
        { id: 'card_atacadao', name: 'Atacadão', color: '#008000', limit: 5000, used: 749.13, invoiceValue: 749.13 },
        { id: 'card_nubank', name: 'Cartão Nubank', color: '#8A05BE', limit: 5000, used: 1200, invoiceValue: 1200 },
        { id: 'card_itau', name: 'Cartão Itaú', color: '#FF6B00', limit: 4000, used: 800, invoiceValue: 800 },
        { id: 'card_inter', name: 'Cartão Inter', color: '#FF7A00', limit: 3000, used: 450, invoiceValue: 450 },
        { id: 'card_bradesco', name: 'Cartão Bradesco', color: '#CC092F', limit: 2500, used: 0, invoiceValue: 0 }
    ];

    defaultCards.forEach(c => {
        const key = c.name.toLowerCase();
        if (!cardMap[key]) {
            cardMap[key] = { ...c };
        }
    });

    const cardsList = Object.values(cardMap);
    const totalCardsInvoice = cardsList.reduce((sum, c) => sum + (parseFloat(c.used || c.invoiceValue || 0)), 0);
    const estimatedAvailable = totalIncomes - totalExpenses;

    return {
        monthName,
        curPeriodStr,
        totalIncomes,
        paidIncomes,
        totalExpenses,
        paidExpenses,
        totalCardsInvoice,
        estimatedAvailable,
        upcomingBills,
        cardsList
    };
}

async function syncCardValueServer(card, newValue) {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const curPeriodStr = `${y}-${m}`;
    const txId = `card_tx_${card.id}_${curPeriodStr}`;

    const txData = {
        id: txId,
        description: `Fatura ${card.name}`,
        value: parseFloat(newValue) || 0,
        type: 'Saída',
        category: 'Cartão de Credito',
        date: `${curPeriodStr}-05`,
        dueDate: `${curPeriodStr}-05`,
        isPaid: false,
        isCard: true,
        cardId: card.id,
        updatedAt: Date.now()
    };

    try {
        await setDoc(doc(db, 'transactions', txId), txData, { merge: true });
    } catch (err) {
        console.error('Error writing card value server-side:', err);
    }
}

async function replyToTelegramServer(token, chatId, text, senderName) {
    if (!telegramChatState[chatId]) {
        telegramChatState[chatId] = { activeCard: null, awaitingValue: false };
    }
    const userState = telegramChatState[chatId];

    const txs = await getFirestoreTransactions();
    const metrics = calculateMetricsAndCards(txs);
    const cards = metrics.cardsList;
    const lower = (text || '').toLowerCase().trim();

    let replyText = '';
    const mainKeyboard = [
        [{ text: "Valor Disponível Estimado" }, { text: "Cartões" }]
    ];
    let activeKeyboard = mainKeyboard;

    const isStartOrMenu = ['/start', 'start', 'menu', 'iniciar', 'ajuda', 'oi', 'olá', 'ola', 'voltar', 'menu principal', '📋 menu principal'].includes(lower);

    if (isStartOrMenu) {
        userState.activeCard = null;
        userState.awaitingValue = false;
        replyText = `🤖 *BOT TELEGRAM FINANCEUP*\n\n*Acesso exclusivo:* Menu Orçamento\n\n👇 *Escolha uma opção no menu abaixo:*`;
        activeKeyboard = mainKeyboard;
    }
    else if (lower.includes('disponível estimado') || lower.includes('disponivel estimado') || lower.includes('disponível') || lower.includes('disponivel') || lower.includes('estimado')) {
        replyText = `💰 *Valor Disponível Estimado (${metrics.monthName}):*\n\n*${formatMoney(metrics.estimatedAvailable)}*\n\n_(Entradas: ${formatMoney(metrics.totalIncomes)} | Saídas: ${formatMoney(metrics.totalExpenses)} | Cartões: ${formatMoney(metrics.totalCardsInvoice)})_`;
        activeKeyboard = mainKeyboard;
    }
    else if (lower === 'cartões' || lower === 'cartoes' || lower === 'cartao' || lower === 'cartão' || lower.includes('tag cartão') || lower.includes('tag cartao')) {
        userState.activeCard = null;
        userState.awaitingValue = false;

        let cardsListStr = cards.map(c => `• *${c.name}:* ${formatMoney(c.used || c.invoiceValue || 0)}`).join('\n');
        replyText = `💳 *ITENS DA TAG CARTÃO DE CRÉDITO (${metrics.monthName}):*\n\n${cardsListStr}\n\n👇 *Selecione um item para abrir o submenu:*`;

        const cardButtons = cards.map(c => [{ text: `${c.name}` }]);
        cardButtons.push([{ text: "📋 Menu Principal" }]);
        activeKeyboard = cardButtons;
    }
    else {
        let matchedCard = cards.find(c => {
            const cNorm = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const textNorm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const cClean = cNorm.replace(/cartao|fatura|de|credito/g, '').trim();
            return textNorm === cNorm || (cClean && textNorm === cClean) || textNorm.includes(cNorm);
        });

        const isSelectValor = (lower === 'valor' || lower === '📊 valor' || (matchedCard && lower.includes('valor')));
        const isSelectAtualizar = (lower === 'atualizar valor' || lower === '✏️ atualizar valor' || (matchedCard && lower.includes('atualizar')));

        if (isSelectValor && (userState.activeCard || matchedCard)) {
            const card = matchedCard || userState.activeCard;
            userState.activeCard = card;
            userState.awaitingValue = false;

            const currentVal = parseFloat(card.used || card.invoiceValue || 0);
            replyText = `📊 *INFORMAÇÃO DO ITEM: ${card.name.toUpperCase()}*\n\n• *Tag:* Cartão de Crédito\n• *Valor Atual do Item:* *${formatMoney(currentVal)}*\n• *Período:* ${metrics.monthName}`;
            activeKeyboard = [
                [{ text: "Valor" }, { text: "Atualizar Valor" }],
                [{ text: "Cartões" }, { text: "Valor Disponível Estimado" }]
            ];
        }
        else if (isSelectAtualizar && (userState.activeCard || matchedCard)) {
            const card = matchedCard || userState.activeCard;
            userState.activeCard = card;
            userState.awaitingValue = true;

            const currentVal = parseFloat(card.used || card.invoiceValue || 0);
            replyText = `✏️ *ATUALIZAR VALOR: ${card.name.toUpperCase()}*\n\n• *Valor Atual no Sistema:* *${formatMoney(currentVal)}*\n\n👉 *Envie o novo valor para sobrescrever o valor do campo deste item.*\nExemplo: Envie *"500"*, *"750,50"* ou escolha uma opção rápida:`;
            activeKeyboard = [
                [{ text: `${card.name} 100` }, { text: `${card.name} 200` }, { text: `${card.name} 500` }],
                [{ text: `${card.name} 750` }, { text: `${card.name} 1000` }, { text: `${card.name} 1500` }],
                [{ text: "Cartões" }, { text: "Valor Disponível Estimado" }]
            ];
        }
        else if (matchedCard && !lower.includes('100') && !lower.includes('200') && !lower.includes('500') && !lower.includes('750') && !lower.includes('1000') && !lower.includes('1500')) {
            userState.activeCard = matchedCard;
            userState.awaitingValue = false;

            const currentVal = parseFloat(matchedCard.used || matchedCard.invoiceValue || 0);
            replyText = `💳 *SUBMENU: ${matchedCard.name.toUpperCase()}*\nTag: *Cartão de Crédito*\n• *Valor Atual:* *${formatMoney(currentVal)}*\n\n👇 *Selecione uma opção:*`;
            activeKeyboard = [
                [{ text: "Valor" }, { text: "Atualizar Valor" }],
                [{ text: "Cartões" }, { text: "Valor Disponível Estimado" }]
            ];
        }
        else {
            let targetCardForUpdate = matchedCard || userState.activeCard;
            let numVal = extractAmountFromText(text, targetCardForUpdate ? targetCardForUpdate.name : null);

            if (targetCardForUpdate && !isNaN(numVal) && numVal > 0) {
                const prevVal = parseFloat(targetCardForUpdate.used || targetCardForUpdate.invoiceValue || 0);
                
                await syncCardValueServer(targetCardForUpdate, numVal);

                const updatedTxs = await getFirestoreTransactions();
                const updatedMetrics = calculateMetricsAndCards(updatedTxs);

                userState.activeCard = targetCardForUpdate;
                userState.awaitingValue = false;

                replyText = `✅ *VALOR SOBRESCRITO COM SUCESSO!*\n\n• *Item:* ${targetCardForUpdate.name}\n• *Valor Anterior:* ${formatMoney(prevVal)}\n• *Novo Valor:* *${formatMoney(numVal)}*\n\n💰 *Novo Disponível Estimado (${updatedMetrics.monthName}):* *${formatMoney(updatedMetrics.estimatedAvailable)}*`;
                activeKeyboard = [
                    [{ text: "Valor" }, { text: "Atualizar Valor" }],
                    [{ text: "Cartões" }, { text: "Valor Disponível Estimado" }]
                ];
            }
            else {
                replyText = `🤖 *BOT TELEGRAM FINANCEUP*\n\nMenu **Orçamento**:\n• 💰 *Valor Disponível Estimado*\n• 💳 *Cartões*\n\nPor favor, escolha uma opção no teclado abaixo:`;
                activeKeyboard = mainKeyboard;
            }
        }
    }

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: replyText,
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: activeKeyboard,
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            })
        });
    } catch (err) {
        console.error('Telegram reply send error on server:', err);
    }
}

async function pollTelegramUpdatesServer() {
    if (isPolling) return;
    isPolling = true;

    try {
        const settings = await getBotSettings();
        const token = settings.token || DEFAULT_TG_TOKEN;
        if (!token) return;

        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastOffset + 1}&timeout=1`);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
            if (lastOffset === 0) {
                const maxUpdateId = Math.max(...data.result.map(u => u.update_id));
                lastOffset = maxUpdateId;
                data.result = [data.result[data.result.length - 1]];
            }

            for (const update of data.result) {
                if (processedUpdateIds.has(update.update_id)) continue;
                processedUpdateIds.add(update.update_id);

                if (update.update_id > lastOffset) {
                    lastOffset = update.update_id;
                }

                let text = null;
                let chatId = null;
                let senderName = 'Usuário Telegram';

                if (update.callback_query) {
                    text = update.callback_query.data;
                    chatId = update.callback_query.message ? update.callback_query.message.chat.id : null;
                    senderName = update.callback_query.from ? (update.callback_query.from.first_name || 'Usuário') : 'Usuário Telegram';
                    try {
                        fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ callback_query_id: update.callback_query.id })
                        });
                    } catch (e) {}
                } else if (update.message || update.edited_message) {
                    const msg = update.message || update.edited_message;
                    text = msg && msg.text ? msg.text.trim() : null;
                    chatId = msg && msg.chat ? msg.chat.id : null;
                    senderName = msg && msg.from ? (msg.from.first_name || 'Usuário') : 'Usuário Telegram';
                }

                if (text && chatId) {
                    await registerSubscriberServer(chatId, senderName);
                    await replyToTelegramServer(token, chatId, text, senderName);
                }
            }
        }
    } catch (err) {
        // Suppress network polling errors
    } finally {
        isPolling = false;
    }
}

// Start continuous background polling 24/7 on server
setInterval(pollTelegramUpdatesServer, 2500);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', telegramPolling: 'active', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`FinanceUP Server running 24/7 on port ${PORT}`);
});
