import React, { useState, useEffect } from 'react';
import { Sale, SaleItem, Customer, Payment } from '../types';
import { getSaleById, getSaleItems, getCustomerById, getPaymentsForSale, formatPaymentMethod, addPayment } from '../utils/db';
import { FileDown, ArrowLeft, CheckCircle, Loader2, Banknote } from 'lucide-react';

interface Props {
  saleId: number;
  onBack: () => void;
}

async function generateInvoicePdf(sale: Sale, items: SaleItem[], customer: Customer | null, payments: Payment[] = []): Promise<{url: string; filename: string}> {
  const pmMap: Record<string,string> = { cash:'Cash', sumup:'SumUp (Card)', bank_transfer:'Bank Transfer', ebay:'eBay', account:'On Account', paypal:'PayPal', credit_note:'Credit Note', trade_in:'Trade-In', gift_voucher:'Gift Voucher' };
  const paymentLabel = pmMap[sale.payment_method] || sale.payment_method;
  const amountPaid = sale.amount_paid ?? sale.total;
  const balanceDue = sale.balance_due ?? 0;
  const saleStatus = sale.status ?? 'paid';
  const saleTypeName = sale.sale_type === 'invoice' ? 'INVOICE' : 'RECEIPT';

  const saleDate = new Date(sale.sale_date + 'Z');
  const dateStr = saleDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeStr = saleDate.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  });

  const itemsJson = JSON.stringify(items.map(i => ({
    part_number: i.part_number,
    description: i.description,
    qty: i.qty,
    unit_price: i.unit_price,
    line_total: i.line_total
  })));

  const safeInvoice = sale.invoice_number.replace(/'/g, "\\'");
  const safeCustomer = sale.customer_name.replace(/'/g, "\\'");
  const safeNotes = (sale.notes || '').replace(/'/g, "\\'");
  const safeSoldBy = sale.sold_by.replace(/'/g, "\\'");

  // Build customer address lines for PDF
  const custAddr: string[] = [];
  if (customer) {
    if (customer.address_line1) custAddr.push(customer.address_line1.replace(/'/g, "\\'"));
    if (customer.address_line2) custAddr.push(customer.address_line2.replace(/'/g, "\\'"));
    if (customer.address_line3) custAddr.push(customer.address_line3.replace(/'/g, "\\'"));
    if (customer.postcode) custAddr.push(customer.postcode.replace(/'/g, "\\'"));
    if (customer.phone) custAddr.push('Tel: ' + customer.phone.replace(/'/g, "\\'"));
    if (customer.email) custAddr.push(customer.email.replace(/'/g, "\\'"));
  }
  const filename = `invoice-${sale.invoice_number}.pdf`;
  const outputPath = `/tmp/${filename}`;

  const paymentsJson = JSON.stringify(payments.map(p => ({
    payment_date: p.payment_date,
    amount: p.amount,
    payment_method: p.payment_method,
    notes: p.notes || ''
  })));
  await window.tasklet.writeFileToDisk('/tmp/invoice_items.json', itemsJson);
  await window.tasklet.writeFileToDisk('/tmp/invoice_payments.json', paymentsJson);

  const script = `
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas

with open('/tmp/invoice_items.json', 'r') as f:
    items = json.load(f)
with open('/tmp/invoice_payments.json', 'r') as f:
    payments = json.load(f)

c = canvas.Canvas('${outputPath}', pagesize=A4)
w, h = A4
margin = 50

# Header
c.setFont("Helvetica-Bold", 20)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, h - 60, "Sylvia's Surprises")
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, h - 75, "Antiques, Collectibles & More")

# Address block
c.setFont("Helvetica", 8)
c.setFillColor(colors.HexColor("#999999"))
addr_x = w - margin
c.drawRightString(addr_x, h - 50, "Memorial Hall, Main Road")
c.drawRightString(addr_x, h - 61, "Union Mills, IM4 4AD")
c.drawRightString(addr_x, h - 72, "Tel: 07624 433076")
c.drawRightString(addr_x, h - 83, "gavin@sylviassurprises.im")

# Divider
c.setStrokeColor(colors.HexColor("#5C3D2E"))
c.setLineWidth(2)
c.line(margin, h - 95, w - margin, h - 95)

# Invoice details
y = h - 120
c.setFont("Helvetica-Bold", 14)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin, y, "${saleTypeName}")
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${safeInvoice}')

y -= 25
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Date")
c.drawString(margin + 350, y, "Time")
y -= 15
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${dateStr}')
c.drawString(margin + 350, y, '${timeStr}')

# Customer block
y -= 25
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Customer")
y -= 15
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${safeCustomer}')
cust_addr = ${JSON.stringify(custAddr)}
if cust_addr:
    c.setFont("Helvetica", 9)
    for addr_line in cust_addr:
        y -= 13
        c.drawString(margin, y, addr_line)

# Table header
y -= 35
c.setFillColor(colors.HexColor("#5C3D2E"))
c.setFont("Helvetica-Bold", 9)
col = [margin, margin + 80, margin + 290, margin + 350, margin + 430]
c.drawString(col[0], y, "Part No")
c.drawString(col[1], y, "Description")
c.drawRightString(col[2], y, "Qty")
c.drawRightString(col[3], y, "Unit Price")
c.drawRightString(col[4], y, "Total")

y -= 8
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y, w - margin, y)

# Items
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#333333"))
for item in items:
    y -= 22
    c.drawString(col[0], y, item['part_number'])
    c.drawString(col[1], y, item['description'][:35])
    c.drawRightString(col[2], y, str(item['qty']))
    c.drawRightString(col[3], y, f"\\u00a3{item['unit_price']:.2f}")
    c.drawRightString(col[4], y, f"\\u00a3{item['line_total']:.2f}")

# Total
y -= 15
c.setStrokeColor(colors.HexColor("#5C3D2E"))
c.setLineWidth(2)
c.line(col[3] - 10, y + 8, col[4], y + 8)
y -= 10
discount = ${(sale.discount || 0).toFixed(2)}
if discount > 0:
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#5C3D2E"))
    c.drawRightString(col[3], y, "SUBTOTAL")
    c.drawRightString(col[4], y, f"\\u00a3${sale.total.toFixed(2)}")
    y -= 18
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#9333EA"))
    c.drawRightString(col[3], y, "DISCOUNT")
    c.drawRightString(col[4], y, f"-\\u00a3{discount:.2f}")
    y -= 18
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(colors.HexColor("#5C3D2E"))
    c.drawRightString(col[3], y, "TOTAL")
    c.drawRightString(col[4], y, f"\\u00a3{${sale.total.toFixed(2)} - discount:.2f}")
else:
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(colors.HexColor("#5C3D2E"))
    c.drawRightString(col[3], y, "TOTAL")
    c.drawRightString(col[4], y, f"\\u00a3${sale.total.toFixed(2)}")

# Payment summary box
y -= 30
box_h = 75
c.setFillColor(colors.HexColor("#F5EDE3"))
c.roundRect(margin - 5, y - box_h + 20, w - 2 * margin + 10, box_h, 5, fill=1, stroke=0)

# Payment Method row
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Payment Method")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${paymentLabel}')

# Amount Paid row
y -= 22
c.setStrokeColor(colors.HexColor("#E8DDD0"))
c.setLineWidth(0.5)
c.line(margin, y + 13, w - margin, y + 13)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Amount Paid")
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor("#2E7D32"))
c.drawRightString(w - margin, y, '\\u00a3${amountPaid.toFixed(2)}')

# Balance Due row
y -= 22
c.setStrokeColor(colors.HexColor("#E8DDD0"))
c.line(margin, y + 13, w - margin, y + 13)
c.setFont("Helvetica-Bold", 9)
c.setFillColor(colors.HexColor("#5C3D2E"))
c.drawString(margin + 5, y, "Balance Due")
c.setFont("Helvetica-Bold", 10)
bal_color = "#e53e3e" if ${balanceDue} > 0 else "#5C3D2E"
c.setFillColor(colors.HexColor(bal_color))
c.drawRightString(w - margin, y, '\\u00a3${balanceDue.toFixed(2)}')

# Credit Note / Gift Voucher details
cn_payments = [p for p in payments if p['payment_method'] == 'credit_note']
gv_payments = [p for p in payments if p['payment_method'] == 'gift_voucher']

if cn_payments or gv_payments:
    y -= 25
    box_items = []
    for cp in cn_payments:
        box_items.append(('Credit Note', cp['notes'] or '', cp['amount']))
    for gp in gv_payments:
        box_items.append(('Gift Voucher', gp['notes'] or '', gp['amount']))

    box_h2 = 25 + len(box_items) * 40
    c.setFillColor(colors.HexColor("#EBF5FF"))
    c.roundRect(margin - 5, y - box_h2 + 20, w - 2 * margin + 10, box_h2, 5, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#1E40AF"))
    c.drawString(margin + 5, y, "Pre-Paid Payment Details")
    y -= 5

    for label, notes, amt in box_items:
        y -= 18
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#1E40AF"))
        c.drawString(margin + 10, y, label)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#2E7D32"))
        c.drawRightString(w - margin - 5, y, f"\\u00a3{amt:.2f}")
        if notes:
            y -= 14
            c.setFont("Helvetica", 8)
            c.setFillColor(colors.HexColor("#555555"))
            c.drawString(margin + 10, y, notes[:70])

    # Show remaining balance on credit note
    for cp in cn_payments:
        n = cp.get('notes', '')
        if 'Remaining balance:' in n:
            y -= 18
            c.setStrokeColor(colors.HexColor("#93C5FD"))
            c.line(margin + 5, y + 12, w - margin - 5, y + 12)
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(colors.HexColor("#1E40AF"))
            remaining_part = n.split('Remaining balance:')[1].strip()
            cn_num = n.split(' applied')[0].replace('Credit Note ', '')
            c.drawString(margin + 10, y, f"\\u27a1 Remaining balance on {cn_num}: {remaining_part}")

    # Show remaining balance on gift voucher
    for gp in gv_payments:
        n = gp.get('notes', '')
        if 'Remaining balance:' in n:
            y -= 18
            c.setStrokeColor(colors.HexColor("#93C5FD"))
            c.line(margin + 5, y + 12, w - margin - 5, y + 12)
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(colors.HexColor("#D97706"))
            remaining_part = n.split('Remaining balance:')[1].strip()
            gv_num = n.split(' redeemed')[0].replace('Gift Voucher ', '')
            c.drawString(margin + 10, y, f"\\u27a1 Remaining balance on {gv_num}: {remaining_part}")

# Payment History
pm_labels = {'cash':'Cash','sumup':'SumUp (Card)','bank_transfer':'Bank Transfer','ebay':'eBay','account':'On Account','paypal':'PayPal','credit_note':'Credit Note','crypto':'Crypto','trade_in':'Trade-In','gift_voucher':'Gift Voucher','other':'Other'}
if len(payments) > 0:
    y -= 20
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#166534"))
    c.drawString(margin, y, f"Payment History ({len(payments)} payment{'s' if len(payments) != 1 else ''})")
    y -= 5
    c.setStrokeColor(colors.HexColor("#bbf7d0"))
    c.setLineWidth(0.5)
    c.line(margin, y, w - margin, y)
    c.setFont("Helvetica", 8)
    for idx, pm in enumerate(payments):
        y -= 16
        if y < 80:
            c.showPage()
            y = h - 50
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(margin + 5, y, f"#{idx+1}")
        from datetime import datetime
        try:
            pd = datetime.strptime(pm['payment_date'], '%Y-%m-%d').strftime('%d/%m/%Y')
        except:
            pd = pm['payment_date']
        c.drawString(margin + 30, y, pd)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#2E7D32"))
        c.drawString(margin + 110, y, f"\\u00a3{pm['amount']:.2f}")
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#555555"))
        method_label = pm_labels.get(pm['payment_method'], pm['payment_method'])
        c.drawString(margin + 190, y, method_label)
        if pm.get('notes'):
            c.setFillColor(colors.HexColor("#999999"))
            c.drawString(margin + 310, y, pm['notes'][:60])
    y -= 5
    c.setStrokeColor(colors.HexColor("#bbf7d0"))
    c.line(margin, y, w - margin, y)

# Status badge
y -= 30
sale_status = '${saleStatus}'
if sale_status == 'paid' or sale_status == '':
    c.setFillColor(colors.HexColor("#2E7D32"))
    badge_w = 120
    badge_x = (w - badge_w) / 2
    c.roundRect(badge_x, y - 5, badge_w, 22, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.drawCentredString(w / 2, y, "PAID IN FULL")
elif sale_status == 'partial':
    c.setFillColor(colors.HexColor("#ED8936"))
    badge_w = 200
    badge_x = (w - badge_w) / 2
    c.roundRect(badge_x, y - 5, badge_w, 22, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.drawCentredString(w / 2, y, "PART PAID")
elif sale_status == 'unpaid':
    c.setFillColor(colors.HexColor("#E53E3E"))
    badge_w = 200
    badge_x = (w - badge_w) / 2
    c.roundRect(badge_x, y - 5, badge_w, 22, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.drawCentredString(w / 2, y, "PAYMENT DUE")
elif sale_status == 'refunded':
    c.setFillColor(colors.HexColor("#E53E3E"))
    badge_w = 120
    badge_x = (w - badge_w) / 2
    c.roundRect(badge_x, y - 5, badge_w, 22, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.drawCentredString(w / 2, y, "REFUNDED")
else:
    c.setFillColor(colors.HexColor("#2E7D32"))
    badge_w = 120
    badge_x = (w - badge_w) / 2
    c.roundRect(badge_x, y - 5, badge_w, 22, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.drawCentredString(w / 2, y, "PAID IN FULL")

notes_text = '${safeNotes}'
if notes_text:
    y -= 35
    c.setFillColor(colors.HexColor("#F5EDE3"))
    c.roundRect(margin - 5, y - 8, w - 2 * margin + 10, 28, 5, fill=1, stroke=0)
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawString(margin + 5, y, "Notes")
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#333333"))
    c.drawRightString(w - margin, y, notes_text[:60])

# Footer
y -= 50
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y + 10, w - margin, y + 10)
c.setFont("Helvetica-Oblique", 9)
c.setFillColor(colors.HexColor("#999999"))
c.drawCentredString(w / 2, y - 5, "Thank you for your custom!")
c.setFont("Helvetica", 8)
c.drawCentredString(w / 2, y - 20, "Sylvia's Surprises - Memorial Hall, Union Mills, Isle of Man")
c.drawCentredString(w / 2, y - 33, f"Served by: ${safeSoldBy}")

c.save()
print("OK")
`;

  await window.tasklet.writeFileToDisk('/tmp/gen_invoice.py', script);
  const result = await window.tasklet.runCommand('cd /tmp && python3 gen_invoice.py', 120);

  if (!result.log.includes('OK')) {
    throw new Error('Failed to generate invoice PDF: ' + result.log);
  }

  // Base64-encode the PDF and return as data URL for download
  const b64Result = await window.tasklet.runCommand(`base64 -w0 ${outputPath}`);
  const b64 = b64Result.log.trim();
  if (!b64 || b64Result.exitCode !== 0) {
    throw new Error('Failed to encode PDF');
  }
  const url = `data:application/pdf;base64,${b64}`;
  return { url, filename };
}

export const InvoiceView: React.FC<Props> = ({ saleId, onBack }) => {
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfInfo, setPdfInfo] = useState<{url: string; filename: string} | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Payment form state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccess, setPaySuccess] = useState('');

  useEffect(() => {
    (async () => {
      const s = await getSaleById(saleId);
      const si = await getSaleItems(saleId);
      const pymts = await getPaymentsForSale(saleId);
      setSale(s);
      setItems(si);
      setPayments(pymts);
      if (s?.customer_id) {
        const c = await getCustomerById(s.customer_id);
        setCustomer(c);
      }
      setLoading(false);
    })();
  }, [saleId]);

  async function handleGeneratePdf() {
    if (!sale || items.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateInvoicePdf(sale, items, customer, payments);
      setPdfInfo(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function reloadSale() {
    const s = await getSaleById(saleId);
    const pymts = await getPaymentsForSale(saleId);
    setSale(s);
    setPayments(pymts);
  }

  async function handleRecordPayment() {
    if (!sale) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { setPayError('Please enter a valid amount'); return; }
    const bal = sale.balance_due || 0;
    if (amt > bal + 0.01) { setPayError(`Payment £${amt.toFixed(2)} exceeds balance £${bal.toFixed(2)}`); return; }
    setPayProcessing(true);
    setPayError('');
    try {
      await addPayment({
        sale_id: sale.id,
        payment_date: new Date().toISOString().split('T')[0],
        amount: amt,
        payment_method: payMethod,
        notes: payNotes,
        entered_by: 'IV',
      });
      const newBal = Math.max(0, bal - amt);
      setPaySuccess(newBal <= 0
        ? `✅ £${amt.toFixed(2)} recorded — PAID IN FULL!`
        : `✅ £${amt.toFixed(2)} recorded. Remaining: £${newBal.toFixed(2)}`);
      setPayAmount('');
      setPayNotes('');
      setPayMethod('cash');
      await reloadSale();
    } catch (err: any) {
      setPayError(`Failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setPayProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-4 text-center">
        <p className="text-error">Sale not found</p>
        <button className="btn btn-ghost mt-2" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  const paymentLabel = formatPaymentMethod(sale.payment_method);
  const amountPaid = sale.amount_paid ?? sale.total;
  const balanceDue = sale.balance_due ?? 0;
  const saleStatus = sale.status ?? 'paid';
  const saleTypeName = sale.sale_type === 'invoice' ? 'INVOICE' : 'RECEIPT';

  const saleDate = new Date(sale.sale_date + 'Z');
  const dateStr = saleDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeStr = saleDate.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Success banner */}
      <div className={`alert ${saleStatus === 'paid' ? 'alert-success' : saleStatus === 'partial' ? 'alert-warning' : saleStatus === 'refunded' ? 'alert-error' : 'alert-info'} mb-4`}>
        <CheckCircle size={20} />
        {saleStatus === 'paid' ? `Sale completed successfully! Invoice ${sale.invoice_number}` :
         saleStatus === 'partial' ? `Invoice ${sale.invoice_number} — Partial payment received. Balance due: £${balanceDue.toFixed(2)}` :
         saleStatus === 'unpaid' ? `Invoice ${sale.invoice_number} — Awaiting payment. Amount due: £${balanceDue.toFixed(2)}` :
         saleStatus === 'refunded' ? `Invoice ${sale.invoice_number} — Refunded` :
         `Invoice ${sale.invoice_number}`}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button className="btn btn-ghost gap-2" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Sales
        </button>
        {!pdfInfo && !generating && (
          <button className="btn btn-primary gap-2" onClick={handleGeneratePdf}>
            <FileDown size={18} /> Generate Invoice PDF
          </button>
        )}
        {generating && (
          <button className="btn btn-disabled gap-2">
            <Loader2 size={18} className="animate-spin" /> Generating PDF...
          </button>
        )}
        {pdfInfo && (
          <a
            href={pdfInfo.url}
            download={pdfInfo.filename}
            className="btn btn-primary gap-2"
          >
            <FileDown size={18} /> Download Invoice PDF
          </a>
        )}
      </div>

      {error && (
        <div className="alert alert-error mb-4">{error}</div>
      )}

      {/* Record Payment — shown when balance is outstanding */}
      {balanceDue > 0 && (
        <div className="mb-4 p-4 rounded-lg border-2 border-warning bg-base-100">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-3"><Banknote size={20} /> Record Payment — £{balanceDue.toFixed(2)} outstanding</h3>
          {paySuccess && <div className="alert alert-success mb-3 text-sm py-2">{paySuccess}</div>}
          {payError && <div className="alert alert-error mb-3 text-sm py-2">{payError}</div>}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label label-text text-xs">Amount</label>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">£</span>
                <input type="text" className="input input-bordered input-sm w-32"
                  value={payAmount || balanceDue.toFixed(2)}
                  onFocus={() => { if (!payAmount) setPayAmount(balanceDue.toFixed(2)); }}
                  onChange={e => setPayAmount(e.target.value)}
                />
                <span className="text-xs text-base-content/50">of £{balanceDue.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <label className="label label-text text-xs">Method</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['cash', 'sumup', 'bank_transfer', 'ebay'] as const).map(m => (
                  <button key={m}
                    className={`btn btn-xs ${payMethod === m ? (m === 'cash' ? 'btn-success' : m === 'sumup' ? 'btn-info' : m === 'bank_transfer' ? 'btn-secondary' : 'btn-warning') : 'btn-outline'}`}
                    onClick={() => setPayMethod(m)}>
                    {m === 'cash' ? '💵 Cash' : m === 'sumup' ? '💳 SumUp' : m === 'bank_transfer' ? '🏦 Bank' : '📦 eBay'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label label-text text-xs">Notes</label>
              <input type="text" className="input input-bordered input-sm w-40" placeholder="Optional"
                value={payNotes} onChange={e => setPayNotes(e.target.value)}
              />
            </div>
            <button className="btn btn-success btn-sm gap-1" onClick={handleRecordPayment} disabled={payProcessing}>
              {payProcessing ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
              Pay Now
            </button>
          </div>
        </div>
      )}

      {/* On-screen invoice preview */}
      <div className="bg-white text-black p-8 shadow-lg rounded-lg">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 pb-4 mb-4" style={{borderColor: '#5C3D2E'}}>
          <div>
            <h1 className="text-2xl font-bold" style={{color: '#5C3D2E'}}>Sylvia&apos;s Surprises</h1>
            <p className="text-sm" style={{color: '#888'}}>Antiques, Collectibles &amp; More</p>
            <p className="text-sm mt-1" style={{color: '#999'}}>
              Memorial Hall, Main Road<br />
              Union Mills, IM4 4AD<br />
              Tel: 07624 433076<br />
              gavin@sylviassurprises.im
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold" style={{color: '#5C3D2E'}}>{saleTypeName}</h2>
            <p className="text-sm font-mono mt-1">{sale.invoice_number}</p>
            <p className="text-sm mt-1" style={{color: '#888'}}>{dateStr}</p>
            <p className="text-sm" style={{color: '#888'}}>{timeStr}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-4 p-3 rounded" style={{backgroundColor: '#F5EDE3'}}>
          <span className="text-sm" style={{color: '#888'}}>Customer: </span>
          <span className="font-medium">{sale.customer_name}</span>
          {customer && (
            <div className="mt-1 text-sm" style={{color: '#555'}}>
              {customer.address_line1 && <div>{customer.address_line1}</div>}
              {customer.address_line2 && <div>{customer.address_line2}</div>}
              {customer.address_line3 && <div>{customer.address_line3}</div>}
              {customer.postcode && <div>{customer.postcode}</div>}
              {customer.phone && <div>Tel: {customer.phone}</div>}
              {customer.email && <div>{customer.email}</div>}
            </div>
          )}
        </div>

        {/* Items table */}
        <table className="w-full mb-4">
          <thead>
            <tr style={{borderBottom: '2px solid #5C3D2E'}}>
              <th className="text-left py-2 text-sm font-bold" style={{color: '#5C3D2E'}}>Part No</th>
              <th className="text-left py-2 text-sm font-bold" style={{color: '#5C3D2E'}}>Description</th>
              <th className="text-right py-2 text-sm font-bold" style={{color: '#5C3D2E'}}>Qty</th>
              <th className="text-right py-2 text-sm font-bold" style={{color: '#5C3D2E'}}>Unit Price</th>
              <th className="text-right py-2 text-sm font-bold" style={{color: '#5C3D2E'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                <td className="py-2 text-sm font-mono">{item.part_number}</td>
                <td className="py-2 text-sm">{item.description}</td>
                <td className="py-2 text-sm text-right">{item.qty}</td>
                <td className="py-2 text-sm text-right">£{item.unit_price.toFixed(2)}</td>
                <td className="py-2 text-sm text-right font-medium">£{item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="flex justify-end border-t-2 pt-3 mb-4" style={{borderColor: '#5C3D2E'}}>
          <div className="text-right">
            {(sale.discount || 0) > 0 ? (
              <div className="flex flex-col items-end gap-1">
                <div><span className="text-sm font-bold mr-6" style={{color: '#5C3D2E'}}>SUBTOTAL</span><span className="text-sm font-bold" style={{color: '#5C3D2E'}}>£{sale.total.toFixed(2)}</span></div>
                <div><span className="text-sm font-bold mr-6" style={{color: '#9333EA'}}>DISCOUNT</span><span className="text-sm font-bold" style={{color: '#9333EA'}}>-£{sale.discount.toFixed(2)}</span></div>
                <div><span className="text-lg font-bold mr-6" style={{color: '#5C3D2E'}}>TOTAL</span><span className="text-lg font-bold" style={{color: '#5C3D2E'}}>£{(sale.total - sale.discount).toFixed(2)}</span></div>
              </div>
            ) : (
              <>
                <span className="text-lg font-bold mr-6" style={{color: '#5C3D2E'}}>TOTAL</span>
                <span className="text-lg font-bold" style={{color: '#5C3D2E'}}>£{sale.total.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="rounded mb-2 overflow-hidden" style={{backgroundColor: '#F5EDE3'}}>
          <div className="flex justify-between p-3" style={{borderBottom: '1px solid #e8ddd0'}}>
            <span className="text-sm" style={{color: '#888'}}>Payment Method</span>
            <span className="font-bold">{paymentLabel}</span>
          </div>
          {sale.sale_type === 'invoice' && sale.due_date && (
            <div className="flex justify-between p-3" style={{borderBottom: '1px solid #e8ddd0'}}>
              <span className="text-sm" style={{color: '#888'}}>Due Date</span>
              <span className="font-bold">{new Date(sale.due_date + 'T00:00:00').toLocaleDateString('en-GB')}</span>
            </div>
          )}
          <div className="flex justify-between p-3" style={{borderBottom: '1px solid #e8ddd0'}}>
            <span className="text-sm" style={{color: '#888'}}>Amount Paid</span>
            <span className={`font-bold ${amountPaid > 0 ? 'text-success' : ''}`}>£{amountPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between p-3">
            <span className="text-sm font-semibold" style={{color: '#5C3D2E'}}>Balance Due</span>
            <span className="font-bold" style={{color: balanceDue > 0 ? '#e53e3e' : '#5C3D2E'}}>£{balanceDue.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="rounded mb-3 overflow-hidden" style={{backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0'}}>
            <div className="px-3 py-2" style={{backgroundColor: '#dcfce7', borderBottom: '1px solid #bbf7d0'}}>
              <span className="text-sm font-bold" style={{color: '#166534'}}>Payment History ({payments.length} payment{payments.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{tableLayout: 'fixed'}}>
                <colgroup>
                  <col style={{width: '6%'}} />
                  <col style={{width: '22%'}} />
                  <col style={{width: '20%'}} />
                  <col style={{width: '22%'}} />
                  <col style={{width: '30%'}} />
                </colgroup>
                <thead>
                  <tr style={{borderBottom: '1px solid #bbf7d0'}}>
                    <th className="text-left px-2 py-1 text-xs font-semibold" style={{color: '#166534'}}>#</th>
                    <th className="text-left px-2 py-1 text-xs font-semibold" style={{color: '#166534'}}>Date</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold" style={{color: '#166534'}}>Amount</th>
                    <th className="text-left px-2 py-1 text-xs font-semibold" style={{color: '#166534'}}>Method</th>
                    <th className="text-left px-2 py-1 text-xs font-semibold" style={{color: '#166534'}}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{borderBottom: '1px solid #dcfce7'}}>
                      <td className="px-2 py-1 text-xs" style={{color: '#555'}}>{i + 1}</td>
                      <td className="px-2 py-1 text-xs">{new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-GB')}</td>
                      <td className="px-2 py-1 text-xs text-right font-bold text-success">£{p.amount.toFixed(2)}</td>
                      <td className="px-2 py-1 text-xs">{formatPaymentMethod(p.payment_method)}</td>
                      <td className="px-2 py-1 text-xs truncate" style={{color: '#888', maxWidth: 0}} title={p.notes || ''}>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center my-2">
          {saleStatus === 'paid' || saleStatus === '' ? (
            <span className="badge badge-success badge-lg gap-1 font-bold">✓ PAID IN FULL</span>
          ) : saleStatus === 'partial' ? (
            <span className="badge badge-warning badge-lg gap-1 font-bold">⏳ PART PAID — £{balanceDue.toFixed(2)} OUTSTANDING</span>
          ) : saleStatus === 'unpaid' ? (
            <span className="badge badge-error badge-lg gap-1 font-bold">⏳ UNPAID — £{balanceDue.toFixed(2)} DUE</span>
          ) : saleStatus === 'refunded' ? (
            <span className="badge badge-error badge-lg gap-1 font-bold">↩ REFUNDED</span>
          ) : (
            <span className="badge badge-success badge-lg gap-1 font-bold">✓ PAID IN FULL</span>
          )}
        </div>

        {sale.notes && (
          <div className="flex justify-between p-3 rounded mb-2" style={{backgroundColor: '#F5EDE3'}}>
            <span className="text-sm" style={{color: '#888'}}>Notes</span>
            <span className="text-sm">{sale.notes}</span>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4 mt-6 text-center" style={{borderColor: '#ddd'}}>
          <p className="italic text-sm" style={{color: '#999'}}>Thank you for your custom!</p>
          <p className="text-xs mt-1" style={{color: '#999'}}>
            Sylvia&apos;s Surprises — Memorial Hall, Union Mills, Isle of Man
          </p>
          <p className="text-xs mt-1" style={{color: '#999'}}>Served by: {sale.sold_by}</p>
        </div>
      </div>
    </div>
  );
};
