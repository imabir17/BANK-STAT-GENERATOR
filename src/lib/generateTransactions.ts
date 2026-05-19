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

const PARTICULARS_FEES = [
  'HF YRLY AC MNT FEE-2024',
  'EXCISE DUTY 2024 :1056515310001',
  'VAT ON HF YRLY AC MNT FEE-2024',
  '1056515310001:INT.PD:01-10-2024 TO 31-10-2024',
];

/** Round to a "nice" whole number typical of real bank transfers */
function roundToNice(amount: number): number {
  if (amount >= 100000) return Math.round(amount / 10000) * 10000;
  if (amount >= 10000)  return Math.round(amount / 1000)  * 1000;
  if (amount >= 1000)   return Math.round(amount / 500)   * 500;
  return Math.round(amount / 100) * 100;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export function generateTransactions(data: StatementData): Transaction[] {
  const start    = new Date(data.startDate);
  const end      = new Date(data.endDate);
  const diffDays = Math.max(1, differenceInDays(end, start));

  const N           = data.numberOfTransactions;
  const minTx       = Math.max(1, data.minTxAmount);
  const maxTx       = data.maxTxAmount;
  const lowestBal   = Math.max(0, data.lowestBalance);
  const highestBal  = data.highestBalance;
  const startBal    = data.startBalance;
  const endBal      = data.endBalance;

  // ── Phase 1: Generate N-1 FREE transactions ───────────────────────────────
  // These are a natural random walk within guardrails.
  // The Nth transaction will ALWAYS be the exact mathematical bridge.

  type RawStep = { isDeposit: boolean; amount: number; isFee: boolean };
  const steps: RawStep[] = [];
  let balance = startBal;

  // Decide which indices will be fee transactions (small decimal amounts)
  const feeSlotsCount = Math.max(1, Math.floor(N * 0.06));
  const feeIndices = new Set<number>();
  while (feeIndices.size < feeSlotsCount) {
    // Avoid making the very last transaction (index N-1) a fee
    feeIndices.add(randInt(0, N - 2));
  }

  for (let i = 0; i < N - 1; i++) {
    const isFee = feeIndices.has(i);

    if (isFee) {
      // Fees are always small withdrawals with decimal amounts
      const feeAmount = Math.round((randInt(100, 2500) + Math.random()) * 100) / 100;
      const safeAmount = Math.min(feeAmount, Math.max(0.01, balance - lowestBal));
      balance = Math.round((balance - safeAmount) * 100) / 100;
      steps.push({ isDeposit: false, amount: safeAmount, isFee: true });
      continue;
    }

    // Determine which direction is possible
    const canDeposit  = balance < highestBal;
    const canWithdraw = balance - minTx >= lowestBal;

    let isDeposit: boolean;
    if (!canDeposit && !canWithdraw) {
      // Stuck — force tiny deposit as emergency recovery
      isDeposit = true;
    } else if (!canWithdraw) {
      isDeposit = true;
    } else if (!canDeposit) {
      isDeposit = false;
    } else {
      // Soft bias: slightly prefer deposits (like a real savings account)
      isDeposit = Math.random() < 0.65;
    }

    // Pick amount clamped within guardrails
    let maxAllowed: number;
    if (isDeposit) {
      maxAllowed = Math.min(maxTx, highestBal - balance);
    } else {
      maxAllowed = Math.min(maxTx, balance - lowestBal);
    }
    const minAllowed = Math.min(minTx, maxAllowed);
    const rawAmount  = minAllowed + Math.random() * (maxAllowed - minAllowed);
    const amount     = Math.max(minTx, roundToNice(rawAmount));

    balance = isDeposit
      ? Math.round((balance + amount) * 100) / 100
      : Math.round((balance - amount) * 100) / 100;

    steps.push({ isDeposit, amount, isFee: false });
  }

  // ── Phase 2: Compute and add the EXACT BRIDGE transaction ────────────────
  // After N-1 steps, balance = X.
  // We need: X + bridgeDeposit - bridgeWithdraw = endBal
  // So: bridge = endBal - X (positive = deposit, negative = withdrawal)

  const gap = Math.round((endBal - balance) * 100) / 100;
  const bridgeIsDeposit = gap >= 0;
  const bridgeAmount    = Math.abs(gap);

  // If gap is exactly 0, add a tiny symbolic deposit so there's always a last tx
  steps.push({
    isDeposit: bridgeIsDeposit,
    amount: bridgeAmount > 0 ? bridgeAmount : 1,
    isFee: false,
  });
  // Apply bridge so running balance verification is clean
  balance = Math.round((balance + (bridgeIsDeposit ? bridgeAmount : -bridgeAmount)) * 100) / 100;

  // ── Phase 3: Assign sorted dates ─────────────────────────────────────────
  const rawDates = steps.map(() => addDays(start, randInt(0, diffDays - 1)));
  const indexed  = steps.map((step, i) => ({ step, date: rawDates[i] }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  // ── Phase 4: Build Transaction rows with verified running balance ─────────
  const transactions: Transaction[] = [];
  let runningBalance = startBal;

  for (let i = 0; i < indexed.length; i++) {
    const { step, date } = indexed[i];

    runningBalance = step.isDeposit
      ? Math.round((runningBalance + step.amount) * 100) / 100
      : Math.round((runningBalance - step.amount) * 100) / 100;

    let particulars: string;
    if (step.isFee) {
      particulars = pick(PARTICULARS_FEES);
    } else if (step.isDeposit) {
      particulars = pick(PARTICULARS_DEPOSIT);
    } else {
      particulars = pick(PARTICULARS_WITHDRAWAL);
    }

    const chqNo = Math.random() > 0.95 ? randInt(1000000, 9999999).toString() : '';

    transactions.push({
      id: i.toString(),
      date: format(date, 'dd-MMM-yyyy').toUpperCase(),
      particulars,
      chqNo,
      withdraw: step.isDeposit ? 0 : step.amount,
      deposit:  step.isDeposit ? step.amount : 0,
      balance:  runningBalance,
    });
  }

  // ── Final verification (will catch any floating-point bug instantly) ──────
  const totalDeposits    = transactions.reduce((s, t) => s + t.deposit, 0);
  const totalWithdrawals = transactions.reduce((s, t) => s + t.withdraw, 0);
  const computedEnd      = Math.round((startBal + totalDeposits - totalWithdrawals) * 100) / 100;

  // If somehow there's still a cent-level rounding error, correct the last tx
  if (computedEnd !== endBal) {
    const lastTx = transactions[transactions.length - 1];
    const correction = Math.round((endBal - computedEnd) * 100) / 100;
    if (lastTx.deposit > 0) {
      lastTx.deposit  = Math.round((lastTx.deposit + correction) * 100) / 100;
    } else {
      lastTx.withdraw = Math.round((lastTx.withdraw - correction) * 100) / 100;
    }
    lastTx.balance = endBal;
  }

  return transactions;
}
