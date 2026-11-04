#!/usr/bin/env python3
# Builds a 2-page PDF (page 1 invoice, page 2 packing slip) for an eBay order.
# Usage: python3 order_pdf.py out.pdf  < order.json
import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black

d = json.load(sys.stdin)
out = sys.argv[1]
W, H = A4
PURPLE = HexColor('#7c3aed'); GREY = HexColor('#555555'); LIGHT = HexColor('#f3f4f6'); GREEN = HexColor('#166534')
c = canvas.Canvas(out, pagesize=A4)
c.setTitle('Invoice ' + d.get('invoice_number', ''))

def money(v):
    try: return '£%.2f' % float(v or 0)
    except: return '£0.00'

def clip(s, n):
    s = str(s or '')
    return s if len(s) <= n else s[:n - 1] + '…'

def header(title):
    c.setFillColor(PURPLE); c.setFont('Helvetica-Bold', 22); c.drawString(40, H - 60, "Sylvia's Surprises")
    c.setFillColor(GREY); c.setFont('Helvetica', 9)
    c.drawString(40, H - 75, 'Antiques, Collectibles & More')
    c.drawString(40, H - 87, 'Memorial Hall, Main Road, Union Mills, IM4 4AD')
    c.drawString(40, H - 99, '07624 433076 · gavin@sylviassurprises.im')
    c.setFillColor(black); c.setFont('Helvetica-Bold', 20); c.drawRightString(W - 40, H - 60, title)
    c.setFont('Helvetica', 10)
    c.drawRightString(W - 40, H - 76, 'No. ' + str(d.get('invoice_number', '')))
    c.drawRightString(W - 40, H - 89, 'Date ' + str(d.get('date', '')))
    c.drawRightString(W - 40, H - 102, 'eBay order ' + str(d.get('order_id', '')))
    c.setStrokeColor(PURPLE); c.setLineWidth(2.5); c.line(40, H - 112, W - 40, H - 112)

def address(x, y, size=11):
    c.setFillColor(GREY); c.setFont('Helvetica', 8); c.drawString(x, y, 'DELIVER TO')
    c.setFillColor(black); c.setFont('Helvetica-Bold', size); y -= size + 4
    c.drawString(x, y, clip(d.get('ship_name', ''), 50))
    c.setFont('Helvetica', size)
    for line in str(d.get('ship_address', '')).split('\n'):
        if line.strip(): y -= size + 3; c.drawString(x, y, clip(line, 55))
    if d.get('ship_phone'):
        y -= size + 3; c.setFont('Helvetica', 9); c.setFillColor(GREY); c.drawString(x, y, 'Tel ' + d['ship_phone']); c.setFillColor(black)
    return y

items = d.get('items', [])

# ── Page 1: invoice ──
header('INVOICE')
c.setFillColor(HexColor('#dcfce7')); c.roundRect(W - 140, H - 140, 100, 18, 8, fill=1, stroke=0)
c.setFillColor(GREEN); c.setFont('Helvetica-Bold', 9); c.drawCentredString(W - 90, H - 134, 'PAID via eBay')
y = address(40, H - 140)
c.setFillColor(GREY); c.setFont('Helvetica', 8); c.drawString(330, H - 160, 'EBAY BUYER')
c.setFillColor(black); c.setFont('Helvetica', 11); c.drawString(330, H - 175, clip(d.get('buyer_username', ''), 30))
y = min(y, H - 180) - 30
cols = [(40, 'Part no.'), (120, 'Item')]
c.setFillColor(LIGHT); c.rect(40, y - 5, W - 80, 18, fill=1, stroke=0); c.setFillColor(black); c.setFont('Helvetica-Bold', 9)
for x, t in cols: c.drawString(x + 4, y, t)
c.drawRightString(390, y, 'Qty'); c.drawRightString(470, y, 'Price'); c.drawRightString(W - 44, y, 'Total')
c.setFont('Helvetica', 9)
for it in items:
    y -= 20
    if y < 160: c.showPage(); header('INVOICE'); y = H - 150; c.setFont('Helvetica', 9)
    c.drawString(44, y, clip(it.get('part_number', ''), 14)); c.drawString(124, y, clip(it.get('title', ''), 48))
    c.drawRightString(390, y, str(it.get('quantity', 1))); c.drawRightString(470, y, money(it.get('unit'))); c.drawRightString(W - 44, y, money(it.get('total')))
    c.setStrokeColor(HexColor('#dddddd')); c.setLineWidth(0.5); c.line(40, y - 6, W - 40, y - 6)
total = float(d.get('total') or 0); post = float(d.get('postage') or 0)
y -= 30
rows = [('Items', money(total), black), ('Postage', money(post), black), ('Paid by buyer', money(total + post), black), ('Amount paid', money(total + post), GREEN), ('Balance due', '£0.00', black)]
for i, (l, v, col) in enumerate(rows):
    c.setFillColor(col); c.setFont('Helvetica-Bold' if i == 2 else 'Helvetica', 10)
    c.drawString(340, y, l); c.drawRightString(W - 44, y, v); y -= 16
c.setFillColor(GREY); c.setFont('Helvetica', 8)
c.drawCentredString(W / 2, 40, "Sylvia's Surprises - Memorial Hall, Union Mills, Isle of Man")
c.showPage()

# ── Page 2: packing slip ──
header('PACKING SLIP')
y = address(40, H - 145, 13) - 35
c.setFillColor(LIGHT); c.rect(40, y - 5, W - 80, 18, fill=1, stroke=0); c.setFillColor(black); c.setFont('Helvetica-Bold', 9)
c.drawString(44, y, 'Packed'); c.drawString(100, y, 'Part no.'); c.drawString(180, y, 'Item'); c.drawRightString(W - 44, y, 'Qty')
c.setFont('Helvetica', 10)
for it in items:
    y -= 24
    if y < 150: c.showPage(); header('PACKING SLIP'); y = H - 150; c.setFont('Helvetica', 10)
    c.setStrokeColor(black); c.setLineWidth(1.2); c.rect(52, y - 3, 12, 12, fill=0, stroke=1)
    c.drawString(100, y, clip(it.get('part_number', ''), 14)); c.drawString(180, y, clip(it.get('title', ''), 55)); c.drawRightString(W - 44, y, str(it.get('quantity', 1)))
y -= 50
c.setFont('Helvetica', 11); c.drawString(40, y, 'Packed by: ____________________      Date: ____________')
y -= 40
c.setFillColor(GREY); c.setFont('Helvetica', 10)
c.drawString(40, y, "Thank you for buying from Sylvia's Surprises! If anything is wrong, please message us")
c.drawString(40, y - 14, 'through eBay before leaving feedback.')
c.showPage()
c.save()
