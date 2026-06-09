import React, { useState, useEffect } from 'react';
import { CreditNote, Customer } from '../types';
import { getCustomerById, formatPaymentMethod } from '../utils/db';
import { FileDown, Printer, X, Loader2 } from 'lucide-react';

interface Props {
  creditNote: CreditNote;
  onClose: () => void;
}

async function generateCreditNotePdf(cn: CreditNote, customer: Customer | null): Promise<{ url: string; filename: string }> {
  const dateStr = new Date(cn.date_issued + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const safeCnNumber = cn.credit_note_number.replace(/'/g, "\\'");
  const safeCustomer = cn.customer_name.replace(/'/g, "\\'");
  const safeReason = cn.reason.replace(/'/g, "\\'");
  const safeOriginal = (cn.original_invoice || '').replace(/'/g, "\\'");
  const safeEnteredBy = cn.entered_by.replace(/'/g, "\\'");

  const custAddr: string[] = [];
  if (customer) {
    if (customer.address_line1) custAddr.push(customer.address_line1.replace(/'/g, "\\'"));
    if (customer.address_line2) custAddr.push(customer.address_line2.replace(/'/g, "\\'"));
    if (customer.address_line3) custAddr.push(customer.address_line3.replace(/'/g, "\\'"));
    if (customer.postcode) custAddr.push(customer.postcode.replace(/'/g, "\\'"));
    if (customer.phone) custAddr.push('Tel: ' + customer.phone.replace(/'/g, "\\'"));
    if (customer.email) custAddr.push(customer.email.replace(/'/g, "\\'"));
  }

  const filename = `credit-note-${cn.credit_note_number}.pdf`;
  const outputPath = `/tmp/${filename}`;

  const script = `
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

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

# CREDIT NOTE title
y = h - 125
c.setFont("Helvetica-Bold", 18)
c.setFillColor(colors.HexColor("#E53E3E"))
c.drawString(margin, y, "CREDIT NOTE")
c.setFont("Helvetica-Bold", 12)
c.setFillColor(colors.HexColor("#333333"))
c.drawRightString(w - margin, y, '${safeCnNumber}')

# Date
y -= 30
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin, y, "Date Issued")
y -= 15
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
c.drawString(margin, y, '${dateStr}')

# Original invoice ref
original = '${safeOriginal}'
if original:
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawString(margin + 250, y + 15, "Original Invoice")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#333333"))
    c.drawString(margin + 250, y, original)

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

# Reason box
y -= 35
c.setFillColor(colors.HexColor("#FFF5F5"))
c.setStrokeColor(colors.HexColor("#E53E3E"))
c.setLineWidth(0.5)
reason_box_h = 50
c.roundRect(margin - 5, y - reason_box_h + 20, w - 2 * margin + 10, reason_box_h, 5, fill=1, stroke=1)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Reason")
y -= 16
c.setFont("Helvetica", 10)
c.setFillColor(colors.HexColor("#333333"))
reason_text = '${safeReason}'
# Wrap reason if too long
if len(reason_text) > 70:
    c.drawString(margin + 5, y, reason_text[:70])
    y -= 13
    c.drawString(margin + 5, y, reason_text[70:140])
else:
    c.drawString(margin + 5, y, reason_text)

# Amount box
y -= 50
c.setFillColor(colors.HexColor("#F5EDE3"))
amount_box_h = 60
c.roundRect(margin - 5, y - amount_box_h + 30, w - 2 * margin + 10, amount_box_h, 5, fill=1, stroke=0)

c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y + 10, "Credit Amount")
c.setFont("Helvetica-Bold", 18)
c.setFillColor(colors.HexColor("#E53E3E"))
c.drawRightString(w - margin, y + 5, '\\u00a3${cn.amount.toFixed(2)}')

y -= 22
c.setStrokeColor(colors.HexColor("#E8DDD0"))
c.setLineWidth(0.5)
c.line(margin, y + 13, w - margin, y + 13)
c.setFont("Helvetica", 9)
c.setFillColor(colors.HexColor("#888888"))
c.drawString(margin + 5, y, "Status")
c.setFont("Helvetica-Bold", 10)
status = '${cn.status}'
if status == 'active':
    c.setFillColor(colors.HexColor("#2E7D32"))
    c.drawRightString(w - margin, y, "ACTIVE — Available for use")
elif status == 'used':
    c.setFillColor(colors.HexColor("#888888"))
    c.drawRightString(w - margin, y, "FULLY REDEEMED")
elif status == 'cancelled':
    c.setFillColor(colors.HexColor("#E53E3E"))
    c.drawRightString(w - margin, y, "CANCELLED")

# Footer
y -= 60
c.setStrokeColor(colors.HexColor("#DDD"))
c.setLineWidth(0.5)
c.line(margin, y + 10, w - margin, y + 10)
c.setFont("Helvetica-Oblique", 9)
c.setFillColor(colors.HexColor("#999999"))
c.drawCentredString(w / 2, y - 5, "This credit note may be redeemed against future purchases.")
c.setFont("Helvetica", 8)
c.drawCentredString(w / 2, y - 20, "Sylvia's Surprises - Memorial Hall, Union Mills, Isle of Man")
c.drawCentredString(w / 2, y - 33, f"Issued by: ${safeEnteredBy}")

c.save()
print("OK")
`;

  await window.tasklet.writeFileToDisk('/tmp/gen_credit_note.py', script);
  const result = await window.tasklet.runCommand('cd /tmp && uv run --with reportlab gen_credit_note.py', 120);

  if (!result.log.includes('OK')) {
    throw new Error('Failed to generate credit note PDF: ' + result.log);
  }

  const b64Result = await window.tasklet.runCommand(`base64 -w0 ${outputPath}`);
  const b64 = b64Result.log.trim();
  if (!b64 || b64Result.exitCode !== 0) {
    throw new Error('Failed to encode PDF');
  }
  return { url: `data:application/pdf;base64,${b64}`, filename };
}

export const CreditNotePrint: React.FC<Props> = ({ creditNote, onClose }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ url: string; filename: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const cn = creditNote;

  useEffect(() => {
    if (cn.customer_id) {
      getCustomerById(cn.customer_id).then(c => setCustomer(c));
    }
  }, [cn.customer_id]);

  const dateStr = new Date(cn.date_issued + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  async function handlePdf() {
    setGenerating(true);
    setError('');
    try {
      const result = await generateCreditNotePdf(cn, customer);
      setPdfInfo(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    const printArea = document.getElementById('credit-note-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;
    win.document.write(`<html><head><title>Credit Note ${cn.credit_note_number}</title><style>
      body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #333; }
      @media print { body { padding: 20px; } }
    </style></head><body>${printArea.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-error flex items-center gap-2">📄 Credit Note</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-4">
          <button className="btn btn-sm btn-outline gap-1" onClick={handlePrint}>
            <Printer size={14} /> Print
          </button>
          <button className="btn btn-sm btn-error gap-1" onClick={handlePdf} disabled={generating}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
          {pdfInfo && (
            <a href={pdfInfo.url} download={pdfInfo.filename} className="btn btn-sm btn-success gap-1">
              <FileDown size={14} /> Save {pdfInfo.filename}
            </a>
          )}
        </div>
        {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

        {/* On-screen credit note */}
        <div id="credit-note-print-area" style={{ background: '#FFFDF8', border: '1px solid #E8DDD0', borderRadius: '8px', padding: '32px', fontFamily: 'Helvetica, Arial, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#5C3D2E' }}>Sylvia's Surprises</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Antiques, Collectibles & More</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#999' }}>
              <div>Memorial Hall, Main Road</div>
              <div>Union Mills, IM4 4AD</div>
              <div>Tel: 07624 433076</div>
              <div>gavin@sylviassurprises.im</div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid #5C3D2E', margin: '12px 0' }} />

          {/* Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#E53E3E' }}>CREDIT NOTE</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{cn.credit_note_number}</div>
          </div>

          {/* Date + Original Invoice */}
          <div style={{ display: 'flex', gap: '60px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#888' }}>Date Issued</div>
              <div style={{ fontSize: '13px', color: '#333' }}>{dateStr}</div>
            </div>
            {cn.original_invoice && (
              <div>
                <div style={{ fontSize: '10px', color: '#888' }}>Original Invoice</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', color: '#333' }}>{cn.original_invoice}</div>
              </div>
            )}
          </div>

          {/* Customer */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', color: '#888' }}>Customer</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{cn.customer_name}</div>
            {customer && (
              <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.5' }}>
                {customer.address_line1 && <div>{customer.address_line1}</div>}
                {customer.address_line2 && <div>{customer.address_line2}</div>}
                {customer.address_line3 && <div>{customer.address_line3}</div>}
                {customer.postcode && <div>{customer.postcode}</div>}
                {customer.phone && <div>Tel: {customer.phone}</div>}
                {customer.email && <div>{customer.email}</div>}
              </div>
            )}
          </div>

          {/* Reason */}
          <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Reason</div>
            <div style={{ fontSize: '13px', color: '#333' }}>{cn.reason}</div>
          </div>

          {/* Amount */}
          <div style={{ background: '#F5EDE3', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>Credit Amount</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#E53E3E' }}>£{cn.amount.toFixed(2)}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #E8DDD0', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>Status</span>
              <span style={{ 
                fontSize: '12px', fontWeight: 'bold', 
                color: cn.status === 'active' ? '#2E7D32' : cn.status === 'cancelled' ? '#E53E3E' : '#888',
                background: cn.status === 'active' ? '#E8F5E9' : cn.status === 'cancelled' ? '#FFEBEE' : '#F5F5F5',
                padding: '3px 10px', borderRadius: '4px'
              }}>
                {cn.status === 'active' ? '✓ ACTIVE — Available for use' : cn.status === 'used' ? 'FULLY REDEEMED' : cn.status === 'cancelled' ? 'CANCELLED' : cn.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Footer */}
          <hr style={{ border: 'none', borderTop: '1px solid #DDD', margin: '16px 0' }} />
          <div style={{ textAlign: 'center', color: '#999', fontSize: '10px', lineHeight: '1.8' }}>
            <div style={{ fontStyle: 'italic', fontSize: '11px' }}>This credit note may be redeemed against future purchases.</div>
            <div>Sylvia's Surprises — Memorial Hall, Union Mills, Isle of Man</div>
            <div>Issued by: {cn.entered_by}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};
