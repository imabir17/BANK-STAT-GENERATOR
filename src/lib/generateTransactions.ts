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
  const transactions: Transaction[] = [];
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffDays = Math.max(1, differenceInDays(end, start));

  const numTransactions = data.numberOfTransactions;

  // ~30% withdrawals, ~70% deposits (realistic savings account mix)
  const numWithdrawals = Math.max(1, Math.floor(numTransactions * 0.30));
  const numDeposits = numTransactions - numWithdrawals;

  // Generate random raw deposit amounts
  const rawDeposits = Array.from({ length: numDeposits }, () =>
    Math.round((Math.random() * 300000 + 50000) * 100) / 100
  );

  // Generate random raw withdrawal amounts (smaller than deposits)
  const rawWithdrawals = Array.from({ length: numWithdrawals }, () =>
    Math.round((Math.random() * 80000 + 5000) * 100) / 100
  );

  const sumDeposits = rawDeposits.reduce((a, b) => a + b, 0);
  const sumWithdrawals = rawWithdrawals.reduce((a, b) => a + b, 0);

  // Core invariant: startBalance + totalDeposits - totalWithdrawals = endBalance
  // So: totalDeposits - totalWithdrawals must equal (endBalance - startBalance)
  const requiredNet = Math.round((data.endBalance - data.startBalance) * 100) / 100;
  const currentNet = Math.round((sumDeposits - sumWithdrawals) * 100) / 100;

  // Adjust the last deposit to absorb the difference and make the equation exact
  const adjustment = Math.round((requiredNet - currentNet) * 100) / 100;
  rawDeposits[rawDeposits.length - 1] = Math.round(
    (rawDeposits[rawDeposits.length - 1] + adjustment) * 100
  ) / 100;

  // Safety: if last deposit went negative, redistribute
  if (rawDeposits[rawDeposits.length - 1] < 1000) {
    const deficit = 1000 - rawDeposits[rawDeposits.length - 1];
    rawDeposits[rawDeposits.length - 1] += deficit;
    rawWithdrawals[0] = Math.max(100, rawWithdrawals[0] - deficit);
  }

  // Combine into a unified list with type flags
  type TxRaw = { amount: number; isDeposit: boolean };
  const combined: TxRaw[] = [
    ...rawDeposits.map(d => ({ amount: d, isDeposit: true })),
    ...rawWithdrawals.map(w => ({ amount: w, isDeposit: false })),
  ];

  // Assign random dates and sort chronologically
  const indexed = combined.map(tx => ({
    tx,
    date: addDays(start, Math.floor(Math.random() * diffDays)),
  }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build transactions with correct running balance
  let runningBalance = data.startBalance;

  for (let i = 0; i < indexed.length; i++) {
    const { tx, date } = indexed[i];

    if (tx.isDeposit) {
      runningBalance = Math.round((runningBalance + tx.amount) * 100) / 100;
    } else {
      runningBalance = Math.round((runningBalance - tx.amount) * 100) / 100;
    }

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
