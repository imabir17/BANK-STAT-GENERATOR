import { StatementData, Transaction } from '../types';
import { addDays, differenceInDays, format } from 'date-fns';

const PARTICULARS_DEPOSIT = [
  'CASH DEPOSIT',
  'IB/FTR/JAPAN EDUC/NO REMARKS',
  'IB/BKASH/01711330837/NO REMARKS',
  'RTGS/IC/PUBALI /SHIBU MA/RIJIK',
  'IB/NPS/MUTUAL TRU/MOHAMMOD H',
  'IB/FTR/MD. ABU SA/A',
  '1056515310001:Int.Pd:01-10-2024 to 31-10-2024',
  'CASH DEPOSIT',
  'IB/FTR/AYAN FABRI/NAZMUN NAHAR',
];

const PARTICULARS_WITHDRAWAL = [
  'CWDR/RIFLES SQUARE ATM DHAKA BD /1056515310001',
  'CWDR/DUTCH-BANGLA BANK PLC. KUSH/1056515310001',
  'CWDR/KUSHTIA SME UNIT ATM KUSHTI/1056515310001',
  'IB/BKASH/01711330837/A',
  'CRTR/MTB DHAKA BD /',
  'IB/NPS/PRIME/MD IMRAN/IMRAN TUTION',
  '1056515310001:WTax Pd:01-11-2024 to 30-11-2024',
  'VAT on HF YRLY AC MNT FEE-2024',
  'HF YRLY AC MNT FEE-2024',
  'EXCISE DUTY 2024 :1056515310001'
];

export function generateTransactions(data: StatementData): Transaction[] {
  const transactions: Transaction[] = [];
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffDays = Math.max(1, differenceInDays(end, start));
  
  const numTransactions = data.numberOfTransactions;
  const totalChange = data.endBalance - data.startBalance;
  
  let targetSum = totalChange;
  
  let rawValues = Array.from({ length: numTransactions }, () => {
    const isDeposit = Math.random() > 0.6; 
    if (isDeposit) {
      return Math.floor(Math.random() * 50000) + 1000;
    } else {
      return -(Math.floor(Math.random() * 30000) + 500);
    }
  });

  let currentSum = rawValues.reduce((a, b) => a + b, 0);
  let diff = targetSum - currentSum;
  let offset = diff / numTransactions;
  
  rawValues = rawValues.map(v => v + offset);
  
  let finalValues = rawValues.map(v => Math.round(v * 100) / 100);
  let finalSum = finalValues.reduce((a, b) => a + b, 0);
  
  let roundingError = Math.round((targetSum - finalSum) * 100) / 100;
  finalValues[finalValues.length - 1] = Math.round((finalValues[finalValues.length - 1] + roundingError) * 100) / 100;
  
  let currentBalance = data.startBalance;
  let minBalance = currentBalance;
  
  for (let val of finalValues) {
    currentBalance += val;
    if (currentBalance < minBalance) {
      minBalance = currentBalance;
    }
  }

  if (minBalance < 0) {
    const boost = Math.abs(minBalance) + 5000; 
    finalValues[0] += boost;
    finalValues[finalValues.length - 1] -= boost;
  }
  
  let dates: Date[] = [];
  for (let i = 0; i < numTransactions; i++) {
    const randomDays = Math.floor(Math.random() * diffDays);
    dates.push(addDays(start, randomDays));
  }
  dates.sort((a, b) => a.getTime() - b.getTime());

  let runningBalance = data.startBalance;

  for (let i = 0; i < numTransactions; i++) {
    let amt = finalValues[i];
    runningBalance = Math.round((runningBalance + amt) * 100) / 100;
    
    let isDep = amt >= 0;
    let absAmt = Math.abs(amt);
    
    let particulars = isDep 
      ? PARTICULARS_DEPOSIT[Math.floor(Math.random() * PARTICULARS_DEPOSIT.length)]
      : PARTICULARS_WITHDRAWAL[Math.floor(Math.random() * PARTICULARS_WITHDRAWAL.length)];
      
    let chqNo = '';
    if (Math.random() > 0.95) {
       chqNo = Math.floor(Math.random() * 9000000 + 1000000).toString();
    }
    
    transactions.push({
      id: i.toString(),
      date: format(dates[i], 'dd-MMM-yyyy'),
      particulars,
      chqNo,
      withdraw: isDep ? 0 : absAmt,
      deposit: isDep ? absAmt : 0,
      balance: runningBalance
    });
  }
  
  return transactions;
}
