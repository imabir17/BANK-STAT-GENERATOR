import { StatementData, Transaction } from '../types';
import { addDays, differenceInDays, format } from 'date-fns';

const PARTICULARS_DEPOSIT = [
  'CASH DEPOSIT',
  'IB/FTR/JAPAN EDUC/NO REMARKS',
  'IB/BKASH/01711330837/NO REMARKS',
  'RTGS/IC/PUBALI /SHIBU MA/RIJIK',
  'IB/NPS/MUTUAL TRU/MOHAMMOD H',
  'IB/FTR/MD. ABU SA/A',
  'AB/CDEP/CD',
  'IB/FTR/AYAN FABRI/NAZMUN NAHAR',
  'RTGS/IC/UCBL /KUSHTIA /AJOY KUMAR MOITRA',
  'AGB/FTPR/126715/CD',
  'IB/NPS/MUTUAL TRU/MOHAMMOD H/SERVICE AIR',
];

const PARTICULARS_WITHDRAWAL = [
  'CWDR/RIFLES SQUARE ATM DHAKA BD /1056515310001',
  'CWDR/DUTCH-BANGLA BANK PLC. KUSH/1056515310001',
  'CWDR/KUSHTIA SME UNIT ATM KUSHTI/1056515310001',
  'IB/BKASH/01711330837/A',
  'CRTR/MTB DHAKA BD /',
  'IB/NPS/PRIME/MD IMRAN/IMRAN TUTION',
  'IB/NPS/PRIME/MD ABDUR R/ABDUR RAHMAN PAY',
  'IB/NPS/PRIME/MD ABDUR R/ABDUR RAHMAN TUT',
  'PRCR/M/S KUSHTIA STORE KUSHTIA B/1056515310001',
  'IB/BKASH/01309255852/TASNIM PAYMENT',
  'PRCR/EASY FASHION DHAKA BD /1056515310001',
];

// Fee particulars always carry a decimal amount
const PARTICULARS_FEES = [
  'HF YRLY AC MNT FEE-2024',
  'EXCISE DUTY 2024 :1056515310001',
  'VAT ON HF YRLY AC MNT FEE-2024',
  '1056515310001:INT.PD:01-10-2024 TO 31-10-2024',
];

/** Round to the nearest "nice" amount for normal transfers */
function roundToNice(amount: number): number {
  if (amount >= 100000) return Math.round(amount / 10000) * 10000;
  if (amount >= 10000)  return Math.round(amount / 1000)  * 1000;
  if (amount >= 1000)   return Math.round(amount / 500)   * 500;
  return Math.round(amount / 100) * 100;
}

