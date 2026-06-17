import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewMode, StockItem, StaffUser } from './types';
import { initDB } from './utils/db';
const LOGO_SRC = 'data:image/jpeg;base64,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';
import Storefront from './components/Storefront';
import { Login } from './components/Login';
import { StockEntry } from './components/StockEntry';
import { StockControl } from './components/StockControl';
import { SellSystem } from './components/SellSystem';
import { InvoiceView } from './components/InvoiceView';
import { CustomerDatabase } from './components/CustomerDatabase';
import { SalesLedger } from './components/SalesLedger';
import { Expenses } from './components/Expenses';
import { AccountantReport } from './components/AccountantReport';
import { FloatTracker } from './components/FloatTracker';
import { Consignment } from './components/Consignment';
import { Reservations } from './components/Reservations';
import { WishList } from './components/WishList';
import { SupplierLog } from './components/SupplierLog';
import { PriceLabels } from './components/PriceLabels';
import { ProfitDashboard } from './components/ProfitDashboard';
import { Bullion } from './components/Bullion';
import { Admin } from './components/Admin';
import { Outstanding } from './components/Outstanding';
import { SupplierInvoices } from './components/SupplierInvoices';
import { RefundsView } from './components/Refunds';
import { CreditNotesView } from './components/CreditNotes';
import { BankReconciliation } from './components/BankReconciliation';
import { CashUp } from './components/CashUp';
import { PnlReport } from './components/PnlReport';
import { PurchaseStock } from './components/PurchaseStock';
import { TakingsReport } from './components/TakingsReport';
import { CustomerLoyalty } from './components/CustomerLoyalty';
import { EventTracker } from './components/EventTracker';
import { QuickQuotes } from './components/QuickQuotes';
import { InsuranceRegister } from './components/InsuranceRegister';
import { GiftVouchers } from './components/GiftVouchers';
import { QuickStockEntry } from './components/QuickStockEntry';
import { ScanReview } from './components/ScanReview';
import { EbayExport } from './components/EbayExport';
import { StockCheck } from './components/StockCheck';
import {
  Package, PlusCircle, LogOut, Store, ShoppingCart, Receipt, Users, BookOpen, Wallet,
  BarChart3, Banknote, Handshake, Bookmark, Heart, Truck, Tag, TrendingUp, ChevronDown,
  ChevronRight, Star, Menu, X, Coins, Settings, Clock, RotateCcw, FileText, Building2, Calculator, ShoppingBag, DollarSign,
  Award, CalendarDays, FileCheck, Shield, Gift, ArrowUp, ArrowDown, Pencil, Minus, Plus, Type, Zap, ScanLine, ClipboardCheck, GripVertical,
} from 'lucide-react';
import { getSetting, setSetting } from './utils/db';

