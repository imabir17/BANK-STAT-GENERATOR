'use client';

import React, { useState } from 'react';
import { DashboardForm } from '@/components/DashboardForm';
import { StatementPreview } from '@/components/StatementPreview';
import { StatementData, Transaction } from '@/types';
import { generateTransactions } from '@/lib/generateTransactions';

export default function Home() {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [data, setData] = useState<StatementData>({
    name: 'MD IMRAN KHAN',
    addressLine1: 'EIDGAH RAPA, COURTPARA, KUSHTIA',
    addressLine2: 'SADAR',
    addressLine3: 'KUSHTIA 7000',
    addressLine4: 'KHULNA',
    branchName: 'KUSHTIA SME/KRISHI BRANCH',
    branchAddressLine1: 'Tofazzel Heath Centre Bhabon (1st Floor)',
    branchAddressLine2: 'Holding # 42/1, N.S. Road',
    branchAddressLine3: 'Ward # 3, Kushtia',
    branchSwift: 'BRAKBDDH',
    branchEmail: 'enquiry@bracbank.com',
    branchWebsite: 'www.bracbank.com',
    branchPhone: '16221',
    refNo: 'BBL 3101-2025-000433',
    customerId: '05651531',
    accountNo: '1056515310001',
    accountType: 'SAVINGS ACCOUNT',
    currency: 'BDT',
    issueDate: 'October 06, 2025 02:00:06 pm',
    startDate: '2024-10-07',
    endDate: '2025-10-05',
    startBalance: 228807.94,
    endBalance: 100000.00,
    numberOfTransactions: 40,
  });

  const handleGenerate = () => {
    const txs = generateTransactions(data);
    setTransactions(txs);
    setMode('preview');
  };

  return (
    <main className="min-h-screen bg-black print:bg-white">
      {mode === 'edit' ? (
        <div className="py-12 px-4">
          <DashboardForm data={data} onChange={setData} onGenerate={handleGenerate} />
        </div>
      ) : (
        <StatementPreview data={data} transactions={transactions} onBack={() => setMode('edit')} />
      )}
    </main>
  );
}