/** Random integer between min and max inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateTransactions(data: StatementData): Transaction[] {
  const start  = new Date(data.startDate);
  const end    = new Date(data.endDate);
  const diffDays = Math.max(1, differenceInDays(end, start));

  const N            = data.numberOfTransactions;
  const minTx        = data.minTxAmount;
  const maxTx        = data.maxTxAmount;
  const lowestBal    = Math.max(0, data.lowestBalance);  // balance floor
  const highestBal   = data.highestBalance;              // balance ceiling
  const startBal     = data.startBalance;
  const endBal       = data.endBalance;

  // ── Phase 1: simulate N transaction directions step by step ─────────────
  // We walk forward in "balance space", deciding at each step whether to
  // deposit or withdraw, always respecting floor/ceiling constraints.

  type Step = { isDeposit: boolean; amount: number };
  const steps: Step[] = [];
  let balance = startBal;

  // Reserve the final ~10% of transactions to correct towards endBal
  const freeCount   = Math.floor(N * 0.85);
  const correctCount = N - freeCount;

  // ── Free transactions (random walk within guardrails) ────────────────────
  for (let i = 0; i < freeCount; i++) {
    // Decide direction
    let canDeposit  = balance < highestBal;
    let canWithdraw = balance - minTx >= lowestBal;

    // If only one direction is possible, use it
    let isDeposit: boolean;
    if (!canDeposit && !canWithdraw) {
      // Stuck: do a tiny deposit as recovery
      isDeposit = true;
    } else if (!canWithdraw) {
      isDeposit = true;
    } else if (!canDeposit) {
      isDeposit = false;
    } else {
      // Bias: if we're well above endBal, prefer withdrawals; else prefer deposits
      const biasDep = balance > endBal * 1.5 ? 0.35 : 0.70;
      isDeposit = Math.random() < biasDep;
    }

    // Pick amount within [minTx, maxTx] and constrained by guardrails
    let maxAllowed: number;
    if (isDeposit) {
      maxAllowed = Math.min(maxTx, highestBal - balance);
    } else {
      maxAllowed = Math.min(maxTx, balance - lowestBal);
    }
    const minAllowed = Math.min(minTx, maxAllowed);
    const rawAmount  = minAllowed + Math.random() * (maxAllowed - minAllowed);
    const amount     = Math.max(minTx, roundToNice(rawAmount));

    // Apply
    balance = isDeposit
      ? Math.round((balance + amount) * 100) / 100
      : Math.round((balance - amount) * 100) / 100;

    steps.push({ isDeposit, amount });
  }

  // ── Correction transactions: steer towards endBal ────────────────────────
  for (let i = 0; i < correctCount; i++) {
    const isLast   = i === correctCount - 1;
    const diff     = endBal - balance; // positive → need to deposit, negative → need to withdraw

    if (isLast) {
      // Final transaction: bridge the exact gap
      const gap = Math.abs(Math.round(diff * 100) / 100);
      const isDeposit = diff >= 0;

      // For the final bridging step, allow decimal to hit the exact cent
      steps.push({ isDeposit, amount: gap > 0 ? gap : 0.01 });
      balance = Math.round((balance + (isDeposit ? gap : -gap)) * 100) / 100;
    } else {
      // Non-final correction: step part of the way there
      const fraction  = 0.3 + Math.random() * 0.4; // take 30–70% of remaining diff
      const isDeposit = diff >= 0;
      const target    = Math.abs(diff) * fraction;
      const maxAllowed = isDeposit
        ? Math.min(maxTx, highestBal - balance)
        : Math.min(maxTx, balance - lowestBal);

      const rawAmount  = Math.min(target, maxAllowed);
      const amount     = Math.max(minTx, roundToNice(rawAmount));

      balance = isDeposit
        ? Math.round((balance + amount) * 100) / 100
        : Math.round((balance - amount) * 100) / 100;

      steps.push({ isDeposit, amount });
    }
  }

  // ── Phase 2: assign dates, pick particulars, build Transaction rows ──────
  const dates = steps.map(() =>
    addDays(start, randInt(0, diffDays - 1))
  );

  // Sort steps with their dates chronologically
  const indexed = steps.map((step, i) => ({ step, date: dates[i] }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  const transactions: Transaction[] = [];
  let runningBalance = startBal;

  // Reserve ~3 indices spread across the list for fee transactions
  const feeIndices = new Set<number>();
  const feeSlotsCount = Math.min(3, Math.floor(N * 0.07));
  while (feeIndices.size < feeSlotsCount) {
    feeIndices.add(randInt(0, N - 1));
  }

  for (let i = 0; i < indexed.length; i++) {
    const { step, date } = indexed[i];
    const isFee = feeIndices.has(i) && !step.isDeposit; // fees are withdrawals

    // For fee rows, use a small decimal amount (e.g. 345.75)
    let amount = step.amount;
    if (isFee) {
      amount = Math.round((randInt(100, 999) + Math.random()) * 100) / 100;
      // Clamp so balance stays positive
      amount = Math.min(amount, Math.max(0.01, runningBalance - lowestBal));
    }

    runningBalance = step.isDeposit
      ? Math.round((runningBalance + amount) * 100) / 100
      : Math.round((runningBalance - amount) * 100) / 100;

    // Pick a label
    let particulars: string;
    if (isFee) {
      particulars = PARTICULARS_FEES[randInt(0, PARTICULARS_FEES.length - 1)];
    } else if (step.isDeposit) {
      particulars = PARTICULARS_DEPOSIT[randInt(0, PARTICULARS_DEPOSIT.length - 1)];
    } else {
      particulars = PARTICULARS_WITHDRAWAL[randInt(0, PARTICULARS_WITHDRAWAL.length - 1)];
    }

    const chqNo = Math.random() > 0.95
      ? randInt(1000000, 9999999).toString()
      : '';

    transactions.push({
      id: i.toString(),
      date: format(date, 'dd-MMM-yyyy').toUpperCase(),
      particulars,
      chqNo,
      withdraw: step.isDeposit ? 0 : amount,
      deposit:  step.isDeposit ? amount : 0,
      balance:  runningBalance,
    });
  }

  return transactions;
}