/* ── nav item type ── */
interface NavItem {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Stock',
    items: [
      { id: 'stock-control', label: 'Stock Control', icon: <Package size={18} /> },
      { id: 'stock-entry', label: 'New Item', icon: <PlusCircle size={18} /> },
      { id: 'quick-stock-entry', label: 'Quick Entry', icon: <Zap size={18} /> },
      { id: 'scan-review', label: 'Scan Review', icon: <ScanLine size={18} /> },
      { id: 'purchase-stock', label: 'Purchase Stock', icon: <ShoppingBag size={18} /> },
      { id: 'price-labels', label: 'Price Labels', icon: <Tag size={18} /> },
      { id: 'stock-check', label: 'Stock Check', icon: <ClipboardCheck size={18} /> },
    ],
  },
  {
    title: 'Sales',
    items: [
      { id: 'sell', label: 'Sell', icon: <ShoppingCart size={18} /> },
      { id: 'sales-ledger', label: 'Sales Ledger', icon: <BookOpen size={18} /> },
      { id: 'outstanding', label: 'Outstanding Invoices', icon: <Clock size={18} /> },
      { id: 'refunds', label: 'Refunds & Returns', icon: <RotateCcw size={18} /> },
      { id: 'credit-notes', label: 'Credit Notes', icon: <FileText size={18} /> },
      { id: 'quick-quotes', label: 'Quick Quotes', icon: <FileCheck size={18} /> },
      { id: 'gift-vouchers', label: 'Gift Vouchers', icon: <Gift size={18} /> },
      { id: 'expenses', label: 'Expenses', icon: <Wallet size={18} /> },
      { id: 'cashup', label: 'End of Day Cash-Up', icon: <Calculator size={18} /> },
      { id: 'takings-report', label: 'Takings Report', icon: <DollarSign size={18} /> },
      { id: 'float-tracker', label: 'Float Tracker', icon: <Banknote size={18} /> },
    ],
  },
  {
    title: 'Customers',
    items: [
      { id: 'customers', label: 'Customer Database', icon: <Users size={18} /> },
      { id: 'reservations', label: 'Reservations', icon: <Bookmark size={18} /> },
      { id: 'wish-list', label: 'Wish List', icon: <Heart size={18} /> },
      { id: 'customer-loyalty', label: 'Loyalty Tracker', icon: <Award size={18} /> },
    ],
  },
  {
    title: 'Management',
    items: [
      { id: 'consignment', label: 'Consignment', icon: <Handshake size={18} /> },
      { id: 'supplier-log', label: 'Suppliers', icon: <Truck size={18} /> },
      { id: 'supplier-invoices', label: 'Supplier Invoices', icon: <FileText size={18} /> },
      { id: 'bullion', label: 'Bullion', icon: <Coins size={18} /> },
      { id: 'profit-dashboard', label: 'Profit Dashboard', icon: <TrendingUp size={18} /> },
      { id: 'pnl-report', label: 'Profit & Loss', icon: <BarChart3 size={16} /> },
      { id: 'bank-reconciliation', label: 'Bank Reconciliation', icon: <Building2 size={16} /> },
      { id: 'accountant-report', label: 'Accountant Report', icon: <BarChart3 size={16} /> },
      { id: 'event-tracker', label: 'Event Tracker', icon: <CalendarDays size={18} /> },
      { id: 'insurance-register', label: 'Insurance Register', icon: <Shield size={18} /> },
      { id: 'ebay-export', label: 'eBay Export', icon: <ShoppingBag size={18} /> },
      { id: 'admin', label: 'Admin & Settings', icon: <Settings size={18} /> },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

/* ── favourites persistence (DB-backed, survives rebuilds) ── */
async function loadFavouritesFromDB(): Promise<ViewMode[]> {
  try {
    const raw = await getSetting('user_favourites');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function saveFavouritesToDB(favs: ViewMode[]) {
  await setSetting('user_favourites', JSON.stringify(favs));
}

/* ── sidebar order persistence (DB-backed) ── */
async function loadSidebarOrderFromDB(): Promise<Record<string, string[]> | null> {
  try {
    const raw = await getSetting('sidebar_order');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function saveSidebarOrderToDB(order: Record<string, string[]>) {
  await setSetting('sidebar_order', JSON.stringify(order));
}

export default function App() {
  const [view, setViewRaw] = useState<ViewMode>('storefront');
  const mainRef = React.useRef<HTMLElement>(null);
  const setView = React.useCallback((v: ViewMode) => {
    setViewRaw(v);
    // Scroll to top on every view change
    setTimeout(() => {
      window.scrollTo(0, 0);
      mainRef.current?.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);
  }, []);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [saleToast, setSaleToast] = useState<string | null>(null);
  const [sellResetKey, setSellResetKey] = useState(0);

  // Dashboard drag state
  const [dashTileOrder, setDashTileOrder] = useState<string[] | null>(null);
  const [dragTile, setDragTile] = useState<string | null>(null);
  const [dragOverTile, setDragOverTile] = useState<string | null>(null);
  const [dashEditMode, setDashEditMode] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Stock: true, Sales: true, Customers: true, Management: true,
  });
  const [favourites, setFavourites] = useState<ViewMode[]>([]);
  const [sidebarOrder, setSidebarOrder] = useState<Record<string, string[]> | null>(null);
  const [editMode, setEditMode] = useState(false);
  const ZOOM_LEVELS = [
    { label: 'S', value: 0.85 },
    { label: 'M', value: 0.95 },
    { label: 'L', value: 1.05 },
    { label: 'XL', value: 1.15 },
  ];
  const [uiZoom, setUiZoom] = useState(0.95);

  useEffect(() => {
    initDB().then(async () => {
      const favs = await loadFavouritesFromDB();
      setFavourites(favs);
      const order = await loadSidebarOrderFromDB();
      setSidebarOrder(order);
      const zoom = await getSetting('ui_zoom');
      if (zoom) setUiZoom(parseFloat(zoom));
      const tileOrder = await getSetting('dashboard_tile_order');
      if (tileOrder) { try { setDashTileOrder(JSON.parse(tileOrder)); } catch {} }
      setLoading(false);
    });
  }, []);

  async function handleZoomChange(level: number) {
    setUiZoom(level);
    await setSetting('ui_zoom', String(level));
  }

  function handleLogin(user: StaffUser) {
    // Clear any session-expired banner from bridge
    const banner = document.getElementById('session-expired-banner');
    if (banner) banner.remove();
    setCurrentUser(user);
    setView('dashboard');
  }

  function handleLogout() {
    // Destroy server-side session
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setCurrentUser(null);
    setView('storefront');
  }

  function handleEdit(item: StockItem) {
    setEditItem(item);
    setView('stock-entry');
  }

  function handleAddNew() {
    setEditItem(null);
    setView('stock-entry');
  }

  function handleSaved() {
    setEditItem(null);
    setView('stock-control');
  }

  function handleSaleComplete(saleId: number, printInvoice: boolean, invoiceNumber?: string) {
    setLastSaleId(saleId);
    if (printInvoice) {
      setView('invoice-view');
    } else {
      // No receipt — show success toast and stay on sell screen
      const label = invoiceNumber ? invoiceNumber : `#${saleId}`;
      setSaleToast(`✅ Sale ${label} recorded — no receipt`);
      setSellResetKey(k => k + 1);
      setView('sell');
      setTimeout(() => setSaleToast(null), 4000);
    }
  }

  function toggleGroup(title: string) {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  }

  function toggleFavourite(id: ViewMode) {
    setFavourites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      saveFavouritesToDB(next);
      return next;
    });
  }

  function moveFavourite(id: ViewMode, direction: 'up' | 'down') {
    setFavourites(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      saveFavouritesToDB(next);
      return next;
    });
  }

  function moveGroupItem(groupTitle: string, itemId: string, direction: 'up' | 'down') {
    const group = NAV_GROUPS.find(g => g.title === groupTitle);
    if (!group) return;
    const currentOrder = sidebarOrder?.[groupTitle] || group.items.map(i => i.id);
    const idx = currentOrder.indexOf(itemId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    const newOrder = { ...(sidebarOrder || {}), [groupTitle]: next };
    setSidebarOrder(newOrder);
    saveSidebarOrderToDB(newOrder);
  }

  function getOrderedGroupItems(group: NavGroup): NavItem[] {
    const order = sidebarOrder?.[group.title];
    if (!order) return group.items;
    const itemMap = new Map(group.items.map(i => [i.id, i]));
    const ordered: NavItem[] = [];
    for (const id of order) {
      const item = itemMap.get(id as ViewMode);
      if (item) ordered.push(item);
    }
    // Add any items not in the saved order (new items added later)
    for (const item of group.items) {
      if (!ordered.find(o => o.id === item.id)) ordered.push(item);
    }
    return ordered;
  }

  function navTo(id: ViewMode) {
    if (id === 'stock-entry' || id === 'purchase-stock') {
      setEditItem(null);
    }
    setView(id);
  }

  /* ── Dashboard tile definitions (must be before any early returns for hook rules) ── */
  const DASH_TILES = [
    { id: 'stock-control' as ViewMode, label: 'Stock Control', desc: 'View & manage inventory', icon: <Package size={36} />, color: 'from-blue-500 to-blue-700' },
    { id: 'stock-entry' as ViewMode, label: 'Add New Item', desc: 'Enter new stock', icon: <PlusCircle size={36} />, color: 'from-emerald-500 to-emerald-700' },
    { id: 'quick-stock-entry' as ViewMode, label: 'Quick Entry', desc: 'Bulk spreadsheet entry', icon: <Zap size={36} />, color: 'from-teal-500 to-teal-700' },
    { id: 'scan-review' as ViewMode, label: 'Scan Review', desc: 'Check scanned items', icon: <ScanLine size={36} />, color: 'from-orange-500 to-orange-600' },
    { id: 'sell' as ViewMode, label: 'Sell', desc: 'Point of sale', icon: <ShoppingCart size={36} />, color: 'from-amber-500 to-amber-700' },
    { id: 'cashup' as ViewMode, label: 'End of Day', desc: 'Cash-up & close', icon: <Calculator size={36} />, color: 'from-purple-500 to-purple-700' },
    { id: 'bullion' as ViewMode, label: 'Bullion', desc: 'Gold & silver tracker', icon: <Coins size={36} />, color: 'from-yellow-500 to-yellow-700' },
    { id: 'sales-ledger' as ViewMode, label: 'Sales Ledger', desc: 'All transactions', icon: <BookOpen size={36} />, color: 'from-rose-500 to-rose-700' },
    { id: 'customers' as ViewMode, label: 'Customers', desc: 'Customer database', icon: <Users size={36} />, color: 'from-cyan-500 to-cyan-700' },
    { id: 'expenses' as ViewMode, label: 'Expenses', desc: 'Track costs', icon: <Wallet size={36} />, color: 'from-orange-500 to-orange-700' },
    { id: 'consignment' as ViewMode, label: 'Consignment', desc: 'Consigned items', icon: <Handshake size={36} />, color: 'from-teal-500 to-teal-700' },
    { id: 'profit-dashboard' as ViewMode, label: 'Profit Dashboard', desc: 'Performance overview', icon: <TrendingUp size={36} />, color: 'from-indigo-500 to-indigo-700' },
    { id: 'gift-vouchers' as ViewMode, label: 'Gift Vouchers', desc: 'Issue & manage', icon: <Gift size={36} />, color: 'from-pink-500 to-pink-700' },
    { id: 'stock-check' as ViewMode, label: 'Stock Check', desc: 'Verify inventory', icon: <ClipboardCheck size={36} />, color: 'from-lime-500 to-lime-700' },
    { id: 'ebay-export' as ViewMode, label: 'eBay Export', desc: 'List items on eBay', icon: <ShoppingBag size={36} />, color: 'from-blue-500 to-blue-700' },
    { id: 'admin' as ViewMode, label: 'Settings', desc: 'Admin & config', icon: <Settings size={36} />, color: 'from-slate-500 to-slate-700' },
  ];

  const orderedTiles = React.useMemo(() => {
    if (!dashTileOrder) return DASH_TILES;
    const tileMap = new Map(DASH_TILES.map(t => [t.id, t]));
    const ordered: typeof DASH_TILES = [];
    for (const id of dashTileOrder) {
      const t = tileMap.get(id as ViewMode);
      if (t) { ordered.push(t); tileMap.delete(id as ViewMode); }
    }
    for (const t of tileMap.values()) ordered.push(t);
    return ordered;
  }, [dashTileOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-3 text-base-content/60">Loading Sylvia's Surprises...</p>
        </div>
      </div>
    );
  }

  // Pre-login landing page
  if (view === 'storefront') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-base-200 to-base-300 p-6">
        <div className="card bg-base-100 shadow-xl p-8 max-w-md w-full text-center">
          <img
            src={LOGO_SRC}
            alt="Sylvia's Surprises"
            className="w-40 h-40 rounded-full mx-auto mb-4 object-cover border-4 border-primary/30 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-primary mb-1">Sylvia's Surprises</h1>
          <p className="text-base-content/50 text-sm mb-6">Antiques, Collectibles & More</p>
          <button
            className="btn btn-primary btn-lg w-full mb-3 gap-2"
            onClick={() => setView('login')}
          >
            <Store size={20} /> Enter Staff Area
          </button>
        </div>
        <p className="text-base-content/20 text-xs mt-6">Memorial Hall, Main Road, Union Mills, IM4 4AD</p>
      </div>
    );
  }

  /* ── Post-login Dashboard ── */
  function handleDashDragStart(id: string) {
    setDragTile(id);
  }
  function handleDashDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverTile(id);
  }
  function handleDashDrop(targetId: string) {
    if (!dragTile || dragTile === targetId) { setDragTile(null); setDragOverTile(null); return; }
    const currentOrder = orderedTiles.map(t => t.id);
    const fromIdx = currentOrder.indexOf(dragTile as ViewMode);
    const toIdx = currentOrder.indexOf(targetId as ViewMode);
    if (fromIdx === -1 || toIdx === -1) { setDragTile(null); setDragOverTile(null); return; }
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragTile as ViewMode);
    setDashTileOrder(newOrder);
    setSetting('dashboard_tile_order', JSON.stringify(newOrder));
    setDragTile(null);
    setDragOverTile(null);
  }

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200">
        {/* Header */}
        <div className="text-center pt-8 pb-6 px-4">
          <img
            src={LOGO_SRC}
            alt="Sylvia's Surprises"
            className="w-24 h-24 rounded-full mx-auto mb-3 object-cover border-4 border-primary/20 shadow-lg"
          />
          <h1 className="text-3xl font-bold text-primary tracking-tight">Sylvia's Surprises</h1>
          <p className="text-base-content/40 text-sm mt-1">
            Welcome back, <span className="font-semibold text-base-content/70">{currentUser.name}</span>
          </p>
        </div>

        {/* Edit mode toggle */}
        <div className="max-w-4xl mx-auto px-4 mb-2 flex justify-end">
          <button
            className={`btn btn-sm gap-1 ${dashEditMode ? 'btn-warning' : 'btn-ghost'}`}
            onClick={() => setDashEditMode(!dashEditMode)}
          >
            <GripVertical size={14} /> {dashEditMode ? '✓ Done Arranging' : 'Arrange Tiles'}
          </button>
        </div>

        {/* Tile grid */}
        <div className="max-w-4xl mx-auto px-4 pb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {orderedTiles.map(tile => (
              <button
                key={tile.id}
                draggable={dashEditMode}
                onDragStart={() => handleDashDragStart(tile.id)}
                onDragOver={(e) => handleDashDragOver(e, tile.id)}
                onDragEnd={() => { setDragTile(null); setDragOverTile(null); }}
                onDrop={() => handleDashDrop(tile.id)}
                onClick={() => { if (!dashEditMode) { if (tile.id === 'stock-entry') setEditItem(null); setView(tile.id); } }}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.color} text-white shadow-lg
                  ${dashEditMode ? 'cursor-grab active:cursor-grabbing' : 'hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98]'}
                  transition-all duration-200 ease-out
                  flex flex-col items-center justify-center text-center p-6 min-h-[140px]
                  ${dragOverTile === tile.id && dragTile !== tile.id ? 'ring-4 ring-white/60 scale-[1.05]' : ''}
                  ${dragTile === tile.id ? 'opacity-40' : ''}`}
              >
                {dashEditMode && (
                  <div className="absolute top-2 right-2 z-20">
                    <GripVertical size={18} className="text-white/60" />
                  </div>
                )}
                {/* Subtle glow */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-200 rounded-2xl" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    {tile.icon}
                  </div>
                  <span className="font-bold text-base leading-tight">{tile.label}</span>
                  <span className="text-white/70 text-xs">{tile.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <button
            className="btn btn-ghost btn-sm text-error gap-1"
            onClick={handleLogout}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
    );
  }

  // Login screen
  if (view === 'login' || !currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        onBack={() => setView('storefront')}
      />
    );
  }

  // Favourite items
  const favItems = favourites.map(fId => ALL_NAV_ITEMS.find(n => n.id === fId)).filter(Boolean) as NavItem[];

  /* ── Sidebar nav item renderer ── */
  function renderNavItem(item: NavItem, showStar: boolean = true) {
    const isActive = view === item.id || (item.id === 'stock-entry' && view === 'stock-entry');
    const isFav = favourites.includes(item.id);

    return (
      <div
        key={item.id}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-base transition-all
          ${isActive ? 'bg-primary text-primary-content font-semibold' : 'hover:bg-base-200 text-base-content'}`}
        onClick={() => navTo(item.id)}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {sidebarOpen && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {showStar && (
              <button
                className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? '!opacity-100' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleFavourite(item.id); }}
                title={isFav ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Star
                  size={14}
                  className={isFav
                    ? (isActive ? 'fill-primary-content text-primary-content' : 'fill-warning text-warning')
                    : (isActive ? 'text-primary-content/50' : 'text-base-content/30')
                  }
                />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Staff area with sidebar
  return (
    <div className="min-h-screen bg-base-100 flex" style={{ zoom: uiZoom }}>
      {/* ── LEFT SIDEBAR ── */}
      <aside
        className={`flex flex-col bg-base-200 border-r border-base-300 transition-all duration-200 flex-shrink-0
          ${sidebarOpen ? 'w-64' : 'w-16'}`}
        style={{ minHeight: '100vh' }}
      >
        {/* Header */}
        <div className="border-b border-base-300">
          {sidebarOpen ? (
            <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
              <button
                className="absolute top-2 right-2 z-10 btn btn-sm btn-circle bg-base-200 hover:bg-error hover:text-white border border-base-300 shadow"
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
              >
                <X size={16} />
              </button>
              <div
                className="flex flex-col items-center pt-5 pb-4 cursor-pointer group"
                onClick={() => setView('dashboard')}
                title="Back to Dashboard"
              >
                <div className="w-16 h-16 rounded-full bg-white ring-2 ring-primary/40 shadow-lg overflow-hidden mb-2 group-hover:ring-4 group-hover:ring-primary group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                  <img
                    src={LOGO_SRC}
                    alt="Sylvia's Surprises"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-primary text-white font-bold text-xl">SS</div>';
                    }}
                  />
                </div>
                <span className="font-bold text-base text-primary tracking-tight group-hover:underline group-hover:text-primary-focus transition-colors">Sylvia's Surprises</span>
                <span className="text-xs text-base-content/50 mt-0.5">Antiques, Collectibles & More</span>
              </div>
            </div>
          ) : (
            <div className="p-2 flex flex-col items-center">
              <button
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Nav content */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {/* Edit mode toggle */}
          {sidebarOpen && (
            <div className="flex justify-end px-2 mb-1">
              <button
                className={`btn btn-xs btn-ghost gap-1 ${editMode ? 'text-primary' : 'text-base-content/30'}`}
                onClick={() => setEditMode(!editMode)}
                title={editMode ? 'Done editing' : 'Reorder items'}
              >
                <Pencil size={14} />
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>
          )}

          {/* Favourites section */}
          {favItems.length > 0 && (
            <div className="mb-2">
              {sidebarOpen && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Star size={14} className="fill-warning text-warning" />
                  <span className="text-sm font-semibold text-warning uppercase tracking-wide">Favourites</span>
                </div>
              )}
              {favItems.map((item, idx) => (
                <div key={item.id} className="flex items-center">
                  <div className="flex-1">{renderNavItem(item, false)}</div>
                  {editMode && sidebarOpen && (
                    <div className="flex flex-col mr-1">
                      <button
                        className="btn btn-ghost btn-xs p-0 h-5 min-h-0"
                        onClick={() => moveFavourite(item.id, 'up')}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <ArrowUp size={12} className={idx === 0 ? 'text-base-content/20' : 'text-primary'} />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs p-0 h-5 min-h-0"
                        onClick={() => moveFavourite(item.id, 'down')}
                        disabled={idx === favItems.length - 1}
                        title="Move down"
                      >
                        <ArrowDown size={12} className={idx === favItems.length - 1 ? 'text-base-content/20' : 'text-primary'} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="border-b border-base-300 mx-2 mt-2" />
            </div>
          )}

          {/* Grouped navigation */}
          {NAV_GROUPS.map(group => {
            const orderedItems = getOrderedGroupItems(group);
            return (
              <div key={group.title} className="mb-1">
                {sidebarOpen ? (
                  <button
                    className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm font-semibold text-base-content/50 uppercase tracking-wide hover:text-base-content transition-colors"
                    onClick={() => toggleGroup(group.title)}
                  >
                    {expandedGroups[group.title]
                      ? <ChevronDown size={14} />
                      : <ChevronRight size={14} />
                    }
                    {group.title}
                  </button>
                ) : (
                  <div className="border-b border-base-300 mx-1 my-1" />
                )}
                {(expandedGroups[group.title] || !sidebarOpen) && (
                  <div className="space-y-0.5">
                    {orderedItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center">
                        <div className="flex-1">{renderNavItem(item)}</div>
                        {editMode && sidebarOpen && (
                          <div className="flex flex-col mr-1">
                            <button
                              className="btn btn-ghost btn-xs p-0 h-5 min-h-0"
                              onClick={() => moveGroupItem(group.title, item.id, 'up')}
                              disabled={idx === 0}
                              title="Move up"
                            >
                              <ArrowUp size={12} className={idx === 0 ? 'text-base-content/20' : 'text-primary'} />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs p-0 h-5 min-h-0"
                              onClick={() => moveGroupItem(group.title, item.id, 'down')}
                              disabled={idx === orderedItems.length - 1}
                              title="Move down"
                            >
                              <ArrowDown size={12} className={idx === orderedItems.length - 1 ? 'text-base-content/20' : 'text-primary'} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: user info */}
        <div className={`border-t border-base-300 p-3 ${sidebarOpen ? '' : 'flex flex-col items-center'}`}>
          {/* Zoom control */}
          {sidebarOpen && (
            <div className="flex items-center gap-1 mb-2 justify-center">
              <Type size={14} className="text-base-content/50 mr-1" />
              {ZOOM_LEVELS.map(z => (
                <button
                  key={z.label}
                  className={`btn btn-xs ${uiZoom === z.value ? 'btn-primary' : 'btn-ghost'} min-w-[2rem]`}
                  onClick={() => handleZoomChange(z.value)}
                  title={`${z.label} text size`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          )}
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="badge badge-primary flex-1 truncate">
                {currentUser.name} ({currentUser.initials})
              </div>
              <button
                className="btn btn-ghost btn-sm btn-square tooltip tooltip-right"
                data-tip="Dashboard"
                onClick={() => setView('dashboard')}
              >
                <Store size={18} />
              </button>
              <button
                className="btn btn-ghost btn-sm btn-square text-error tooltip tooltip-right"
                data-tip="Log out"
                onClick={handleLogout}
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <>
              <button
                className="btn btn-ghost btn-sm btn-square mb-1 tooltip tooltip-right"
                data-tip="Dashboard"
                onClick={() => setView('dashboard')}
              >
                <Store size={18} />
              </button>
              <button
                className="btn btn-ghost btn-sm btn-square text-error tooltip tooltip-right"
                data-tip="Log out"
                onClick={handleLogout}
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto" style={{ minHeight: '100vh' }}>
        {/* Back to Dashboard bar */}
        <div className="sticky top-0 z-30 bg-base-100/90 backdrop-blur border-b border-base-200 px-5 py-3 flex items-center gap-3">
          <button
            className="btn btn-sm btn-ghost gap-1 text-primary hover:bg-primary/10 text-base"
            onClick={() => setView('dashboard')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </button>
          <span className="text-base font-semibold text-base-content/70">
            {ALL_NAV_ITEMS.find(n => n.id === view)?.label || ''}
          </span>
        </div>
        {saleToast && (
          <div className="mx-5 mt-3 p-3 bg-success/15 border border-success/30 rounded-lg text-success font-semibold text-center animate-pulse">
            {saleToast}
          </div>
        )}
        {view === 'stock-entry' ? (
          <StockEntry
            currentUser={currentUser}
            editItem={editItem}
            onSaved={handleSaved}
            onCancel={() => { setEditItem(null); setView('stock-control'); }}
            onNavigate={(v) => setView(v as ViewMode)}
          />
        ) : view === 'quick-stock-entry' ? (
          <QuickStockEntry currentUser={currentUser} onNavigate={(v) => setView(v as ViewMode)} />
        ) : view === 'scan-review' ? (
          <ScanReview currentUser={currentUser} />
        ) : view === 'purchase-stock' ? (
          <PurchaseStock
            currentUser={currentUser}
            onSaved={() => setView('stock-control')}
            onCancel={() => setView('stock-control')}
          />
        ) : view === 'customers' ? (
          <CustomerDatabase currentUser={currentUser} />
        ) : view === 'sell' ? (
          <SellSystem
            currentUser={currentUser}
            onSaleComplete={handleSaleComplete}
            resetKey={sellResetKey}
          />
        ) : view === 'invoice-view' && lastSaleId ? (
          <InvoiceView
            saleId={lastSaleId}
            onBack={() => { setSellResetKey(k => k + 1); setView('sell'); }}
          />
        ) : view === 'sales-ledger' ? (
          <SalesLedger currentUser={currentUser} onViewInvoice={(id) => { setLastSaleId(id); setView('invoice-view'); }} />
        ) : view === 'expenses' ? (
          <Expenses currentUser={currentUser} />
        ) : view === 'accountant-report' ? (
          <AccountantReport currentUser={currentUser} />
        ) : view === 'float-tracker' ? (
          <FloatTracker currentUser={currentUser} />
        ) : view === 'consignment' ? (
          <Consignment currentUser={currentUser} />
        ) : view === 'reservations' ? (
          <Reservations currentUser={currentUser} />
        ) : view === 'wish-list' ? (
          <WishList currentUser={currentUser} />
        ) : view === 'supplier-invoices' ? (
          <SupplierInvoices currentUser={currentUser} />
        ) : view === 'supplier-log' ? (
          <SupplierLog currentUser={currentUser} />
        ) : view === 'price-labels' ? (
          <PriceLabels currentUser={currentUser} />
        ) : view === 'profit-dashboard' ? (
          <ProfitDashboard currentUser={currentUser} />
        ) : view === 'bullion' ? (
          <Bullion user={currentUser} />
        ) : view === 'admin' ? (
          <Admin currentUser={currentUser} />
        ) : view === 'outstanding' ? (
          <Outstanding currentUser={currentUser} onViewInvoice={(id) => { setLastSaleId(id); setView('invoice-view'); }} />
        ) : view === 'refunds' ? (
          <RefundsView currentUser={currentUser} onViewInvoice={(id) => { setLastSaleId(id); setView('invoice-view'); }} />
        ) : view === 'credit-notes' ? (
          <CreditNotesView currentUser={currentUser} />
        ) : view === 'bank-reconciliation' ? (
          <BankReconciliation currentUser={currentUser} />
        ) : view === 'cashup' ? (
          <CashUp currentUser={currentUser} />
        ) : view === 'takings-report' ? (
          <TakingsReport currentUser={currentUser} />
        ) : view === 'pnl-report' ? (
          <PnlReport currentUser={currentUser} />
        ) : view === 'customer-loyalty' ? (
          <CustomerLoyalty currentUser={currentUser} />
        ) : view === 'event-tracker' ? (
          <EventTracker currentUser={currentUser} />
        ) : view === 'quick-quotes' ? (
          <QuickQuotes currentUser={currentUser} />
        ) : view === 'insurance-register' ? (
          <InsuranceRegister currentUser={currentUser} />
        ) : view === 'gift-vouchers' ? (
          <GiftVouchers currentUser={currentUser} />
        ) : view === 'stock-check' ? (
          <StockCheck currentUser={currentUser} />
        ) : view === 'ebay-export' ? (
          <EbayExport currentUser={currentUser} />
        ) : (
          <StockControl
            currentUser={currentUser}
            onEdit={handleEdit}
            onAddNew={handleAddNew}
          />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
