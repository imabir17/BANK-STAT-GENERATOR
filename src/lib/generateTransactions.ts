import { StatementData, Transaction } from '../types';
import { addDays, differenceInDays, format } from 'date-fns';

const PARTICULARS_DEPOSIT = [
  'CASH DEPOSIT',
  'IB/FTR/JAPAN EDUC/NO REMARKS',
  'IB/BKASH/01711330837/NO REMARKS',
  'RTGS/IC/PUBALI /SHIBU MA/RIJIK',
  'IB/NPS/MUTUAL TRU/MOHAMMOD H',
  'IB/FTR/MD. ABU SA/A',
  '1056515310001:INT.PD:01-10-2024 TO 31-10-2024',
  'AB/CDEP/CD',
  'IB/FTR/AYAN FABRI/NAZMUN NAHAR',
  'RTGS/IC/UCBL /KUSHTIA /AJOY KUMAR MOITRA',
  'AGB/FTPR/126715/CD',
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
  'HF YRLY AC MNT FEE-2024',
  'EXCISE DUTY 2024 :1056515310001',
  'VAT ON HF YRLY AC MNT FEE-2024',
];

export function generateTransactions(data: StatementData): Transaction[] {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffDays = Math.max(1, differenceInDays(end, start));
  const numTransactions = data.numberOfTransactions;

  // ~30% withdrawals, ~70% deposits
  const numWithdrawals = Math.max(1, Math.floor(numTransactions * 0.30));
  const numDeposits = numTransactions - numWithdrawals;

  // ── Step 1: Generate raw random withdrawal amounts ──────────────────────
  // These are freely random. We will NOT change these.
  const rawWithdrawals = Array.from({ length: numWithdrawals }, () =>
    Math.round((Math.random() * 80000 + 10000) * 100) / 100
  );
  const totalWithdrawals = Math.round(
    rawWithdrawals.reduce((a, b) => a + b, 0) * 100
  ) / 100;

  // ── Step 2: Calculate exactly what total deposits must be ────────────────
  // Invariant: startBalance + totalDeposits - totalWithdrawals = endBalance
  // Therefore: totalDeposits = endBalance - startBalance + totalWithdrawals
  const requiredTotalDeposits = Math.round(
    (data.endBalance - data.startBalance + totalWithdrawals) * 100
  ) / 100;

  // Safety: if required deposits is too small (can happen if end << start),
  // we scale down withdrawals to make room.
  const minDepositsNeeded = numDeposits * 1000; // at least 1000 per deposit slot
  const effectiveTotalDeposits = Math.max(requiredTotalDeposits, minDepositsNeeded);

  // ── Step 3: Generate raw deposit "weights", then scale to hit the target ─
  // Each raw weight is random; we scale the whole array so they sum exactly
  // to effectiveTotalDeposits.
  const rawDepositWeights = Array.from({ length: numDeposits }, () =>
    Math.random() * 300000 + 50000
  );
  const weightSum = rawDepositWeights.reduce((a, b) => a + b, 0);
  const scaleFactor = effectiveTotalDeposits / weightSum;

  // Round each deposit to 2 decimal places
  const scaledDeposits = rawDepositWeights.map(w =>
    Math.round(w * scaleFactor * 100) / 100
  );

  // Fix any tiny rounding drift in the last deposit so the sum is exact
  const depositSum = Math.round(scaledDeposits.reduce((a, b) => a + b, 0) * 100) / 100;
  const drift = Math.round((effectiveTotalDeposits - depositSum) * 100) / 100;
  scaledDeposits[scaledDeposits.length - 1] =
    Math.round((scaledDeposits[scaledDeposits.length - 1] + drift) * 100) / 100;

  // If we had to boost deposits beyond requiredTotalDeposits (safety case),
  // also boost the last withdrawal proportionally so the end balance is still correct
  if (effectiveTotalDeposits > requiredTotalDeposits) {
    const extraDeposit = Math.round((effectiveTotalDeposits - requiredTotalDeposits) * 100) / 100;
    rawWithdrawals[rawWithdrawals.length - 1] =
      Math.round((rawWithdrawals[rawWithdrawals.length - 1] + extraDeposit) * 100) / 100;
  }

  // ── Step 4: Combine, assign dates, sort chronologically ─────────────────
  type TxRaw = { amount: number; isDeposit: boolean };
  const combined: TxRaw[] = [
    ...scaledDeposits.map(d => ({ amount: d, isDeposit: true })),
    ...rawWithdrawals.map(w => ({ amount: w, isDeposit: false })),
  ];

  const indexed = combined.map(tx => ({
    tx,
    date: addDays(start, Math.floor(Math.random() * diffDays)),
  }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  // ── Step 5: Build transactions with verified running balance ─────────────
  const transactions: Transaction[] = [];
  let runningBalance = data.startBalance;

  for (let i = 0; i < indexed.length; i++) {
    const { tx, date } = indexed[i];

    runningBalance = tx.isDeposit
      ? Math.round((runningBalance + tx.amount) * 100) / 100
      : Math.round((runningBalance - tx.amount) * 100) / 100;

    const particulars = tx.isDeposit
      ? PARTICULARS_DEPOSIT[Math.floor(Math.random() * PARTICULARS_DEPOSIT.length)]
      : PARTICULARS_WITHDRAWAL[Math.floor(Math.random() * PARTICULARS_WITHDRAWAL.length)];

    const chqNo =
      Math.random() > 0.95
        ? Math.floor(Math.random() * 9000000 + 1000000).toString()
        : '';

    transactions.push({
      id: i.toString(),
      date: format(date, 'dd-MMM-yyyy').toUpperCase(),
      particulars,
      chqNo,
      withdraw: tx.isDeposit ? 0 : tx.amount,
      deposit: tx.isDeposit ? tx.amount : 0,
      balance: runningBalance,
    });
  }

  return transactions;
}
