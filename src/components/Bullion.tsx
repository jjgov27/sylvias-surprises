import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BullionItem, StaffUser, Customer } from '../types';
import { getBullion, addBullion, updateBullion, sellBullion, deleteBullion, getBullionSummary, searchCustomers, addCustomer, getCustomerById, SALUTATIONS, titleCase as dbTitleCase, addExpense } from '../utils/db';
import { PostcodeLookup } from './PostcodeLookup';

const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Palladium'];
const FORMS = ['Coin', 'Bar', 'Round', 'Jewellery', 'Scrap', 'Other'];
const PURITY_OPTIONS: Record<string, string[]> = {
  Gold: ['999 (24ct)', '916 (22ct)', '750 (18ct)', '585 (14ct)', '375 (9ct)'],
  Silver: ['999', '925 (Sterling)', '800'],
  Platinum: ['999', '950', '900'],
  Palladium: ['999', '950'],
};

const PURCHASE_METHODS = [
  { val: 'cash', label: '💷 Cash' },
  { val: 'bank_transfer', label: '🏦 Bank Transfer' },
  { val: 'sumup', label: '💳 SumUp' },
  { val: 'paypal', label: '🅿️ PayPal' },
  { val: 'direct_debit', label: '🔄 Direct Debit' },
  { val: 'standing_order', label: '📋 Standing Order' },
  { val: 'card', label: '💳 Card' },
  { val: 'other', label: '📝 Other' },
];

const SELL_METHODS = [
  { val: 'cash', label: '💷 Cash' },
  { val: 'bank_transfer', label: '🏦 Bank Transfer' },
  { val: 'sumup', label: '💳 SumUp' },
  { val: 'paypal', label: '🅿️ PayPal' },
  { val: 'crypto', label: '₿ Crypto' },
  { val: 'other', label: '📝 Other' },
];

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

interface Props { user: StaffUser; }

