import React, { useState, useEffect, useCallback } from 'react';
import { StaffUser, StockItem, CartItem, Customer, ConsignmentItem } from '../types';
import { searchStock, searchStockInStock, getStockByPartNumber, updateStockQty, createSale, addSaleItem, generateInvoiceNumber, searchCustomers, addCustomer, searchConsignmentStock, recordConsignmentSale, addPayment, addTradeInStockItem, getCreditNoteByNumber, useCreditNote, getCreditNotesByCustomer, getGiftVoucherByNumber, useGiftVoucher, SALUTATIONS, CATEGORIES, titleCase, getCategories } from '../utils/db';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Globe, AlertTriangle, CheckCircle, Users, UserPlus, Landmark, ArrowLeftRight, FileText, Tag, Gift, Printer } from 'lucide-react';
import { PostcodeLookup } from './PostcodeLookup';
import { CreditNote, GiftVoucher } from '../types';
// CreditNotePrint import removed — no longer needed for change CN

interface Props {
  currentUser: StaffUser;
  onSaleComplete: (saleId: number, printInvoice: boolean, invoiceNumber?: string) => void;
  resetKey?: number;
}

export function SellSystem({ currentUser, onSaleComplete, resetKey }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerFieldFocused, setCustomerFieldFocused] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ salutation: '', first_name: '', surname: '', phone: '', email: '', address_line1: '', address_line2: '', address_line3: '', postcode: '' });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'sumup' | 'ebay' | 'bank_transfer'>('cash');
  const [saleType, setSaleType] = useState<'receipt' | 'invoice'>('receipt');
  const [dueDate, setDueDate] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [overrideItemId, setOverrideItemId] = useState<number | null>(null);
  const [overrideInitials, setOverrideInitials] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [consignmentResults, setConsignmentResults] = useState<ConsignmentItem[]>([]);

  // Credit note state
  const [creditNoteEnabled, setCreditNoteEnabled] = useState(false);
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const [appliedCreditNote, setAppliedCreditNote] = useState<CreditNote | null>(null);
  const [creditNoteError, setCreditNoteError] = useState('');
  const [creditNoteAmountToUse, setCreditNoteAmountToUse] = useState('');
  const [customerCreditNotes, setCustomerCreditNotes] = useState<CreditNote[]>([]);
  // changeCreditNote state removed — Option A: partial use, same CN keeps its balance
  // showCnPrint removed — no longer needed

  // Gift voucher state
  const [giftVoucherEnabled, setGiftVoucherEnabled] = useState(false);
  const [giftVoucherSearch, setGiftVoucherSearch] = useState('');
  const [appliedGiftVoucher, setAppliedGiftVoucher] = useState<GiftVoucher | null>(null);
  const [giftVoucherError, setGiftVoucherError] = useState('');
  const [giftVoucherAmountToUse, setGiftVoucherAmountToUse] = useState('');

  // Trade-in state
  const [tradeInEnabled, setTradeInEnabled] = useState(false);
  const [tradeInDesc, setTradeInDesc] = useState('');
  const [tradeInCategory, setTradeInCategory] = useState('Other');
  const [tradeInValue, setTradeInValue] = useState('');
  const [tradeInRrp, setTradeInRrp] = useState('');
  const [tradeInLocation, setTradeInLocation] = useState('Back Room');
  const [tradeInNotes, setTradeInNotes] = useState('');
  const [dynCategories, setDynCategories] = useState<string[]>(CATEGORIES);

  useEffect(() => { getCategories().then(setDynCategories); }, []);

  // Reset all state when resetKey changes (after a sale completes)
  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    setSearchQuery(''); setSearchResults([]); setCart([]); setSearching(false); setHasSearched(false);
    setCustomerName('Walk-in'); setSelectedCustomer(null); setCustomerSearch(''); setCustomerResults([]);
    setShowCustomerPicker(false); setCustomerFieldFocused(false); setShowQuickAdd(false);
    setQuickAddForm({ salutation: '', first_name: '', surname: '', phone: '', email: '', address_line1: '', address_line2: '', address_line3: '', postcode: '' });
    setPaymentMethod('cash'); setSaleType('receipt'); setDueDate(''); setPartialAmount('');
    setSaleDate(new Date().toISOString().split('T')[0]); setShowDatePicker(false);
    setShowConfirm(false); setPrintReceipt(true); setProcessing(false);
    setOverrideItemId(null); setOverrideInitials(''); setSaleNotes(''); setConsignmentResults([]);
    setCreditNoteEnabled(false); setCreditNoteSearch(''); setAppliedCreditNote(null); setCreditNoteError(''); setCreditNoteAmountToUse(''); setCustomerCreditNotes([]);
    setGiftVoucherEnabled(false); setGiftVoucherSearch(''); setAppliedGiftVoucher(null); setGiftVoucherError(''); setGiftVoucherAmountToUse('');
    setTradeInEnabled(false); setTradeInDesc(''); setTradeInCategory('Other'); setTradeInValue(''); setTradeInRrp(''); setTradeInLocation('Back Room'); setTradeInNotes('');
    setPriceStrings({});
  }, [resetKey]);

  const doSearch = useCallback(async (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;
    setSearching(true);
    setHasSearched(true);
    try {
      // Try exact part number first
      const exact = await getStockByPartNumber(q.toUpperCase());
      if (exact) {
        setSearchResults([exact]);
        setConsignmentResults([]);
      } else {
        const [results, conResults] = await Promise.all([
          searchStockInStock(q),
          searchConsignmentStock(q),
        ]);
        setSearchResults(results);
        setConsignmentResults(conResults);
      }
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Live search — auto-trigger after 2+ characters with debounce
  const searchTimerRef = React.useRef<any>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      if (q.length === 0) {
        setSearchResults([]);
        setConsignmentResults([]);
        setHasSearched(false);
      }
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      doSearch(q);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  function addToCart(item: StockItem) {
    // Check if already in cart
    const existing = cart.find(c => c.stock.id === item.id);
    if (existing) {
      updateCartQty(item.id, existing.sellQty + 1);
      return;
    }

    // Check zero stock
    if (item.qty <= 0) {
      setOverrideItemId(item.id);
      setOverrideInitials('');
      return;
    }

    setCart(prev => [...prev, {
      stock: item,
      sellQty: 1,
      unitPrice: item.rrp,
      lineTotal: item.rrp,
    }]);
    setPriceStrings(prev => ({ ...prev, [item.id]: item.rrp.toFixed(2) }));
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
  }

  function forceAddToCart(item: StockItem) {
    setCart(prev => [...prev, {
      stock: item,
      sellQty: 1,
      unitPrice: item.rrp,
      lineTotal: item.rrp,
    }]);
    setPriceStrings(prev => ({ ...prev, [item.id]: item.rrp.toFixed(2) }));
    setOverrideItemId(null);
    setOverrideInitials('');
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
  }

  function updateCartQty(stockId: number, newQty: number) {
    if (newQty <= 0) {
      removeFromCart(stockId);
      return;
    }
    setCart(prev => prev.map(c => {
      if (c.stock.id !== stockId) return c;
      const item = c.stock;
      // If trying to sell more than in stock and not already overridden
      if (newQty > item.qty && item.qty > 0) {
        setOverrideItemId(stockId);
        setOverrideInitials('');
        return c;
      }
      return { ...c, sellQty: newQty, lineTotal: c.unitPrice * newQty };
    }));
  }

  // Track editable price strings separately from numeric unitPrice
  const [priceStrings, setPriceStrings] = useState<Record<number, string>>({});

  function updateCartPrice(stockId: number, newPrice: string) {
    setPriceStrings(prev => ({ ...prev, [stockId]: newPrice }));
    const p = parseFloat(newPrice) || 0;
    setCart(prev => prev.map(c => {
      if (c.stock.id !== stockId) return c;
      return { ...c, unitPrice: p, lineTotal: p * c.sellQty };
    }));
  }

  function removeFromCart(stockId: number) {
    setCart(prev => prev.filter(c => c.stock.id !== stockId));
  }

  // When customer changes, load their active credit notes
  useEffect(() => {
    if (selectedCustomer) {
      getCreditNotesByCustomer(selectedCustomer.id).then(notes => {
        setCustomerCreditNotes(notes.filter(n => n.status === 'active' && n.balance > 0));
      });
    } else {
      setCustomerCreditNotes([]);
    }
  }, [selectedCustomer]);

  async function lookupCreditNote() {
    const num = creditNoteSearch.trim().toUpperCase();
    if (!num) return;
    setCreditNoteError('');
    const cn = await getCreditNoteByNumber(num);
    if (!cn) {
      setCreditNoteError(`Credit note "${num}" not found`);
      return;
    }
    if (cn.status !== 'active') {
      setCreditNoteError(`Credit note "${num}" is ${cn.status} — cannot be used`);
      return;
    }
    if (cn.balance <= 0) {
      setCreditNoteError(`Credit note "${num}" has no remaining balance`);
      return;
    }
    // If we have a customer selected, check it matches (warn but don't block)
    setAppliedCreditNote(cn);
    setCreditNoteAmountToUse(Math.min(cn.balance, cartTotal).toFixed(2));
    // Auto-select the customer from the credit note if none selected
    if (!selectedCustomer && cn.customer_id) {
      const results = await searchCustomers(cn.customer_name);
      const match = results.find(c => c.id === cn.customer_id);
      if (match) {
        setSelectedCustomer(match);
        setCustomerName([match.salutation, match.first_name, match.surname].filter(Boolean).join(' '));
      }
    }
  }

  function removeCreditNote() {
    setAppliedCreditNote(null);
    setCreditNoteAmountToUse('');
    setCreditNoteSearch('');
    setCreditNoteError('');
  }

  // Gift voucher lookup
  async function lookupGiftVoucher() {
    const num = giftVoucherSearch.trim().toUpperCase();
    if (!num) return;
    setGiftVoucherError('');
    const gv = await getGiftVoucherByNumber(num);
    if (!gv) { setGiftVoucherError(`Gift voucher "${num}" not found`); return; }
    if (gv.status !== 'active') { setGiftVoucherError(`Gift voucher "${num}" is ${gv.status} — cannot be used`); return; }
    if (gv.balance <= 0) { setGiftVoucherError(`Gift voucher "${num}" has no remaining balance`); return; }
    // Check expiry
    const today = new Date().toISOString().split('T')[0];
    if (gv.date_expires && gv.date_expires < today) { setGiftVoucherError(`Gift voucher "${num}" has expired (${gv.date_expires})`); return; }
    setAppliedGiftVoucher(gv);
    setGiftVoucherAmountToUse(Math.min(gv.balance, cartTotal).toFixed(2));
  }

  function removeGiftVoucher() {
    setAppliedGiftVoucher(null);
    setGiftVoucherAmountToUse('');
    setGiftVoucherSearch('');
    setGiftVoucherError('');
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.lineTotal, 0);
  const tradeInAmount = tradeInEnabled ? (parseFloat(tradeInValue) || 0) : 0;
  const creditNoteAmount = creditNoteEnabled && appliedCreditNote ? (parseFloat(creditNoteAmountToUse) || 0) : 0;
  const giftVoucherAmount = giftVoucherEnabled && appliedGiftVoucher ? (parseFloat(giftVoucherAmountToUse) || 0) : 0;
  const effectiveTotal = Math.max(0, cartTotal - tradeInAmount - creditNoteAmount - giftVoucherAmount);

  async function completeSale(printInvoice: boolean) {
    setProcessing(true);
    try {
      const invoiceNum = await generateInvoiceNumber();
      // Determine payment amounts
      let amountPaid = cartTotal;
      let balanceDue = 0;
      let status = 'paid';

      if (saleType === 'invoice') {
        // Account sale — unpaid
        const partial = partialAmount ? parseFloat(partialAmount) : 0;
        const totalDeposit = partial + tradeInAmount + creditNoteAmount + giftVoucherAmount;
        amountPaid = totalDeposit;
        balanceDue = cartTotal - totalDeposit;
        status = totalDeposit > 0 ? (totalDeposit >= cartTotal ? 'paid' : 'partial') : 'unpaid';
      }

      // For pay-now sales, the full cartTotal is paid (trade-in + credit note + gift voucher count as payment)
      const totalCredits = tradeInAmount + creditNoteAmount + giftVoucherAmount;
      const primaryMethod = totalCredits >= cartTotal
        ? (giftVoucherAmount >= cartTotal ? 'gift_voucher' : creditNoteAmount >= cartTotal ? 'credit_note' : 'trade_in')
        : (saleType === 'invoice' && amountPaid === 0 ? 'account' : paymentMethod);

      const saleId = await createSale({
        customer_name: selectedCustomer
          ? [selectedCustomer.salutation, selectedCustomer.first_name, selectedCustomer.surname].filter(Boolean).join(' ')
          : customerName,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        payment_method: primaryMethod,
        total: cartTotal,
        sold_by: currentUser.initials,
        invoice_number: invoiceNum,
        notes: [
          saleNotes,
          tradeInEnabled ? `Trade-in: ${tradeInDesc} (£${tradeInAmount.toFixed(2)})` : '',
          creditNoteEnabled && appliedCreditNote ? `Credit Note: ${appliedCreditNote.credit_note_number} (£${creditNoteAmount.toFixed(2)})` : '',
          giftVoucherEnabled && appliedGiftVoucher ? `Gift Voucher: ${appliedGiftVoucher.voucher_number} (£${giftVoucherAmount.toFixed(2)})` : '',
        ].filter(Boolean).join(' | ') || '',
        amount_paid: amountPaid,
        balance_due: balanceDue,
        status,
        sale_type: saleType,
        due_date: dueDate,
        sale_date: saleDate + ' 12:00:00',
      });

      // Add sale items and deduct stock
      for (const c of cart) {
        await addSaleItem({
          sale_id: saleId,
          stock_id: c.stock.id,
          part_number: c.stock.part_number,
          description: c.stock.description,
          qty: c.sellQty,
          unit_price: c.unitPrice,
          line_total: c.lineTotal,
          is_consignment: c.isConsignment ? 1 : 0,
          consignment_item_id: c.consignmentItemId || null,
        });
        if (c.isConsignment && c.consignmentItemId) {
          await recordConsignmentSale(c.consignmentItemId, c.sellQty);
        } else {
          const newQty = Math.max(0, c.stock.qty - c.sellQty);
          await updateStockQty(c.stock.id, newQty);
        }
      }

      // Record trade-in as a payment
      if (tradeInEnabled && tradeInAmount > 0) {
        await addPayment({
          sale_id: saleId,
          payment_date: saleDate,
          amount: tradeInAmount,
          payment_method: 'trade_in',
          notes: `Trade-in: ${tradeInDesc}`,
          entered_by: currentUser.initials,
        });

        // Add trade-in item to stock
        await addTradeInStockItem({
          description: titleCase(tradeInDesc),
          category: tradeInCategory,
          qty: 1,
          cost: tradeInAmount,
          rrp: parseFloat(tradeInRrp) || tradeInAmount,
          entered_by: currentUser.initials,
          location: tradeInLocation,
          notes: tradeInNotes,
        });
      }

      // Record credit note payment — partial use: only deduct what's needed, balance stays on same CN
      if (creditNoteEnabled && appliedCreditNote && creditNoteAmount > 0) {
        // Deduct only the amount used — remaining balance stays on the same credit note
        await useCreditNote(appliedCreditNote.id, creditNoteAmount);
        const remainingBalance = Math.max(0, appliedCreditNote.balance - creditNoteAmount);

        const cnPaymentNotes = remainingBalance > 0.005
          ? `Credit Note ${appliedCreditNote.credit_note_number} applied (£${creditNoteAmount.toFixed(2)}) | Remaining balance: £${remainingBalance.toFixed(2)}`
          : `Credit Note ${appliedCreditNote.credit_note_number} applied (£${creditNoteAmount.toFixed(2)}) | Fully used`;
        await addPayment({
          sale_id: saleId,
          payment_date: saleDate,
          amount: creditNoteAmount,
          payment_method: 'credit_note',
          notes: cnPaymentNotes,
          entered_by: currentUser.initials,
        });
      }

      // Record gift voucher payment
      if (giftVoucherEnabled && appliedGiftVoucher && giftVoucherAmount > 0) {
        const gvRemaining = Math.max(0, (appliedGiftVoucher.balance || appliedGiftVoucher.amount) - giftVoucherAmount);
        const gvNotes = gvRemaining > 0
          ? `Gift Voucher ${appliedGiftVoucher.voucher_number} redeemed. Remaining balance: £${gvRemaining.toFixed(2)}`
          : `Gift Voucher ${appliedGiftVoucher.voucher_number} redeemed (fully used)`;
        await addPayment({
          sale_id: saleId,
          payment_date: saleDate,
          amount: giftVoucherAmount,
          payment_method: 'gift_voucher',
          notes: gvNotes,
          entered_by: currentUser.initials,
        });
        // Mark gift voucher as used
        await useGiftVoucher(appliedGiftVoucher.id, giftVoucherAmount);
      }

      // Record cash/card payment (the non-trade-in, non-credit-note, non-gift-voucher portion)
      const cashPortion = saleType === 'invoice'
        ? (parseFloat(partialAmount) || 0)
        : effectiveTotal;

      if (cashPortion > 0) {
        await addPayment({
          sale_id: saleId,
          payment_date: saleDate,
          amount: cashPortion,
          payment_method: paymentMethod,
          notes: saleType === 'invoice' ? 'Initial deposit at point of sale' : ((tradeInEnabled || creditNoteEnabled || giftVoucherEnabled) ? 'Balance payment' : 'Payment at point of sale'),
          entered_by: currentUser.initials,
        });
      }

      setShowConfirm(false);
      onSaleComplete(saleId, printInvoice, invoiceNum);
    } catch (err) {
      alert('Error completing sale: ' + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  // Override modal
  const overrideStock = overrideItemId !== null
    ? (searchResults.find(r => r.id === overrideItemId) || cart.find(c => c.stock.id === overrideItemId)?.stock)
    : null;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart size={24} /> Point of Sale
      </h2>

      {/* Search */}
      <div className="card bg-base-200 shadow mb-4">
        <div className="card-body p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Search size={18} /> Find Item
          </h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                className="input input-bordered w-full pr-8"
                placeholder="Start typing to find items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
              />
              {searchQuery && (
                <button
                  className="btn btn-ghost btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2 opacity-60"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setConsignmentResults([]); setHasSearched(false); }}
                >✕</button>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => doSearch()} disabled={searching || !searchQuery.trim()}>
              {searching ? <span className="loading loading-spinner loading-sm" /> : <Search size={18} />}
            </button>
          </div>
          {searching && <div className="text-sm text-base-content/50 mt-1">Searching...</div>}

          {/* Search results */}
          {hasSearched && !searching && (
            <div className="mt-3">
              {searchResults.length === 0 ? (
                <div className="alert alert-warning">
                  <AlertTriangle size={18} /> No items found for "{searchQuery}"
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Part No</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">RRP</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(item => {
                        const inCart = cart.some(c => c.stock.id === item.id);
                        return (
                        <tr key={item.id} className={`${item.qty <= 0 ? 'text-error' : ''} ${!inCart ? 'hover:bg-base-200 cursor-pointer' : ''} transition-colors`}
                          onClick={() => { if (!inCart) addToCart(item); }}>
                          <td className="font-mono text-sm">{item.part_number}</td>
                          <td>
                            {item.description}
                            {item.entry_type === 'purchase' 
                              ? <span style={{width:8,height:8,borderRadius:2,backgroundColor:'#EAB308',display:'inline-block',marginLeft:4}} title="Purchased Stock" />
                              : item.entry_type === 'trade_in'
                              ? <span style={{width:8,height:8,borderRadius:2,backgroundColor:'#22C55E',display:'inline-block',marginLeft:4}} title="Trade-In Stock" />
                              : <span style={{width:8,height:8,borderRadius:2,backgroundColor:'#8B6914',display:'inline-block',marginLeft:4}} title="Existing Stock" />
                            }
                          </td>
                          <td className="text-sm">{item.category}</td>
                          <td className="text-sm">{item.location}</td>
                          <td className="text-right font-bold">{item.qty}{item.qty <= 0 && ' ⚠️'}</td>
                          <td className="text-right">£{item.rrp.toFixed(2)}</td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => { e.stopPropagation(); if (!inCart) addToCart(item); }}
                              disabled={inCart}
                            >
                              {inCart ? 'In Cart' : 'Sell'}
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Consignment results */}
              {consignmentResults.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-warning mb-1">📦 Consignment Items</h4>
                  <table className="table table-sm table-zebra w-full">
                    <thead><tr><th>Description</th><th>Consigner</th><th className="text-right">Qty Left</th><th className="text-right">Price</th><th></th></tr></thead>
                    <tbody>
                      {consignmentResults.map(ci => {
                        const conInCart = cart.some(c => c.consignmentItemId === ci.id);
                        const addConsignment = () => {
                          if (conInCart) return;
                          setCart(prev => [...prev, {
                            stock: { id: 0, part_number: `CON-${ci.id}`, description: ci.description, photo: '', qty: ci.qty_remaining, location: '', cost: 0, rrp: ci.selling_price, entered_by: '', category: 'Consignment', created_at: ci.created_at, on_offer: 0, offer_price: 0, supplier_id: null, source_type: '' } as StockItem,
                            sellQty: 1, unitPrice: ci.selling_price, lineTotal: ci.selling_price,
                            isConsignment: true, consignmentItemId: ci.id,
                          }]);
                          setConsignmentResults([]);
                          setSearchResults([]);
                          setSearchQuery('');
                          setHasSearched(false);
                        };
                        return (
                        <tr key={`con-${ci.id}`} className={`${!conInCart ? 'hover:bg-base-200 cursor-pointer' : ''} transition-colors`}
                          onClick={addConsignment}>
                          <td>{ci.description}</td>
                          <td className="text-sm">{ci.consigner_name}</td>
                          <td className="text-right font-bold">{ci.qty_remaining}</td>
                          <td className="text-right">£{ci.selling_price.toFixed(2)}</td>
                          <td>
                            <button className="btn btn-warning btn-sm" disabled={conInCart}
                              onClick={(e) => { e.stopPropagation(); addConsignment(); }}>
                              {conInCart ? 'In Cart' : 'Sell'}
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sale Date — always visible */}
      <div className="card bg-base-200 shadow mb-4">
        <div className="card-body p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">📅 Sale Date:</span>
            <span className="text-sm">{new Date(saleDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {saleDate !== new Date().toISOString().split('T')[0] && (
              <span className="badge badge-warning badge-sm">Backdated</span>
            )}
            <button className="btn btn-ghost btn-xs" onClick={() => setShowDatePicker(!showDatePicker)}>
              {showDatePicker ? 'Hide' : 'Change'}
            </button>
            {showDatePicker && saleDate !== new Date().toISOString().split('T')[0] && (
              <button className="btn btn-ghost btn-xs text-info" onClick={() => { setSaleDate(new Date().toISOString().split('T')[0]); setShowDatePicker(false); }}>
                Reset to Today
              </button>
            )}
          </div>
          {showDatePicker && (
            <input type="date" className="input input-bordered input-sm w-48 mt-1" value={saleDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setSaleDate(e.target.value)} />
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="card bg-base-200 shadow mb-4">
        <div className="card-body p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ShoppingCart size={18} /> Sale Items
            {cart.length > 0 && <span className="badge badge-primary">{cart.length}</span>}
          </h3>

          {cart.length === 0 ? (
            <p className="text-base-content/50 italic py-4 text-center">
              Search and add items above to start a sale
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>Part No</th>
                      <th>Description</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Line Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(c => (
                      <tr key={c.isConsignment ? `con-${c.consignmentItemId}` : String(c.stock.id)}>
                        <td className="font-mono text-sm">{c.stock.part_number}</td>
                        <td>
                          {c.stock.description}
                          {c.isConsignment && <span className="badge badge-warning badge-xs ml-1">Consignment</span>}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button className="btn btn-ghost btn-xs" onClick={() => updateCartQty(c.stock.id, c.sellQty - 1)}>
                              <Minus size={14} />
                            </button>
                            <span className="font-bold w-8 text-center">{c.sellQty}</span>
                            <button className="btn btn-ghost btn-xs" onClick={() => updateCartQty(c.stock.id, c.sellQty + 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input input-bordered input-sm w-24 text-right"
                            value={priceStrings[c.stock.id] ?? c.unitPrice.toFixed(2)}
                            onChange={e => updateCartPrice(c.stock.id, e.target.value)}
                            onBlur={() => {
                              // Format on blur
                              const p = parseFloat(priceStrings[c.stock.id] || '0') || 0;
                              setPriceStrings(prev => ({ ...prev, [c.stock.id]: p.toFixed(2) }));
                            }}
                          />
                        </td>
                        <td className="text-right font-bold">£{c.lineTotal.toFixed(2)}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm text-error" onClick={() => removeFromCart(c.stock.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right text-lg font-bold">TOTAL:</td>
                      <td className="text-right text-lg font-bold text-primary">£{cartTotal.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Customer selection — inline search */}
              <div className="form-control mt-3">
                <label className="label"><span className="label-text font-semibold flex items-center gap-1"><Users size={14} /> Customer</span></label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 bg-base-100 rounded-lg p-2 border border-primary/30">
                    <div className="flex-1">
                      <div className="font-bold">
                        {[selectedCustomer.salutation, selectedCustomer.first_name, selectedCustomer.surname].filter(Boolean).join(' ')}
                      </div>
                      <div className="text-xs text-base-content/60">
                        {[selectedCustomer.address_line1, selectedCustomer.postcode].filter(Boolean).join(', ')}
                        {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={() => { setSelectedCustomer(null); setCustomerName('Walk-in'); setCustomerSearch(''); setCustomerResults([]); }}>✕</button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-1"
                        placeholder="Type customer name to search, or leave blank for Walk-in..."
                        value={customerFieldFocused ? customerSearch : (customerSearch || customerName)}
                        onChange={async e => {
                          const v = e.target.value;
                          setCustomerSearch(v);
                          setCustomerName(v || 'Walk-in');
                          if (v.trim().length >= 2) {
                            const results = await searchCustomers(v.trim());
                            setCustomerResults(results);
                            setShowCustomerPicker(true);
                          } else {
                            setCustomerResults([]);
                            setShowCustomerPicker(false);
                          }
                        }}
                        onFocus={async () => {
                          setCustomerFieldFocused(true);
                          if (customerSearch.trim().length >= 2) {
                            const results = await searchCustomers(customerSearch.trim());
                            setCustomerResults(results);
                            setShowCustomerPicker(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setCustomerFieldFocused(false), 200);
                        }}
                      />
                      <button className="btn btn-outline btn-sm btn-success gap-1" onClick={() => setShowQuickAdd(true)}>
                        <UserPlus size={14} /> New
                      </button>
                    </div>
                    {/* Inline dropdown results */}
                    {showCustomerPicker && customerResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-12 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {customerResults.map(c => (
                          <div key={c.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-base-200 cursor-pointer border-b border-base-200 last:border-0"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerName([c.salutation, c.first_name, c.surname].filter(Boolean).join(' '));
                              setShowCustomerPicker(false);
                              setCustomerSearch('');
                              setCustomerResults([]);
                            }}>
                            <div>
                              <div className="font-bold text-sm">{[c.salutation, c.first_name, c.surname].filter(Boolean).join(' ')}</div>
                              <div className="text-xs text-base-content/50">{[c.address_line1, c.postcode, c.phone].filter(Boolean).join(' · ')}</div>
                            </div>
                            <span className="text-xs text-primary font-semibold">Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showCustomerPicker && customerSearch.trim().length >= 2 && customerResults.length === 0 && (
                      <div className="absolute z-50 left-0 right-12 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg px-3 py-2 text-sm text-base-content/50">
                        No customers found — use "New" to add one
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sale Type toggle */}
              {/* Payment method — shown for Pay Now sales when there's a balance to pay */}
              {effectiveTotal > 0 && saleType !== 'invoice' && (
                <div className="mt-3">
                  <label className="label"><span className="label-text font-semibold">Payment Method</span></label>
                  <div className="flex gap-2 flex-wrap">
                    <button className={`btn ${paymentMethod === 'cash' ? 'btn-success' : 'btn-outline'} gap-2`}
                      onClick={() => setPaymentMethod('cash')}>
                      <Banknote size={18} /> Cash
                    </button>
                    <button className={`btn ${paymentMethod === 'sumup' ? 'btn-info' : 'btn-outline'} gap-2`}
                      onClick={() => setPaymentMethod('sumup')}>
                      <CreditCard size={18} /> SumUp
                    </button>
                    <button className={`btn ${paymentMethod === 'ebay' ? 'btn-warning' : 'btn-outline'} gap-2`}
                      onClick={() => setPaymentMethod('ebay')}>
                      <Globe size={18} /> eBay
                    </button>
                    <button className={`btn ${paymentMethod === 'bank_transfer' ? 'btn-secondary' : 'btn-outline'} gap-2`}
                      onClick={() => setPaymentMethod('bank_transfer')}>
                      <Landmark size={18} /> Bank Transfer
                    </button>
                  </div>
                </div>
              )}

              {/* Three clear sale action buttons */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  className="btn btn-success btn-lg gap-2 flex-1"
                  onClick={() => {
                    if (tradeInEnabled && !tradeInDesc.trim()) {
                      alert('Please enter a description for the trade-in item');
                      return;
                    }
                    if (tradeInEnabled && tradeInAmount <= 0) {
                      alert('Please enter a trade-in allowance value');
                      return;
                    }
                    setSaleType('receipt');
                    setPrintReceipt(true);
                    setShowConfirm(true);
                  }}
                  disabled={processing}
                >
                  <CheckCircle size={20} /> Pay Now + Receipt — £{(tradeInEnabled || creditNoteEnabled || giftVoucherEnabled) && (tradeInAmount + creditNoteAmount + giftVoucherAmount) > 0 ? effectiveTotal.toFixed(2) + ' to pay' : cartTotal.toFixed(2)}
                </button>
                <button
                  className="btn btn-outline btn-warning btn-lg gap-2 flex-1"
                  onClick={() => {
                    if (tradeInEnabled && !tradeInDesc.trim()) {
                      alert('Please enter a description for the trade-in item');
                      return;
                    }
                    if (tradeInEnabled && tradeInAmount <= 0) {
                      alert('Please enter a trade-in allowance value');
                      return;
                    }
                    setSaleType('receipt');
                    setPrintReceipt(false);
                    setShowConfirm(true);
                  }}
                  disabled={processing}
                >
                  <CheckCircle size={20} /> Pay Now — No Receipt
                </button>
                <button
                  className={`btn btn-lg gap-2 flex-1 ${saleType === 'invoice' ? 'btn-info' : 'btn-outline btn-info'}`}
                  onClick={() => {
                    if (saleType === 'invoice') {
                      // Toggle off
                      setSaleType('receipt');
                      setPartialAmount('');
                      setDueDate('');
                    } else {
                      setSaleType('invoice');
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setDueDate(d.toISOString().split('T')[0]);
                    }
                  }}
                  disabled={processing}
                >
                  📋 Invoice
                </button>
              </div>

              {/* Invoice details — shown when Invoice button is selected */}
              {saleType === 'invoice' && (
                <div className="mt-3 p-3 bg-info/10 border border-info/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-info font-semibold text-sm">📋 Account Sale Details</div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-sm">Due Date</span></label>
                    <input type="date" className="input input-bordered input-sm w-48" value={dueDate}
                      onChange={e => setDueDate(e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-sm">Deposit / Part Payment (optional)</span></label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">£</span>
                      <input type="text" className="input input-bordered input-sm w-32" value={partialAmount}
                        onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                      <span className="text-sm text-base-content/50">of £{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* Payment method for deposit */}
                  {partialAmount && parseFloat(partialAmount) > 0 && (
                    <div>
                      <label className="label py-1"><span className="label-text text-sm">Deposit Payment Method</span></label>
                      <div className="flex gap-2 flex-wrap">
                        <button className={`btn btn-sm ${paymentMethod === 'cash' ? 'btn-success' : 'btn-outline'} gap-1`}
                          onClick={() => setPaymentMethod('cash')}>
                          <Banknote size={14} /> Cash
                        </button>
                        <button className={`btn btn-sm ${paymentMethod === 'sumup' ? 'btn-info' : 'btn-outline'} gap-1`}
                          onClick={() => setPaymentMethod('sumup')}>
                          <CreditCard size={14} /> SumUp
                        </button>
                        <button className={`btn btn-sm ${paymentMethod === 'bank_transfer' ? 'btn-secondary' : 'btn-outline'} gap-1`}
                          onClick={() => setPaymentMethod('bank_transfer')}>
                          <Landmark size={14} /> Bank Transfer
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn btn-info gap-2 flex-1"
                      onClick={() => {
                        if (tradeInEnabled && !tradeInDesc.trim()) {
                          alert('Please enter a description for the trade-in item');
                          return;
                        }
                        if (tradeInEnabled && tradeInAmount <= 0) {
                          alert('Please enter a trade-in allowance value');
                          return;
                        }
                        setPrintReceipt(true);
                        setShowConfirm(true);
                      }}
                      disabled={processing}
                    >
                      <CheckCircle size={18} /> Create Invoice + Print
                    </button>
                    <button
                      className="btn btn-outline btn-info gap-2 flex-1"
                      onClick={() => {
                        if (tradeInEnabled && !tradeInDesc.trim()) {
                          alert('Please enter a description for the trade-in item');
                          return;
                        }
                        if (tradeInEnabled && tradeInAmount <= 0) {
                          alert('Please enter a trade-in allowance value');
                          return;
                        }
                        setPrintReceipt(false);
                        setShowConfirm(true);
                      }}
                      disabled={processing}
                    >
                      <CheckCircle size={18} /> Create Invoice — No Print
                    </button>
                  </div>
                </div>
              )}

              {/* Optional extras - collapsible section */}
              <div className="divider text-xs text-base-content/40 mt-4 mb-1">Optional Extras</div>

              {/* Trade-In */}
              <div className="mt-1">
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" className="toggle toggle-accent" checked={tradeInEnabled}
                    onChange={e => {
                      setTradeInEnabled(e.target.checked);
                      if (!e.target.checked) {
                        setTradeInDesc(''); setTradeInValue(''); setTradeInRrp('');
                        setTradeInCategory('Other'); setTradeInLocation('Back Room'); setTradeInNotes('');
                      }
                    }} />
                  <span className="label-text font-semibold flex items-center gap-1">
                    <ArrowLeftRight size={16} /> Trade-In
                  </span>
                </label>
              </div>

              {tradeInEnabled && (
                <div className="mt-2 p-3 bg-accent/10 border border-accent/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-accent font-semibold text-sm">
                    <ArrowLeftRight size={16} /> Trade-In Item Details
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-sm">Item Description *</span></label>
                    <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                      value={tradeInDesc} onChange={e => setTradeInDesc(e.target.value)}
                      placeholder="e.g. Victorian Mantel Clock" />
                  </div>
                  <div className="flex gap-2">
                    <div className="form-control flex-1">
                      <label className="label py-1"><span className="label-text text-sm">Category</span></label>
                      <select className="select select-bordered select-sm" value={tradeInCategory}
                        onChange={e => setTradeInCategory(e.target.value)}>
                        {dynCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-control w-36">
                      <label className="label py-1"><span className="label-text text-sm">Location</span></label>
                      <input type="text" className="input input-bordered input-sm" value={tradeInLocation}
                        onChange={e => setTradeInLocation(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="form-control flex-1">
                      <label className="label py-1"><span className="label-text text-sm">Trade-In Allowance (£) *</span></label>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">£</span>
                        <input type="text" inputMode="decimal" className="input input-bordered input-sm w-28"
                          value={tradeInValue} onChange={e => setTradeInValue(e.target.value)}
                          placeholder="0.00" />
                      </div>
                    </div>
                    <div className="form-control flex-1">
                      <label className="label py-1"><span className="label-text text-sm">Resale Price / RRP (£)</span></label>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">£</span>
                        <input type="text" inputMode="decimal" className="input input-bordered input-sm w-28"
                          value={tradeInRrp} onChange={e => setTradeInRrp(e.target.value)}
                          placeholder="Same as allowance" />
                      </div>
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-sm">Notes (optional)</span></label>
                    <input type="text" className="input input-bordered input-sm"
                      value={tradeInNotes} onChange={e => setTradeInNotes(e.target.value)}
                      placeholder="Condition, provenance, etc." />
                  </div>
                  {tradeInAmount > 0 && (
                    <div className="bg-accent/20 rounded p-2 text-sm">
                      <div className="flex justify-between"><span>Cart Total:</span><span>£{cartTotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-accent font-bold"><span>Trade-In Credit:</span><span>-£{tradeInAmount.toFixed(2)}</span></div>
                      {creditNoteEnabled && creditNoteAmount > 0 && (
                        <div className="flex justify-between text-info font-bold"><span>Credit Note:</span><span>-£{creditNoteAmount.toFixed(2)}</span></div>
                      )}
                      {giftVoucherEnabled && giftVoucherAmount > 0 && (
                        <div className="flex justify-between text-warning font-bold"><span>Gift Voucher:</span><span>-£{giftVoucherAmount.toFixed(2)}</span></div>
                      )}
                      <div className="divider my-1"></div>
                      <div className="flex justify-between font-bold text-lg"><span>Balance to Pay:</span><span>£{effectiveTotal.toFixed(2)}</span></div>
                    </div>
                  )}
                  {!tradeInDesc.trim() && <p className="text-xs text-error">Please enter a description for the trade-in item</p>}
                </div>
              )}

              {/* Credit Note */}
              <div className="mt-3">
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" className="toggle toggle-info" checked={creditNoteEnabled}
                    onChange={e => {
                      setCreditNoteEnabled(e.target.checked);
                      if (!e.target.checked) {
                        removeCreditNote();
                      }
                    }} />
                  <span className="label-text font-semibold flex items-center gap-1">
                    <Tag size={16} /> Apply Credit Note
                  </span>
                </label>
              </div>

              {creditNoteEnabled && (
                <div className="mt-2 p-3 bg-info/10 border border-info/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-info font-semibold text-sm">
                    <Tag size={16} /> Credit Note Payment
                  </div>

                  {!appliedCreditNote ? (
                    <>
                      {/* Customer's active credit notes */}
                      {customerCreditNotes.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Customer's Credit Notes:</p>
                          <div className="space-y-1">
                            {customerCreditNotes.map(cn => (
                              <div key={cn.id}
                                className="flex items-center justify-between bg-base-100 rounded p-2 border border-base-300 cursor-pointer hover:bg-base-200"
                                onClick={() => {
                                  setAppliedCreditNote(cn);
                                  setCreditNoteAmountToUse(Math.min(cn.balance, cartTotal).toFixed(2));
                                  setCreditNoteSearch(cn.credit_note_number);
                                  setCreditNoteError('');
                                }}>
                                <div>
                                  <span className="font-mono text-sm font-bold">{cn.credit_note_number}</span>
                                  <span className="text-xs text-base-content/60 ml-2">{cn.reason}</span>
                                </div>
                                <span className="font-bold text-success">£{cn.balance.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="divider my-2 text-xs">or enter manually</div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input input-bordered input-sm flex-1 font-mono uppercase"
                          placeholder="Enter credit note number (e.g. CN-2606-0001)"
                          value={creditNoteSearch}
                          onChange={e => { setCreditNoteSearch(e.target.value.toUpperCase()); setCreditNoteError(''); }}
                          onKeyDown={e => e.key === 'Enter' && lookupCreditNote()}
                        />
                        <button className="btn btn-info btn-sm" onClick={lookupCreditNote} disabled={!creditNoteSearch.trim()}>
                          Validate
                        </button>
                      </div>
                      {creditNoteError && (
                        <div className="alert alert-error py-2 text-sm">
                          <AlertTriangle size={16} /> {creditNoteError}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-success" />
                              <span className="font-mono font-bold">{appliedCreditNote.credit_note_number}</span>
                              <span className="badge badge-success badge-sm">Valid</span>
                            </div>
                            <div className="text-sm text-base-content/60 mt-1">
                              {appliedCreditNote.customer_name} · Original: £{appliedCreditNote.amount.toFixed(2)} · Balance: £{appliedCreditNote.balance.toFixed(2)}
                            </div>
                          </div>
                          <button className="btn btn-ghost btn-xs text-error" onClick={removeCreditNote}>✕</button>
                        </div>
                      </div>
                      <div className="form-control">
                        <label className="label py-1"><span className="label-text text-sm">Amount to Apply (£)</span></label>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">£</span>
                          <input type="text" inputMode="decimal" className="input input-bordered input-sm w-32"
                            value={creditNoteAmountToUse}
                            onChange={e => {
                              const val = e.target.value;
                              setCreditNoteAmountToUse(val);
                            }}
                            onBlur={() => {
                              let v = parseFloat(creditNoteAmountToUse) || 0;
                              if (v > appliedCreditNote.balance) v = appliedCreditNote.balance;
                              if (v > cartTotal) v = cartTotal;
                              setCreditNoteAmountToUse(v.toFixed(2));
                            }}
                          />
                          <span className="text-sm text-base-content/50">max £{Math.min(appliedCreditNote.balance, cartTotal).toFixed(2)}</span>
                        </div>
                      </div>
                      {creditNoteAmount > 0 && (
                        <div className="bg-info/20 rounded p-2 text-sm">
                          <div className="flex justify-between"><span>Cart Total:</span><span>£{cartTotal.toFixed(2)}</span></div>
                          {tradeInEnabled && tradeInAmount > 0 && (
                            <div className="flex justify-between text-accent font-bold"><span>Trade-In Credit:</span><span>-£{tradeInAmount.toFixed(2)}</span></div>
                          )}
                          <div className="flex justify-between text-info font-bold"><span>Credit Note:</span><span>-£{creditNoteAmount.toFixed(2)}</span></div>
                          <div className="divider my-1"></div>
                          <div className="flex justify-between font-bold text-lg"><span>Balance to Pay:</span><span>£{effectiveTotal.toFixed(2)}</span></div>
                          {creditNoteAmount < appliedCreditNote.balance && (
                            <div className="text-xs text-info mt-1">
                              💳 Remaining balance on {appliedCreditNote.credit_note_number}: <strong>£{(appliedCreditNote.balance - creditNoteAmount).toFixed(2)}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Gift Voucher */}
              <div className="form-control">
                <label className="label py-1 cursor-pointer justify-start gap-2">
                  <input type="checkbox" className="toggle toggle-warning toggle-sm" checked={giftVoucherEnabled}
                    onChange={e => { setGiftVoucherEnabled(e.target.checked); if (!e.target.checked) removeGiftVoucher(); }} />
                  <span className="label-text font-semibold flex items-center gap-1"><Gift size={14} /> Apply Gift Voucher</span>
                </label>
              </div>

              {giftVoucherEnabled && (
                <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
                  {!appliedGiftVoucher ? (
                    <div>
                      <div className="flex gap-2">
                        <input className="input input-bordered input-sm flex-1 font-mono"
                          placeholder="Enter voucher number (e.g. GV-0206-0001)"
                          value={giftVoucherSearch}
                          onChange={e => { setGiftVoucherSearch(e.target.value.toUpperCase()); setGiftVoucherError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') lookupGiftVoucher(); }} />
                        <button className="btn btn-warning btn-sm" onClick={lookupGiftVoucher} disabled={!giftVoucherSearch.trim()}>
                          Validate
                        </button>
                      </div>
                      {giftVoucherError && (
                        <div className="text-error text-sm mt-2 flex items-center gap-1">
                          <AlertTriangle size={16} /> {giftVoucherError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-success" />
                            <span className="font-mono font-bold">{appliedGiftVoucher.voucher_number}</span>
                            <span className="badge badge-success badge-sm">Valid</span>
                          </div>
                          <div className="text-sm text-base-content/60 mt-1">
                            {appliedGiftVoucher.recipient_name || appliedGiftVoucher.purchaser_name} · Value: £{appliedGiftVoucher.amount.toFixed(2)} · Balance: £{appliedGiftVoucher.balance.toFixed(2)}
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-xs text-error" onClick={removeGiftVoucher}>✕</button>
                      </div>
                      <div className="mt-2">
                        <label className="label py-0"><span className="label-text text-xs">Amount to apply:</span></label>
                        <input className="input input-bordered input-sm w-32 font-mono" value={giftVoucherAmountToUse}
                          onChange={e => setGiftVoucherAmountToUse(e.target.value)}
                          onBlur={() => {
                            let v = parseFloat(giftVoucherAmountToUse) || 0;
                            v = Math.min(v, appliedGiftVoucher.balance, cartTotal);
                            setGiftVoucherAmountToUse(v.toFixed(2));
                          }} />
                      </div>
                      {giftVoucherAmount > 0 && (
                        <div className="mt-2 p-2 bg-warning/10 rounded">
                          <div className="flex justify-between text-sm"><span>Cart Total:</span><span>£{cartTotal.toFixed(2)}</span></div>
                          {tradeInAmount > 0 && <div className="flex justify-between text-sm text-accent"><span>Trade-In:</span><span>-£{tradeInAmount.toFixed(2)}</span></div>}
                          {creditNoteAmount > 0 && <div className="flex justify-between text-sm text-info"><span>Credit Note:</span><span>-£{creditNoteAmount.toFixed(2)}</span></div>}
                          <div className="flex justify-between text-warning font-bold"><span>Gift Voucher:</span><span>-£{giftVoucherAmount.toFixed(2)}</span></div>
                          <div className="divider my-1"></div>
                          <div className="flex justify-between font-bold text-lg"><span>Balance to Pay:</span><span>£{effectiveTotal.toFixed(2)}</span></div>
                          {giftVoucherAmount < appliedGiftVoucher.balance && (
                            <div className="text-xs text-base-content/50 mt-1">
                              Remaining on voucher after this sale: £{(appliedGiftVoucher.balance - giftVoucherAmount).toFixed(2)}
                            </div>
                          )}
                          {giftVoucherAmount >= appliedGiftVoucher.balance && (
                            <div className="text-xs text-warning mt-1">
                              ⚠️ Voucher will be fully redeemed
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="form-control mt-3">
                <label className="label"><span className="label-text font-semibold">Sale Notes (optional)</span></label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Any notes for this sale..."
                />
              </div>

            </>
          )}
        </div>
      </div>

      {/* Override modal for zero/low stock */}
      {overrideItemId !== null && overrideStock && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg flex items-center gap-2 text-warning">
              <AlertTriangle size={22} /> Stock Override Required
            </h3>
            <p className="py-2">
              <strong>{overrideStock.description}</strong> ({overrideStock.part_number})<br />
              Current stock: <strong className="text-error">{overrideStock.qty}</strong>
            </p>
            <p className="text-sm text-base-content/70 mb-3">
              Enter your initials to override and sell this item with insufficient stock.
            </p>
            <div className="form-control">
              <input
                type="text"
                className="input input-bordered w-32"
                placeholder="Initials"
                value={overrideInitials}
                onChange={e => setOverrideInitials(e.target.value.toUpperCase())}
                maxLength={4}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setOverrideItemId(null); setOverrideInitials(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-warning"
                disabled={overrideInitials.length < 2}
                onClick={() => forceAddToCart(overrideStock)}
              >
                Override & Add ({overrideInitials})
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setOverrideItemId(null); setOverrideInitials(''); }} />
        </dialog>
      )}

      {/* Confirm sale modal */}
      {showConfirm && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{saleType === 'invoice' ? 'Confirm Account Sale' : 'Confirm Sale'}</h3>
            <div className="py-3">
              <p><strong>Customer:</strong> {selectedCustomer
                ? [selectedCustomer.salutation, selectedCustomer.first_name, selectedCustomer.surname].filter(Boolean).join(' ')
                : customerName}</p>
              <p><strong>Items:</strong> {cart.length}</p>
              {tradeInEnabled && tradeInAmount > 0 && (
                <div className="my-2 p-2 bg-accent/10 rounded">
                  <p><strong>🔄 Trade-In:</strong> {tradeInDesc}</p>
                  <p><strong>Trade-In Value:</strong> <span className="text-accent font-bold">-£{tradeInAmount.toFixed(2)}</span></p>
                  <p className="text-xs text-base-content/60">Item will be added to stock automatically</p>
                </div>
              )}
              {creditNoteEnabled && appliedCreditNote && creditNoteAmount > 0 && (
                <div className="my-2 p-2 bg-info/10 rounded">
                  <p><strong>🏷️ Credit Note:</strong> {appliedCreditNote.credit_note_number}</p>
                  <p><strong>Credit Applied:</strong> <span className="text-info font-bold">-£{creditNoteAmount.toFixed(2)}</span></p>
                  {creditNoteAmount < appliedCreditNote.balance && (
                    <p className="text-sm text-info mt-1">💳 Remaining balance on {appliedCreditNote.credit_note_number}: <strong>£{(appliedCreditNote.balance - creditNoteAmount).toFixed(2)}</strong></p>
                  )}
                </div>
              )}
              {giftVoucherEnabled && appliedGiftVoucher && giftVoucherAmount > 0 && (
                <div className="my-2 p-2 bg-warning/10 rounded">
                  <p><strong>🎁 Gift Voucher:</strong> {appliedGiftVoucher.voucher_number}</p>
                  <p><strong>Amount Applied:</strong> <span className="text-warning font-bold">-£{giftVoucherAmount.toFixed(2)}</span></p>
                  {giftVoucherAmount >= appliedGiftVoucher.balance
                    ? <p className="text-xs text-warning mt-1">Voucher will be fully redeemed</p>
                    : <p className="text-xs text-base-content/60 mt-1">Remaining on voucher: £{(appliedGiftVoucher.balance - giftVoucherAmount).toFixed(2)}</p>
                  }
                </div>
              )}
              {saleType === 'receipt' ? (
                <>
                  {effectiveTotal > 0 && (
                    <p><strong>Payment:</strong> {paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'sumup' ? '💳 SumUp' : paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '🌐 eBay'}
                    {(tradeInEnabled || creditNoteEnabled || giftVoucherEnabled) ? ` — £${effectiveTotal.toFixed(2)}` : ''}</p>
                  )}
                  {effectiveTotal <= 0 && (tradeInAmount + creditNoteAmount + giftVoucherAmount >= cartTotal) && (
                    <p><strong>Payment:</strong> {giftVoucherAmount >= cartTotal ? '🎁 Fully covered by gift voucher' : creditNoteAmount >= cartTotal ? '🏷️ Fully covered by credit note' : '🔄 Fully covered by trade-in'}</p>
                  )}
                </>
              ) : (
                <>
                  <p><strong>Type:</strong> 📋 Account Sale (Invoice)</p>
                  {dueDate && <p><strong>Due Date:</strong> {new Date(dueDate + 'T00:00:00').toLocaleDateString('en-GB')}</p>}
                  {partialAmount && parseFloat(partialAmount) > 0 && (
                    <p><strong>Deposit:</strong> £{parseFloat(partialAmount).toFixed(2)} via {paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'sumup' ? '💳 SumUp' : paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '🌐 eBay'}</p>
                  )}
                  <p className="text-warning font-semibold mt-1">Balance Due: £{(cartTotal - tradeInAmount - creditNoteAmount - giftVoucherAmount - (parseFloat(partialAmount) || 0)).toFixed(2)}</p>
                </>
              )}
              {saleDate !== new Date().toISOString().split('T')[0] && (
                <p className="text-warning font-semibold">⚠️ Backdated to: {new Date(saleDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
              )}
              <p className="text-xl font-bold text-primary mt-2">Total: £{cartTotal.toFixed(2)}</p>
            </div>
            <div className={`alert ${printReceipt ? 'alert-success' : 'alert-warning'} mt-2`}>
              {printReceipt
                ? <span>📄 Receipt / invoice will be generated</span>
                : <span>🚫 No receipt — sale recorded only</span>
              }
            </div>
            <div className="modal-action flex-col gap-2 sm:flex-row">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} disabled={processing}>
                Go Back
              </button>
              <button
                className={`btn ${printReceipt ? 'btn-success' : 'btn-warning'} gap-2`}
                onClick={() => completeSale(printReceipt)}
                disabled={processing}
              >
                {processing ? <span className="loading loading-spinner loading-sm" /> : <CheckCircle size={18} />}
                Confirm {saleType === 'invoice' ? 'Invoice' : 'Sale'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !processing && setShowConfirm(false)} />
        </dialog>
      )}
      {/* Customer picker is now inline — no modal needed */}

      {/* Quick-add customer modal */}
      {showQuickAdd && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg flex items-center gap-2"><UserPlus size={20} /> Quick Add Customer</h3>
            <div className="mt-4 space-y-3">
              {/* Postcode Lookup — check if customer already exists */}
              <PostcodeLookup
                type="customer"
                label="Check postcode first — find existing customer"
                selected={null}
                onSelect={(c) => {
                  const cust = c as Customer;
                  setSelectedCustomer(cust);
                  setCustomerName([cust.salutation, cust.first_name, cust.surname].filter(Boolean).join(' '));
                  setShowQuickAdd(false);
                  setQuickAddForm({ salutation: '', first_name: '', surname: '', phone: '', email: '', address_line1: '', address_line2: '', address_line3: '', postcode: '' });
                }}
              />
              <div className="flex gap-2">
                <div className="form-control w-24">
                  <label className="label py-1"><span className="label-text text-xs">Title</span></label>
                  <select className="select select-bordered select-sm" value={quickAddForm.salutation}
                    onChange={e => setQuickAddForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="">—</option>
                    {SALUTATIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">First Name</span></label>
                  <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={quickAddForm.first_name} onChange={e => setQuickAddForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Surname</span></label>
                  <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={quickAddForm.surname} onChange={e => setQuickAddForm(f => ({ ...f, surname: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Phone</span></label>
                  <input type="tel" className="input input-bordered input-sm"
                    value={quickAddForm.phone} onChange={e => setQuickAddForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Email</span></label>
                  <input type="email" className="input input-bordered input-sm"
                    value={quickAddForm.email} onChange={e => setQuickAddForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} />
                </div>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Address Line 1</span></label>
                <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                  value={quickAddForm.address_line1} onChange={e => setQuickAddForm(f => ({ ...f, address_line1: e.target.value }))} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Address Line 2</span></label>
                <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                  value={quickAddForm.address_line2} onChange={e => setQuickAddForm(f => ({ ...f, address_line2: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label className="label py-1"><span className="label-text text-xs">Address Line 3</span></label>
                  <input type="text" className="input input-bordered input-sm" style={{textTransform: 'capitalize'}}
                    value={quickAddForm.address_line3} onChange={e => setQuickAddForm(f => ({ ...f, address_line3: e.target.value }))} />
                </div>
                <div className="form-control w-32">
                  <label className="label py-1"><span className="label-text text-xs">Postcode</span></label>
                  <input type="text" className="input input-bordered input-sm"
                    value={quickAddForm.postcode} onChange={e => setQuickAddForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowQuickAdd(false)}>Cancel</button>
              <button className="btn btn-primary gap-1" onClick={async () => {
                if (!quickAddForm.first_name.trim() && !quickAddForm.surname.trim()) {
                  alert('Please enter at least a first name or surname');
                  return;
                }
                try {
                  const newId = await addCustomer(quickAddForm);
                  const newCust: Customer = {
                    id: newId,
                    ...quickAddForm,
                    created_at: new Date().toISOString(),
                  };
                  setSelectedCustomer(newCust);
                  setCustomerName([newCust.salutation, newCust.first_name, newCust.surname].filter(Boolean).join(' '));
                  setShowQuickAdd(false);
                  setQuickAddForm({ salutation: '', first_name: '', surname: '', phone: '', email: '', address_line1: '', address_line2: '', address_line3: '', postcode: '' });
                } catch (err) {
                  alert('Error: ' + (err as Error).message);
                }
              }}>
                <UserPlus size={16} /> Save & Select
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowQuickAdd(false)} />
        </dialog>
      )}

      {/* Change CN modal removed — credit notes now keep their balance (partial use) */}
    </div>
  );
}
