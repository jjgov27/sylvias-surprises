import React, { useState, useEffect, useCallback } from 'react';
import { BankTransaction, StaffUser } from '../types';
import { getBankAccounts, getBankTransactions, addBankTransaction, toggleReconciled, deleteBankTransaction, getBankAccountBalance, getUnreconciledTransactions, titleCase, BankAccount } from '../utils/db';
import { Building2, Plus, CheckCircle, XCircle, Trash2, Filter } from 'lucide-react';

interface Props {
  currentUser: StaffUser;
}

const TX_CATEGORIES = ['Sale', 'Expense', 'Refund', 'Transfer', 'Wages', 'Rent', 'Supplier', 'Other'];

export function BankReconciliation({ currentUser }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unreconciled' | 'reconciled'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // New transaction form
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [txRef, setTxRef] = useState('');
  const [txCategory, setTxCategory] = useState('Other');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accts = await getBankAccounts();
      setAccounts(accts);
      if (accts.length > 0 && !selectedAccount) {
        setSelectedAccount(accts[0].id);
      }
      if (selectedAccount) {
        const txs = await getBankTransactions(selectedAccount, dateFrom || undefined, dateTo || undefined);
        setTransactions(txs);
        const bal = await getBankAccountBalance(selectedAccount);
        setBalance(bal);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? transactions :
    filter === 'unreconciled' ? transactions.filter(t => !t.reconciled) :
    transactions.filter(t => t.reconciled);

  const unreconciledCount = transactions.filter(t => !t.reconciled).length;
  const totalCredits = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebits = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  async function handleAddTransaction() {
    if (!txDesc.trim() || !txAmount || !selectedAccount) return;
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) return;
    const finalAmount = txType === 'debit' ? -amt : amt;
    await addBankTransaction({
      bank_account_id: selectedAccount,
      transaction_date: txDate,
      description: titleCase(txDesc.trim()),
      amount: finalAmount,
      reference: txRef.trim(),
      category: txCategory,
      entered_by: currentUser.initials,
    });
    setShowAdd(false);
    setTxDesc('');
    setTxAmount('');
    setTxRef('');
    setTxCategory('Other');
    await load();
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Building2 size={24} /> Bank Reconciliation
      </h2>

      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <Building2 size={48} className="mx-auto mb-2 text-base-content/30" />
          <p className="text-lg font-semibold">No bank accounts set up</p>
          <p className="text-sm text-base-content/50">Go to Admin &amp; Settings → Bank Accounts to add your accounts first.</p>
        </div>
      ) : (
        <>
          {/* Account selector */}
          <div className="flex gap-2 mb-4 flex-wrap items-end">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-sm">Account</span></label>
              <select className="select select-bordered select-sm" value={selectedAccount}
                onChange={e => setSelectedAccount(Number(e.target.value))}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-sm">From</span></label>
              <input type="date" className="input input-bordered input-sm" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-sm">To</span></label>
              <input type="date" className="input input-bordered input-sm" value={dateTo}
                onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Transaction
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="text-sm text-base-content/60">Balance</div>
                <div className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-error'}`}>£{balance.toFixed(2)}</div>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="text-sm text-base-content/60">Money In</div>
                <div className="text-2xl font-bold text-success">£{totalCredits.toFixed(2)}</div>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="text-sm text-base-content/60">Money Out</div>
                <div className="text-2xl font-bold text-error">£{totalDebits.toFixed(2)}</div>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="text-sm text-base-content/60">Unreconciled</div>
                <div className="text-2xl font-bold text-warning">{unreconciledCount}</div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'unreconciled', 'reconciled'] as const).map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${transactions.length})` :
                 f === 'unreconciled' ? `Unreconciled (${unreconciledCount})` :
                 `Reconciled (${transactions.length - unreconciledCount})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8"><span className="loading loading-spinner loading-lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">No transactions to display.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Reference</th>
                    <th className="text-right">In</th>
                    <th className="text-right">Out</th>
                    <th>Reconciled</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx.id} className={tx.reconciled ? 'opacity-60' : ''}>
                      <td className="text-sm">{new Date(tx.transaction_date + 'T00:00:00').toLocaleDateString('en-GB')}</td>
                      <td>{tx.description}</td>
                      <td><span className="badge badge-ghost badge-sm">{tx.category}</span></td>
                      <td className="text-sm font-mono">{tx.reference || '—'}</td>
                      <td className="text-right font-semibold text-success">{tx.amount > 0 ? `£${tx.amount.toFixed(2)}` : ''}</td>
                      <td className="text-right font-semibold text-error">{tx.amount < 0 ? `£${Math.abs(tx.amount).toFixed(2)}` : ''}</td>
                      <td>
                        <button className={`btn btn-xs ${tx.reconciled ? 'btn-success' : 'btn-outline'} gap-1`}
                          onClick={async () => { await toggleReconciled(tx.id); await load(); }}>
                          {tx.reconciled ? <><CheckCircle size={12} /> ✓</> : 'Mark'}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs text-error"
                          onClick={async () => {
                            if (confirm('Delete this transaction?')) {
                              await deleteBankTransaction(tx.id);
                              await load();
                            }
                          }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add transaction modal */}
      {showAdd && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg flex items-center gap-2"><Plus size={20} /> Add Bank Transaction</h3>
            <div className="mt-4 space-y-3">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Date</span></label>
                <input type="date" className="input input-bordered input-sm w-48" value={txDate}
                  onChange={e => setTxDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Type</span></label>
                <div className="flex gap-2">
                  <button className={`btn btn-sm ${txType === 'credit' ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => setTxType('credit')}>💰 Money In (Credit)</button>
                  <button className={`btn btn-sm ${txType === 'debit' ? 'btn-error' : 'btn-outline'}`}
                    onClick={() => setTxType('debit')}>💸 Money Out (Debit)</button>
                </div>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Amount</span></label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">£</span>
                  <input type="text" className="input input-bordered w-40" value={txAmount}
                    onChange={e => setTxAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Description</span></label>
                <input type="text" className="input input-bordered w-full" value={txDesc}
                  onChange={e => setTxDesc(e.target.value)} placeholder="e.g. Card takings 01/06"
                  style={{ textTransform: 'capitalize' }} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Category</span></label>
                <select className="select select-bordered select-sm" value={txCategory}
                  onChange={e => setTxCategory(e.target.value)}>
                  {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-sm">Reference</span></label>
                <input type="text" className="input input-bordered input-sm w-full" value={txRef}
                  onChange={e => setTxRef(e.target.value)} placeholder="Bank reference / cheque no..." />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary gap-2" onClick={handleAddTransaction}
                disabled={!txDesc.trim() || !txAmount}>
                <Plus size={16} /> Add Transaction
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAdd(false)} />
        </dialog>
      )}
    </div>
  );
}