export function Bullion({ user }: Props) {
  const [items, setItems] = useState<BullionItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'held' | 'sold' | 'valuation'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sellModal, setSellModal] = useState<BullionItem | null>(null);
  const [sellDate, setSellDate] = useState(today());
  const [sellPrice, setSellPrice] = useState('');
  const [sellMethod, setSellMethod] = useState('cash');
  const [sellBusy, setSellBusy] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [receiptItem, setReceiptItem] = useState<BullionItem | null>(null);
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  // Customer picker state for sell modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [showNewCustForm, setShowNewCustForm] = useState(false);
  const [newCust, setNewCust] = useState({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [err, setErr] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState('cash');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  // Entry type: 'purchase' or 'valuation'
  const [entryType, setEntryType] = useState<'purchase' | 'valuation'>('purchase');
  // Customer picker for valuation (who owns the bullion)
  const [valCustomer, setValCustomer] = useState<Customer | null>(null);
  const [valCustSearch, setValCustSearch] = useState('');
  const [valCustResults, setValCustResults] = useState<Customer[]>([]);
  const [showValCustDropdown, setShowValCustDropdown] = useState(false);
  const [showValNewCustForm, setShowValNewCustForm] = useState(false);
  const [valNewCust, setValNewCust] = useState({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' });
  // Holding receipt modal
  const [holdingReceiptItem, setHoldingReceiptItem] = useState<BullionItem | null>(null);
  const [holdingReceiptCustomer, setHoldingReceiptCustomer] = useState<Customer | null>(null);

  // form state
  const [metalType, setMetalType] = useState('Gold');
  const [form, setForm] = useState('Coin');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('oz');
  const [purity, setPurity] = useState('999 (24ct)');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchasePrice, setPurchasePrice] = useState('');
  const [premiumPaid, setPremiumPaid] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const [rows, sum] = await Promise.all([getBullion(filter === 'valuation' ? 'all' : filter), getBullionSummary()]);
    if (filter === 'valuation') {
      setItems(rows.filter((r: BullionItem) => r.status === 'valuation'));
    } else {
      setItems(rows);
    }
    setSummary(sum);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to form when it opens
  useEffect(() => {
    if (showForm && formRef.current) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [showForm]);

  const resetForm = () => {
    setMetalType('Gold'); setForm('Coin'); setDescription(''); setWeight(''); setWeightUnit('oz');
    setPurity('999 (24ct)'); setPurchaseDate(today()); setPurchasePrice(''); setPremiumPaid('');
    setDealerName(''); setNotes(''); setEditingId(null); setShowForm(false); setErr('');
    setPurchasePaymentMethod('cash'); setEntryType('purchase');
    setValCustomer(null); setValCustSearch(''); setValCustResults([]); setShowValCustDropdown(false);
    setShowValNewCustForm(false); setValNewCust({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' });
  };

  const handleSave = async () => {
    if (!description.trim()) { setErr('Description is required'); return; }
    const w = parseFloat(weight) || 0;

    if (entryType === 'valuation') {
      // Held for valuation — no money, must have customer
      if (!valCustomer && !showValNewCustForm) { setErr('Customer details are required for valuation items'); return; }
      
      let custId: number | null = null;
      let custName = '';
      if (valCustomer) {
        custId = valCustomer.id;
        custName = [valCustomer.salutation, valCustomer.first_name, valCustomer.surname].filter(Boolean).join(' ');
      } else if (showValNewCustForm && (valNewCust.first_name.trim() || valNewCust.surname.trim())) {
        const newId = await addCustomer({
          salutation: valNewCust.salutation,
          first_name: valNewCust.first_name,
          surname: valNewCust.surname,
          address_line1: valNewCust.address_line1,
          address_line2: valNewCust.address_line2,
          address_line3: valNewCust.address_line3,
          postcode: valNewCust.postcode,
          phone: valNewCust.phone,
          email: valNewCust.email,
        });
        custId = newId;
        custName = [valNewCust.salutation, dbTitleCase(valNewCust.first_name.trim()), dbTitleCase(valNewCust.surname.trim())].filter(Boolean).join(' ');
        const saved = await getCustomerById(newId);
        setValCustomer(saved);
      } else {
        setErr('Please enter customer name'); return;
      }
      
      const data = {
        metal_type: metalType, form, description: titleCase(description.trim()),
        weight: w, weight_unit: weightUnit, purity: purity.split(' ')[0],
        purchase_date: purchaseDate, purchase_price: 0, premium_paid: 0,
        dealer_name: '', sell_date: '', sale_price: 0,
        status: 'valuation', payment_method: '', buyer_name: custName, customer_id: custId,
        notes: notes.trim() ? `VALUATION: ${notes.trim()}` : 'Held for valuation',
        entered_by: user.initials,
        purchase_payment_method: '',
      };
      
      if (editingId) {
        await updateBullion(editingId, data);
        resetForm(); load();
      } else {
        const newId = await addBullion(data);
        // Show holding receipt
        const allRows = await getBullion('all');
        const newItem = allRows.find((r: BullionItem) => r.id === newId);
        if (newItem && custId) {
          const cust = await getCustomerById(custId);
          setHoldingReceiptItem(newItem);
          setHoldingReceiptCustomer(cust);
        }
        resetForm(); load();
      }
      return;
    }

    // Normal purchase
    const pp = parseFloat(purchasePrice) || 0;
    const prem = parseFloat(premiumPaid) || 0;
    if (pp <= 0) { setErr('Purchase price is required'); return; }

    const data = {
      metal_type: metalType, form, description: titleCase(description.trim()),
      weight: w, weight_unit: weightUnit, purity: purity.split(' ')[0],
      purchase_date: purchaseDate, purchase_price: pp, premium_paid: prem,
      dealer_name: titleCase(dealerName.trim()), sell_date: '', sale_price: 0,
      status: 'held', payment_method: '', buyer_name: '', customer_id: null, notes: notes.trim(), entered_by: user.initials,
      purchase_payment_method: purchasePaymentMethod,
    };

    if (editingId) {
      await updateBullion(editingId, data);
    } else {
      await addBullion(data);
      // Record expense so the purchase shows in CashUp/Takings
      const totalCost = pp + prem;
      const descText = `Bullion: ${titleCase(description.trim())} (${metalType} ${form})`;
      await addExpense({
        expense_date: purchaseDate,
        category: 'Bullion Purchase',
        description: descText,
        amount: totalCost,
        receipt_photo: '',
        entered_by: user.initials,
        payment_method: purchasePaymentMethod,
        paid_by: user.initials,
      });
    }
    resetForm();
    load();
  };

  const handleEdit = (b: BullionItem) => {
    setEditingId(b.id); setMetalType(b.metal_type); setForm(b.form);
    setDescription(b.description); setWeight(String(b.weight)); setWeightUnit(b.weight_unit);
    setPurity(b.purity); setPurchaseDate(b.purchase_date); setPurchasePrice(String(b.purchase_price));
    setPremiumPaid(String(b.premium_paid)); setDealerName(b.dealer_name); setNotes(b.notes);
    setEntryType(b.status === 'valuation' ? 'valuation' : 'purchase');
    if (b.status === 'valuation' && b.customer_id) {
      getCustomerById(b.customer_id).then(c => { if (c) setValCustomer(c); });
    }
    setShowForm(true); setErr('');
  };

  const handleSell = async () => {
    if (!sellModal || sellBusy) return;
    const sp = parseFloat(sellPrice) || 0;
    if (sp <= 0) { setErr('Sale price is required'); return; }
    setSellBusy(true);

    let custId: number | null = null;
    let custName = '';
    let custForReceipt: Customer | null = null;

    if (selectedCustomer) {
      custId = selectedCustomer.id;
      custName = [selectedCustomer.salutation, selectedCustomer.first_name, selectedCustomer.surname].filter(Boolean).join(' ');
      custForReceipt = selectedCustomer;
    } else if (showNewCustForm && (newCust.first_name.trim() || newCust.surname.trim())) {
      // Quick-add new customer
      const newId = await addCustomer({
        salutation: newCust.salutation,
        first_name: newCust.first_name,
        surname: newCust.surname,
        address_line1: newCust.address_line1,
        address_line2: newCust.address_line2,
        address_line3: newCust.address_line3,
        postcode: newCust.postcode,
        phone: newCust.phone,
        email: newCust.email,
      });
      custId = newId;
      custName = [newCust.salutation, dbTitleCase(newCust.first_name.trim()), dbTitleCase(newCust.surname.trim())].filter(Boolean).join(' ');
      const saved = await getCustomerById(newId);
      custForReceipt = saved;
    }

    try {
      await sellBullion(sellModal.id, sellDate, sp, sellMethod, custName, custId, user.initials);
      const soldItem: BullionItem = {
        ...sellModal,
        sell_date: sellDate,
        sale_price: sp,
        payment_method: sellMethod,
        buyer_name: custName,
        customer_id: custId,
        status: 'sold',
      };
      setSellModal(null); setSellPrice(''); setSellDate(today()); setSellMethod('cash'); setBuyerName(''); setErr('');
      setSelectedCustomer(null); setCustSearch(''); setCustResults([]); setShowCustDropdown(false); setShowNewCustForm(false);
      setNewCust({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' });
      setReceiptItem(soldItem);
      setReceiptCustomer(custForReceipt);
      load();
    } catch (e) { setErr('Failed to record sale — please try again'); }
    finally { setSellBusy(false); }
  };

  const paymentLabel = (m: string) => {
    const map: Record<string, string> = {
      cash: 'Cash', bank_transfer: 'Bank Transfer', sumup: 'SumUp',
      paypal: 'PayPal', crypto: 'Crypto', other: 'Other',
      direct_debit: 'Direct Debit', standing_order: 'Standing Order', card: 'Card',
    };
    return map[m] || m || 'Cash';
  };

  const generateReceiptPdf = async (item: BullionItem) => {
    setPdfLoading(true);
    try {
      const refNo = `BUL-${String(item.id).padStart(4, '0')}`;
      const saleDate = item.sell_date || '';
      const pmtLabel = paymentLabel(item.payment_method);

      // Build customer address lines
      const custLines: string[] = [];
      if (receiptCustomer) {
        custLines.push([receiptCustomer.salutation, receiptCustomer.first_name, receiptCustomer.surname].filter(Boolean).join(' '));
        if (receiptCustomer.address_line1) custLines.push(receiptCustomer.address_line1);
        if (receiptCustomer.address_line2) custLines.push(receiptCustomer.address_line2);
        if (receiptCustomer.address_line3) custLines.push(receiptCustomer.address_line3);
        if (receiptCustomer.postcode) custLines.push(receiptCustomer.postcode);
        if (receiptCustomer.phone) custLines.push('Tel: ' + receiptCustomer.phone);
        if (receiptCustomer.email) custLines.push(receiptCustomer.email);
      } else if (item.buyer_name) {
        custLines.push(item.buyer_name);
      } else {
        custLines.push('Walk-in Customer');
      }
      const safeDesc = item.description.replace(/'/g, "\\'");
      const custName = custLines[0].replace(/'/g, "\\'");

      const pyScript = `
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas

c = canvas.Canvas('/tmp/bullion_receipt.pdf', pagesize=A4)
w, h = A4
margin = 50

c.setFont("Helvetica-Bold", 20)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, h - 60, "Sylvia's Surprises")
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, h - 75, "Antiques, Collectibles & More")

c.setFont("Helvetica", 8)
c.setFillColor(colors.HexColor("#999999"))
addr_x = w - margin
c.drawRightString(addr_x, h - 50, "Memorial Hall, Main Road")
c.drawRightString(addr_x, h - 61, "Union Mills, IM4 4AD")
c.drawRightString(addr_x, h - 72, "Tel: 07624 433076")
c.drawRightString(addr_x, h - 83, "gavin@sylviassurprises.im")

c.setStrokeColor(colors.HexColor("#5C3D2E"))
c.setLineWidth(2)
c.line(margin, h - 95, w - margin, h - 95)

y = h - 120
c.setFont("Helvetica-Bold", 14)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, y, "RECEIPT")
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${refNo}')

y -= 25
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Date")
y -= 15
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${saleDate}')

y -= 25
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Customer")
y -= 15
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${custName}')
cust_addr = ${JSON.stringify(custLines.slice(1).map(l => l.replace(/'/g, "\\'")))}
if cust_addr:
    c.setFont("Helvetica", 9)
    for addr_line in cust_addr:
        y -= 13
        c.drawString(margin, y, addr_line)

y -= 35
c.setFillColor(colors.HexColor("#5C3D2E"))
c.setFont("Helvetica-Bold", 9)
col = [margin, margin + 200, margin + 310, margin + 380, margin + 430]
c.drawString(col[0], y, "Description")
c.drawRightString(col[1], y, "Metal / Form")
c.drawRightString(col[2], y, "Weight")
c.drawRightString(col[3], y, "Purity")
c.drawRightString(col[4], y, "Amount")

y -= 8
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y, w - margin, y)

c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#333333"))
y -= 22
c.drawString(col[0], y, '${safeDesc}'[:35])
c.drawRightString(col[1], y, '${item.metal_type} / ${item.form}')
c.drawRightString(col[2], y, '${item.weight} ${item.weight_unit}')
c.drawRightString(col[3], y, '${item.purity}')
c.setFont("Helvetica-Bold", 9)
c.drawRightString(col[4], y, "\\u00a3${item.sale_price.toFixed(2)}")

y -= 15
c.setStrokeColor(colors.HexColor("#5C3D2E"))
c.setLineWidth(2)
c.line(col[3] - 10, y + 8, col[4], y + 8)
y -= 10
c.setFont("Helvetica-Bold", 13)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawRightString(col[3], y, "TOTAL")
c.drawRightString(col[4], y, "\\u00a3${item.sale_price.toFixed(2)}")

y -= 35
c.setFillColor(colors.HexColor("#F5EDE3"))
c.roundRect(margin - 5, y - 8, w - 2 * margin + 10, 28, 5, fill=1, stroke=0)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Payment Method")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${pmtLabel}')

y -= 35
c.setFillColor(colors.HexColor("#F5EDE3"))
c.roundRect(margin - 5, y - 8, w - 2 * margin + 10, 28, 5, fill=1, stroke=0)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Amount Paid")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, "\\u00a3${item.sale_price.toFixed(2)}")

y -= 35
c.setFillColor(colors.HexColor("#F5EDE3"))
c.roundRect(margin - 5, y - 8, w - 2 * margin + 10, 28, 5, fill=1, stroke=0)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Balance Due")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, "\\u00a30.00")

y -= 50
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y + 10, w - margin, y + 10)
c.setFont("Helvetica-Oblique", 9)
c.setFillColor(colors.HexColor("#999999"))
c.drawCentredString(w / 2, y - 5, "Thank you for your custom!")
c.setFont("Helvetica", 8)
c.drawCentredString(w / 2, y - 20, "Sylvia's Surprises - Memorial Hall, Union Mills, Isle of Man")

c.save()
print("OK")
`;
      await window.tasklet.writeFileToDisk('/tmp/gen_bullion_receipt.py', pyScript);
      const result = await window.tasklet.runCommand('cd /tmp && python3 gen_bullion_receipt.py', 120);

      if (!result.log.includes('OK')) {
        setErr('PDF generation failed: ' + result.log);
        setPdfLoading(false);
        return;
      }

      const b64Result = await window.tasklet.runCommand(`base64 -w0 /tmp/bullion_receipt.pdf`);
      const b64 = b64Result.log.trim();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bullion-receipt-${refNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr('PDF error: ' + e.message);
    }
    setPdfLoading(false);
  };

  const generateHoldingReceiptPdf = async (item: BullionItem, customer: Customer | null) => {
    setPdfLoading(true);
    try {
      const refNo = `BHR-${String(item.id).padStart(4, '0')}`;
      const dateReceived = item.purchase_date || today();
      
      const custLines: string[] = [];
      if (customer) {
        custLines.push([customer.salutation, customer.first_name, customer.surname].filter(Boolean).join(' '));
        if (customer.address_line1) custLines.push(customer.address_line1);
        if (customer.address_line2) custLines.push(customer.address_line2);
        if (customer.address_line3) custLines.push(customer.address_line3);
        if (customer.postcode) custLines.push(customer.postcode);
        if (customer.phone) custLines.push('Tel: ' + customer.phone);
        if (customer.email) custLines.push(customer.email);
      } else if (item.buyer_name) {
        custLines.push(item.buyer_name);
      }
      const safeDesc = item.description.replace(/'/g, "\\'");
      const custName = (custLines[0] || 'Customer').replace(/'/g, "\\'");
      const safeNotes = (item.notes || '').replace(/'/g, "\\'");

      const pyScript = `
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas

c = canvas.Canvas('/tmp/bullion_holding.pdf', pagesize=A4)
w, h = A4
margin = 50

# Header
c.setFont("Helvetica-Bold", 20)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, h - 60, "Sylvia's Surprises")
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, h - 75, "Antiques, Collectibles & More")

c.setFont("Helvetica", 8)
c.setFillColor(colors.HexColor("#999999"))
addr_x = w - margin
c.drawRightString(addr_x, h - 50, "Memorial Hall, Main Road")
c.drawRightString(addr_x, h - 61, "Union Mills, IM4 4AD")
c.drawRightString(addr_x, h - 72, "Tel: 07624 433076")
c.drawRightString(addr_x, h - 83, "gavin@sylviassurprises.im")

c.setStrokeColor(colors.HexColor("#5C3D2E"))
c.setLineWidth(2)
c.line(margin, h - 95, w - margin, h - 95)

# Title
y = h - 125
c.setFont("Helvetica-Bold", 16)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, y, "BULLION HOLDING RECEIPT")
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${refNo}')

# Important notice box
y -= 35
c.setFillColor(colors.HexColor("#FEF3C7"))
c.setStrokeColor(colors.HexColor("#F59E0B"))
c.setLineWidth(1)
c.roundRect(margin - 5, y - 35, w - 2 * margin + 10, 50, 5, fill=1, stroke=1)
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#92400E"))
c.drawString(margin + 5, y - 5, "This item is held for valuation purposes only.")
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#92400E"))
c.drawString(margin + 5, y - 20, "No money has been exchanged. The item remains the property of the owner named below.")

# Date received
y -= 55
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Date Received")
y -= 15
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${dateReceived}')

# Received by
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(300, y + 15, "Received By")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(300, y, '${user.initials}')

# Owner details
y -= 30
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Owner")
y -= 15
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${custName}')
cust_addr = ${JSON.stringify(custLines.slice(1).map(l => l.replace(/'/g, "\\'")))}
if cust_addr:
    c.setFont("Helvetica", 9)
    for addr_line in cust_addr:
        y -= 13
        c.drawString(margin, y, addr_line)

# Item details table
y -= 35
c.setFillColor(colors.HexColor("#5C3D2E"))
c.setFont("Helvetica-Bold", 9)
col = [margin, margin + 220, margin + 320, margin + 400]
c.drawString(col[0], y, "Description")
c.drawRightString(col[1], y, "Metal / Form")
c.drawRightString(col[2], y, "Weight")
c.drawRightString(col[3], y, "Purity")

y -= 8
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y, w - margin, y)

c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#333333"))
y -= 22
c.drawString(col[0], y, '${safeDesc}'[:40])
c.drawRightString(col[1], y, '${item.metal_type} / ${item.form}')
c.drawRightString(col[2], y, '${item.weight} ${item.weight_unit}')
c.drawRightString(col[3], y, '${item.purity}')

# Notes
notes_text = '${safeNotes}'
if notes_text:
    y -= 30
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawString(margin, y, "Notes")
    y -= 15
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#333333"))
    # Word-wrap notes
    words = notes_text.split()
    line = ''
    for word in words:
        test = line + (' ' if line else '') + word
        if c.stringWidth(test, "Helvetica", 9) > (w - 2 * margin):
            c.drawString(margin, y, line)
            y -= 13
            line = word
        else:
            line = test
    if line:
        c.drawString(margin, y, line)

# Declaration box
y -= 40
c.setFillColor(colors.HexColor("#F5EDE3"))
c.roundRect(margin - 5, y - 80, w - 2 * margin + 10, 95, 5, fill=1, stroke=0)
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin + 5, y, "Declaration")
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#333333"))
y -= 18
c.drawString(margin + 5, y, "I confirm that the above item has been received by Sylvia's Surprises")
y -= 13
c.drawString(margin + 5, y, "for valuation purposes only. No consideration has been paid or received.")
y -= 13
c.drawString(margin + 5, y, "The item will be returned to the owner upon request.")

# Signature lines
y -= 50
c.setStrokeColor(colors.HexColor("#999999"))
c.setLineWidth(0.5)
c.line(margin, y, margin + 200, y)
c.line(300, y, 500, y)
c.setFont("Helvetica", 8)
c.setFillColor(colors.HexColor("#999999"))
c.drawString(margin, y - 12, "Staff Signature")
c.drawString(300, y - 12, "Owner Signature")

# Footer
y -= 45
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y + 10, w - margin, y + 10)
c.setFont("Helvetica-Oblique", 9)
c.setFillColor(colors.HexColor("#999999"))
c.drawCentredString(w / 2, y - 5, "This receipt should be retained by the owner as proof of deposit.")
c.setFont("Helvetica", 8)
c.drawCentredString(w / 2, y - 20, "Sylvia's Surprises - Memorial Hall, Union Mills, Isle of Man")

c.save()
print("OK")
`;
      await window.tasklet.writeFileToDisk('/tmp/gen_bullion_holding.py', pyScript);
      const result = await window.tasklet.runCommand('cd /tmp && python3 gen_bullion_holding.py', 120);
      
      if (!result.log.includes('OK')) {
        setErr('PDF generation failed: ' + result.log);
        setPdfLoading(false);
        return;
      }
      
      const b64Result = await window.tasklet.runCommand(`base64 -w0 /tmp/bullion_holding.pdf`);
      const b64 = b64Result.log.trim();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `holding-receipt-${refNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr('PDF error: ' + e.message);
    }
    setPdfLoading(false);
  };

  const handleDelete = async (id: number) => {
    await deleteBullion(id);
    setDeleteConfirmId(null);
    load();
  };

  const fmt = (n: number) => `£${n.toFixed(2)}`;
  const metalIcon = (m: string) => m === 'Gold' ? '🥇' : m === 'Silver' ? '🥈' : m === 'Platinum' ? '⬜' : '💎';

  const statusBadge = (status: string) => {
    if (status === 'valuation') return { bg: '#dbeafe', color: '#1e40af', icon: '🔍', label: 'Valuation' };
    if (status === 'sold') return { bg: '#d1fae5', color: '#065f46', icon: '✅', label: 'Sold' };
    return { bg: '#fef3c7', color: '#92400e', icon: '🔒', label: 'Held' };
  };

  // Customer picker component for sell and valuation
  const CustomerPicker = ({ mode, selected, onSelect, search, setSearch, results, setResults, showDropdown, setShowDropdown, showNew, setShowNew, newData, setNewData }: {
    mode: string; selected: Customer | null; onSelect: (c: Customer | null) => void;
    search: string; setSearch: (s: string) => void; results: Customer[]; setResults: (r: Customer[]) => void;
    showDropdown: boolean; setShowDropdown: (b: boolean) => void;
    showNew: boolean; setShowNew: (b: boolean) => void;
    newData: typeof newCust; setNewData: (d: typeof newCust) => void;
  }) => (
    <div style={{ position: 'relative' }}>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', background: '#f0fdf4' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {[selected.salutation, selected.first_name, selected.surname].filter(Boolean).join(' ')}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              {[selected.address_line1, selected.postcode].filter(Boolean).join(', ')}
              {selected.phone ? ` · ${selected.phone}` : ''}
            </div>
          </div>
          <button onClick={() => { onSelect(null); setSearch(''); setResults([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      ) : showNew ? (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 10, background: '#fffbeb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>New {mode === 'sell' ? 'Buyer' : 'Owner'} Details</span>
            <button onClick={() => { setShowNew(false); setNewData({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' }); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ marginBottom: 8 }}>
            <PostcodeLookup type="customer" label="Find by postcode" compact selected={null}
              onSelect={(c) => { onSelect(c as Customer); setShowNew(false); setNewData({ salutation: '', first_name: '', surname: '', address_line1: '', address_line2: '', address_line3: '', postcode: '', phone: '', email: '' }); }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <select value={newData.salutation} onChange={e => setNewData({ ...newData, salutation: e.target.value })}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
              <option value="">Title</option>
              {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="First Name *" value={newData.first_name} onChange={e => setNewData({ ...newData, first_name: e.target.value })}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textTransform: 'capitalize' }} />
            <input placeholder="Surname *" value={newData.surname} onChange={e => setNewData({ ...newData, surname: e.target.value })}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textTransform: 'capitalize' }} />
          </div>
          <input placeholder="Address Line 1" value={newData.address_line1} onChange={e => setNewData({ ...newData, address_line1: e.target.value })}
            style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, marginBottom: 4, textTransform: 'capitalize' }} />
          <input placeholder="Address Line 2" value={newData.address_line2} onChange={e => setNewData({ ...newData, address_line2: e.target.value })}
            style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, marginBottom: 4, textTransform: 'capitalize' }} />
          <input placeholder="Address Line 3" value={newData.address_line3} onChange={e => setNewData({ ...newData, address_line3: e.target.value })}
            style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, marginBottom: 4, textTransform: 'capitalize' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
            <input placeholder="Postcode" value={newData.postcode} onChange={e => setNewData({ ...newData, postcode: e.target.value.toUpperCase() })}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textTransform: 'uppercase' }} />
            <input placeholder="Phone" value={newData.phone} onChange={e => setNewData({ ...newData, phone: e.target.value })}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }} />
          </div>
          <input placeholder="Email" value={newData.email} onChange={e => setNewData({ ...newData, email: e.target.value.toLowerCase() })}
            style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }} />
        </div>
      ) : (
        <div>
          <input value={search} placeholder="Search existing customer or leave blank..."
            onChange={async e => {
              const v = e.target.value;
              setSearch(v);
              if (v.trim().length >= 2) {
                const res = await searchCustomers(v.trim());
                setResults(res); setShowDropdown(true);
              } else { setResults([]); setShowDropdown(false); }
            }}
            onFocus={async () => {
              if (search.trim().length >= 2) {
                const res = await searchCustomers(search.trim());
                setResults(res); setShowDropdown(true);
              }
            }}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          {showDropdown && results.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, maxHeight: 160, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {results.map(c => (
                <div key={c.id} onClick={() => { onSelect(c); setShowDropdown(false); setSearch(''); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <div style={{ fontWeight: 600 }}>{[c.salutation, c.first_name, c.surname].filter(Boolean).join(' ')}</div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>{[c.address_line1, c.postcode].filter(Boolean).join(', ')}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {showDropdown && results.length === 0 && search.trim().length >= 2 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: 10, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>No customers found</div>
            </div>
          )}
          <button onClick={() => setShowNew(true)}
            style={{ marginTop: 6, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            ➕ Add New {mode === 'sell' ? 'Buyer' : 'Owner'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>🪙 Bullion Tracker</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          style={{ background: '#d4a017', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          + Add Bullion
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fef3c7', borderRadius: 10, padding: 16, border: '1px solid #f59e0b' }}>
            <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>HELD PORTFOLIO</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#92400e' }}>{fmt(summary.heldCost)}</div>
            <div style={{ fontSize: 13, color: '#a16207' }}>{summary.heldCount} item{summary.heldCount !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ background: '#d1fae5', borderRadius: 10, padding: 16, border: '1px solid #10b981' }}>
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>SOLD PROFIT</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: summary.soldProfit >= 0 ? '#065f46' : '#dc2626' }}>{fmt(summary.soldProfit)}</div>
            <div style={{ fontSize: 13, color: '#047857' }}>{summary.soldCount} sold | Revenue {fmt(summary.soldRevenue)}</div>
          </div>
          {summary.byMetal.map((m: any) => (
            <div key={m.metal_type} style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{metalIcon(m.metal_type)} {m.metal_type.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{m.count} pcs</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{m.total_weight.toFixed(2)} oz | {fmt(m.total_cost)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'held', 'sold', 'valuation'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 16px', borderRadius: 6, border: filter === f ? '2px solid #d4a017' : '1px solid #d1d5db',
              background: filter === f ? '#fef3c7' : '#fff', fontWeight: filter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'valuation' ? '🔍 Valuation' : f}
          </button>
        ))}
      </div>

      {/* Sell Modal */}
      {sellModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px' }}>💰 Record Sale</h3>
            <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 13 }}>{sellModal.description}</p>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: 13 }}>
              {sellModal.status === 'valuation' ? 'Held for valuation' : `Cost: ${fmt(sellModal.purchase_price + sellModal.premium_paid)}`} | {sellModal.weight}{sellModal.weight_unit} {sellModal.metal_type}
            </p>
            {err && <div style={{ color: '#dc2626', marginBottom: 10, fontSize: 13 }}>{err}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sale Date</label>
              <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sale Price (£)</label>
              <input value={sellPrice} onChange={e => setSellPrice(e.target.value)} autoFocus
                placeholder="0.00" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>👤 Buyer</label>
              <CustomerPicker mode="sell" selected={selectedCustomer} onSelect={setSelectedCustomer}
                search={custSearch} setSearch={setCustSearch} results={custResults} setResults={setCustResults}
                showDropdown={showCustDropdown} setShowDropdown={setShowCustDropdown}
                showNew={showNewCustForm} setShowNew={setShowNewCustForm} newData={newCust} setNewData={setNewCust} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Payment Method</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SELL_METHODS.map(m => (
                  <button key={m.val} onClick={() => setSellMethod(m.val)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: sellMethod === m.val ? '2px solid #d4a017' : '1px solid #d1d5db',
                      background: sellMethod === m.val ? '#fef3c7' : '#fff',
                      color: sellMethod === m.val ? '#92400e' : '#374151',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {sellPrice && (
              <div style={{ padding: 12, borderRadius: 8, background: parseFloat(sellPrice) > (sellModal.purchase_price + sellModal.premium_paid) ? '#d1fae5' : sellModal.status === 'valuation' ? '#dbeafe' : '#fef2f2', marginBottom: 12 }}>
                {sellModal.status === 'valuation' ? (
                  <span style={{ fontWeight: 700 }}>Sale Amount: {fmt(parseFloat(sellPrice) || 0)}</span>
                ) : (
                  <span style={{ fontWeight: 700 }}>Profit: {fmt((parseFloat(sellPrice) || 0) - sellModal.purchase_price - sellModal.premium_paid)}</span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSell} disabled={sellBusy}
                style={{ background: sellBusy ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: sellBusy ? 'not-allowed' : 'pointer', flex: 1, opacity: sellBusy ? 0.7 : 1 }}>
                {sellBusy ? '⏳ Recording...' : 'Confirm Sale'}
              </button>
              <button onClick={() => { setSellModal(null); setErr(''); setSelectedCustomer(null); setCustSearch(''); setCustResults([]); setShowCustDropdown(false); setShowNewCustForm(false); }}
                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 24px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Receipt Modal */}
      {receiptItem && (() => {
        const custName = receiptCustomer
          ? [receiptCustomer.salutation, receiptCustomer.first_name, receiptCustomer.surname].filter(Boolean).join(' ')
          : receiptItem.buyer_name || 'Walk-in Customer';
        const refNo = `BUL-${String(receiptItem.id).padStart(4, '0')}`;
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 600, maxWidth: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <div id="bullion-receipt-content" className="bg-white text-black p-8">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #5C3D2E', paddingBottom: 16, marginBottom: 16 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#5C3D2E', margin: 0 }}>Sylvia&apos;s Surprises</h1>
                  <div style={{ fontSize: 12, color: '#888' }}>Antiques, Collectibles &amp; More</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    Memorial Hall, Main Road<br />Union Mills, IM4 4AD<br />Tel: 07624 433076<br />gavin@sylviassurprises.im
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#5C3D2E', margin: 0 }}>RECEIPT</h2>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>{refNo}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{receiptItem.sell_date}</div>
                </div>
              </div>
              <div style={{ background: '#F5EDE3', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Customer: </span>
                <span style={{ fontWeight: 600 }}>{custName}</span>
                {receiptCustomer && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
                    {receiptCustomer.address_line1 && <div>{receiptCustomer.address_line1}</div>}
                    {receiptCustomer.address_line2 && <div>{receiptCustomer.address_line2}</div>}
                    {receiptCustomer.address_line3 && <div>{receiptCustomer.address_line3}</div>}
                    {receiptCustomer.postcode && <div>{receiptCustomer.postcode}</div>}
                    {receiptCustomer.phone && <div>Tel: {receiptCustomer.phone}</div>}
                    {receiptCustomer.email && <div>{receiptCustomer.email}</div>}
                  </div>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #5C3D2E' }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Metal / Form</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Weight</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Purity</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px', fontSize: 12 }}>{receiptItem.description}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12 }}>{receiptItem.metal_type} / {receiptItem.form}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12, textAlign: 'right' }}>{receiptItem.weight} {receiptItem.weight_unit}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12, textAlign: 'right' }}>{receiptItem.purity}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{fmt(receiptItem.sale_price)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #5C3D2E', paddingTop: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#5C3D2E', marginRight: 24 }}>TOTAL</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#5C3D2E' }}>{fmt(receiptItem.sale_price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F5EDE3', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Payment Method</span>
                <span style={{ fontWeight: 700 }}>{paymentLabel(receiptItem.payment_method)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F5EDE3', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Amount Paid</span>
                <span style={{ fontWeight: 700 }}>{fmt(receiptItem.sale_price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F5EDE3', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Balance Due</span>
                <span style={{ fontWeight: 700 }}>£0.00</span>
              </div>
              <div style={{ borderTop: '1px solid #ddd', paddingTop: 16, textAlign: 'center' }}>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: '#999', margin: 0 }}>Thank you for your custom!</p>
                <p style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Sylvia&apos;s Surprises — Memorial Hall, Union Mills, Isle of Man</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px', justifyContent: 'center' }}>
              <button onClick={() => generateReceiptPdf(receiptItem)} disabled={pdfLoading}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: pdfLoading ? 0.6 : 1 }}>
                {pdfLoading ? '⏳ Generating...' : '📄 Download PDF'}
              </button>
              <button onClick={() => setReceiptItem(null)}
                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Holding Receipt Modal */}
      {holdingReceiptItem && (() => {
        const custName = holdingReceiptCustomer
          ? [holdingReceiptCustomer.salutation, holdingReceiptCustomer.first_name, holdingReceiptCustomer.surname].filter(Boolean).join(' ')
          : holdingReceiptItem.buyer_name || 'Customer';
        const refNo = `BHR-${String(holdingReceiptItem.id).padStart(4, '0')}`;
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 600, maxWidth: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="bg-white text-black p-8">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #5C3D2E', paddingBottom: 16, marginBottom: 16 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#5C3D2E', margin: 0 }}>Sylvia&apos;s Surprises</h1>
                  <div style={{ fontSize: 12, color: '#888' }}>Antiques, Collectibles &amp; More</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    Memorial Hall, Main Road<br />Union Mills, IM4 4AD<br />Tel: 07624 433076<br />gavin@sylviassurprises.im
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#5C3D2E', margin: 0 }}>HOLDING RECEIPT</h2>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>{refNo}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{holdingReceiptItem.purchase_date}</div>
                </div>
              </div>

              {/* Notice */}
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13, marginBottom: 4 }}>This item is held for valuation purposes only.</div>
                <div style={{ color: '#92400e', fontSize: 12 }}>No money has been exchanged. The item remains the property of the owner named below.</div>
              </div>

              {/* Owner */}
              <div style={{ background: '#F5EDE3', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Owner: </span>
                <span style={{ fontWeight: 600 }}>{custName}</span>
                {holdingReceiptCustomer && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
                    {holdingReceiptCustomer.address_line1 && <div>{holdingReceiptCustomer.address_line1}</div>}
                    {holdingReceiptCustomer.address_line2 && <div>{holdingReceiptCustomer.address_line2}</div>}
                    {holdingReceiptCustomer.address_line3 && <div>{holdingReceiptCustomer.address_line3}</div>}
                    {holdingReceiptCustomer.postcode && <div>{holdingReceiptCustomer.postcode}</div>}
                    {holdingReceiptCustomer.phone && <div>Tel: {holdingReceiptCustomer.phone}</div>}
                    {holdingReceiptCustomer.email && <div>{holdingReceiptCustomer.email}</div>}
                  </div>
                )}
              </div>

              {/* Item table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #5C3D2E' }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Metal / Form</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Weight</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 12, fontWeight: 700, color: '#5C3D2E' }}>Purity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px', fontSize: 12 }}>{holdingReceiptItem.description}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12 }}>{holdingReceiptItem.metal_type} / {holdingReceiptItem.form}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12, textAlign: 'right' }}>{holdingReceiptItem.weight} {holdingReceiptItem.weight_unit}</td>
                    <td style={{ padding: '8px 4px', fontSize: 12, textAlign: 'right' }}>{holdingReceiptItem.purity}</td>
                  </tr>
                </tbody>
              </table>

              {holdingReceiptItem.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13 }}>{holdingReceiptItem.notes}</div>
                </div>
              )}

              <div style={{ background: '#F5EDE3', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: '#5C3D2E', marginBottom: 8, fontSize: 13 }}>Declaration</div>
                <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>
                  I confirm that the above item has been received by Sylvia&apos;s Surprises for valuation purposes only. No consideration has been paid or received. The item will be returned to the owner upon request.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingTop: 16 }}>
                <div>
                  <div style={{ borderBottom: '1px solid #999', width: 200, marginBottom: 4 }}>&nbsp;</div>
                  <div style={{ fontSize: 11, color: '#999' }}>Staff Signature</div>
                </div>
                <div>
                  <div style={{ borderBottom: '1px solid #999', width: 200, marginBottom: 4 }}>&nbsp;</div>
                  <div style={{ fontSize: 11, color: '#999' }}>Owner Signature</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #ddd', paddingTop: 16, textAlign: 'center' }}>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: '#999', margin: 0 }}>This receipt should be retained by the owner as proof of deposit.</p>
                <p style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Sylvia&apos;s Surprises — Memorial Hall, Union Mills, Isle of Man</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px', justifyContent: 'center' }}>
              <button onClick={() => generateHoldingReceiptPdf(holdingReceiptItem, holdingReceiptCustomer)} disabled={pdfLoading}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: pdfLoading ? 0.6 : 1 }}>
                {pdfLoading ? '⏳ Generating...' : '📄 Download PDF'}
              </button>
              <button onClick={() => setHoldingReceiptItem(null)}
                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Items Table */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🪙</div>
          <p>No bullion records yet. Click "Add Bullion" to get started.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Metal</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Weight</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Purity</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Cost</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Dealer / Owner</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Sale Price</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Profit</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => {
                const totalCost = b.purchase_price + b.premium_paid;
                const profit = b.status === 'sold' ? b.sale_price - totalCost : null;
                const badge = statusBadge(b.status);
                return (
                  <React.Fragment key={b.id}>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ marginRight: 4 }}>{metalIcon(b.metal_type)}</span>
                      <span style={{ fontWeight: 600 }}>{b.metal_type}</span>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{b.form}</div>
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 500 }}>{b.description}</td>
                    <td style={{ padding: '10px 8px' }}>{b.weight} {b.weight_unit}</td>
                    <td style={{ padding: '10px 8px' }}>{b.purity}</td>
                    <td style={{ padding: '10px 8px' }}>{b.purchase_date}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {b.status === 'valuation' ? '—' : fmt(totalCost)}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280' }}>
                      {b.status === 'valuation' ? (b.buyer_name || '—') : (b.dealer_name || '—')}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: badge.bg, color: badge.color,
                      }}>
                        {badge.icon} {badge.label}
                      </span>
                      {b.status === 'sold' && b.sell_date && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{b.sell_date}</div>
                      )}
                      {b.status === 'sold' && b.payment_method && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{paymentLabel(b.payment_method)}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      {b.status === 'sold' ? fmt(b.sale_price) : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: profit !== null ? (profit >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af' }}>
                      {profit !== null ? fmt(profit) : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {(b.status === 'held' || b.status === 'valuation') && (
                          <button onClick={() => { setSellModal(b); setSellDate(today()); setSellPrice(''); setSellMethod('cash'); setBuyerName(''); setErr('');
                            // Pre-fill buyer from valuation customer
                            if (b.status === 'valuation' && b.customer_id) {
                              getCustomerById(b.customer_id).then(c => { if (c) setSelectedCustomer(c); });
                            }
                          }}
                            style={{ background: '#d4a017', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            Sell
                          </button>
                        )}
                        {b.status === 'valuation' && (
                          <button onClick={async () => {
                            let cust: Customer | null = null;
                            if (b.customer_id) cust = await getCustomerById(b.customer_id);
                            setHoldingReceiptItem(b);
                            setHoldingReceiptCustomer(cust);
                          }}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            🧾 Holding
                          </button>
                        )}
                        {b.status === 'sold' && (
                          <button onClick={async () => {
                            if (b.customer_id) {
                              const cust = await getCustomerById(b.customer_id);
                              setReceiptCustomer(cust);
                            } else {
                              setReceiptCustomer(null);
                            }
                            setReceiptItem(b);
                          }}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            🧾 Receipt
                          </button>
                        )}
                        <button onClick={() => handleEdit(b)}
                          style={{ background: '#e5e7eb', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => setDeleteConfirmId(b.id)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteConfirmId === b.id && (
                    <tr>
                      <td colSpan={11}>
                        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', margin: '4px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>⚠️ Delete this bullion record?</span>
                          <button onClick={() => handleDelete(b.id)}
                            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            Yes, Delete
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)}
                            style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}>
                            No, Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Entry / Edit Form — below items table */}
      {showForm && (
        <div ref={formRef} style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, padding: 20, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editingId ? 'Edit' : 'New'} Bullion Entry</h3>
          {err && <div style={{ color: '#dc2626', marginBottom: 10, fontSize: 13 }}>{err}</div>}

          {/* Entry type toggle */}
          {!editingId && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setEntryType('purchase')}
                style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  border: entryType === 'purchase' ? '2px solid #d4a017' : '1px solid #d1d5db',
                  background: entryType === 'purchase' ? '#fef3c7' : '#fff',
                  color: entryType === 'purchase' ? '#92400e' : '#374151' }}>
                💰 Purchase
              </button>
              <button onClick={() => setEntryType('valuation')}
                style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  border: entryType === 'valuation' ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: entryType === 'valuation' ? '#dbeafe' : '#fff',
                  color: entryType === 'valuation' ? '#1e40af' : '#374151' }}>
                🔍 Held for Valuation
              </button>
            </div>
          )}

          {entryType === 'valuation' && (
            <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: '#1e40af', fontSize: 13 }}>🔍 Valuation Hold</div>
              <div style={{ color: '#1e40af', fontSize: 12, marginTop: 4 }}>No money will be exchanged. A holding receipt will be generated for the customer.</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Metal Type</label>
              <select value={metalType} onChange={e => { setMetalType(e.target.value); setPurity(PURITY_OPTIONS[e.target.value]?.[0] || '999'); }}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                {METAL_TYPES.map(m => <option key={m} value={m}>{metalIcon(m)} {m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Form</label>
              <select value={form} onChange={e => setForm(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Purity</label>
              <select value={purity} onChange={e => setPurity(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                {(PURITY_OPTIONS[metalType] || ['999']).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. 1oz Britannia 2024" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', textTransform: 'capitalize' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Weight</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={weight} onChange={e => setWeight(e.target.value)}
                  placeholder="0" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                <select value={weightUnit} onChange={e => setWeightUnit(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                  <option value="oz">Troy oz</option>
                  <option value="g">Grams</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>{entryType === 'valuation' ? 'Date Received' : 'Purchase Date'}</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>
            {entryType === 'purchase' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Dealer Name</label>
                <input value={dealerName} onChange={e => setDealerName(e.target.value)}
                  placeholder="e.g. Baird & Co" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', textTransform: 'capitalize' }} />
              </div>
            )}
          </div>

          {entryType === 'purchase' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Purchase Price (£)</label>
                <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                  placeholder="0.00" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Premium Paid (£)</label>
                <input value={premiumPaid} onChange={e => setPremiumPaid(e.target.value)}
                  placeholder="0.00" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Total Cost</label>
                <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: 6, fontWeight: 700 }}>
                  {fmt((parseFloat(purchasePrice) || 0) + (parseFloat(premiumPaid) || 0))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Payment Method</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PURCHASE_METHODS.map(m => (
                    <button key={m.val} type="button" onClick={() => setPurchasePaymentMethod(m.val)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: purchasePaymentMethod === m.val ? '2px solid #d4a017' : '1px solid #d1d5db',
                        background: purchasePaymentMethod === m.val ? '#fef3c7' : '#fff',
                        color: purchasePaymentMethod === m.val ? '#92400e' : '#374151',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {entryType === 'valuation' && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>👤 Owner (customer leaving item)</label>
              <CustomerPicker mode="valuation" selected={valCustomer} onSelect={setValCustomer}
                search={valCustSearch} setSearch={setValCustSearch} results={valCustResults} setResults={setValCustResults}
                showDropdown={showValCustDropdown} setShowDropdown={setShowValCustDropdown}
                showNew={showValNewCustForm} setShowNew={setShowValNewCustForm} newData={valNewCust} setNewData={setValNewCust} />
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={entryType === 'valuation' ? 'Condition, reason for valuation, etc.' : 'Condition, certification, etc.'}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={handleSave}
              style={{ background: entryType === 'valuation' ? '#2563eb' : '#d4a017', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}>
              {editingId ? 'Update' : entryType === 'valuation' ? 'Save & Generate Receipt' : 'Save'}
            </button>
            <button onClick={resetForm}
              style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 24px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
