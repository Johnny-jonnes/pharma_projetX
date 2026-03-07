/**
 * PHARMA_PROJET — Moteur d'Alertes Automatiques
 * Scan périodique : stocks bas, expirations, anomalies
 */

const AlertsEngine = {
  intervalId: null,
  lastRun: null,

  async start() {
    console.log('[AlertsEngine] Démarrage...');
    // Run immediately then every 15 minutes
    await this.run();
    this.intervalId = setInterval(() => this.run(), 15 * 60 * 1000);
  },

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    console.log('[AlertsEngine] Arrêté.');
  },

  async run() {
    if (!DB.AppState.currentUser) return;
    this.lastRun = Date.now();
    console.log('[AlertsEngine] Scan en cours...');

    try {
      await Promise.all([
        this.checkStockAlerts(),
        this.checkExpiryAlerts(),
        this.checkPendingOrders(),
        this.checkCaisseReminder(),
      ]);
    } catch (e) {
      console.warn('[AlertsEngine] Erreur:', e.message);
    }
  },

  async checkStockAlerts() {
    const [products, stockAll, existingAlerts] = await Promise.all([
      DB.dbGetAll('products'),
      DB.dbGetAll('stock'),
      DB.dbGetAll('alerts'),
    ]);

    const stockMap = {};
    stockAll.forEach(s => { stockMap[s.productId] = s.quantity; });

    const today = new Date().toISOString().split('T')[0];

    for (const product of products) {
      if (product.status !== 'active') continue;
      const qty = stockMap[product.id] || 0;
      const min = product.minStock || 10;

      // Check if alert already exists today
      const hasAlert = existingAlerts.some(a =>
        a.productId === product.id &&
        a.status === 'unread' &&
        (a.type === 'LOW_STOCK' || a.type === 'RUPTURE') &&
        new Date(a.date).toISOString().split('T')[0] === today
      );
      if (hasAlert) continue;

      if (qty === 0) {
        await DB.dbAdd('alerts', {
          type: 'RUPTURE',
          productId: product.id,
          productName: product.name,
          message: `RUPTURE : ${product.name} — Stock épuisé`,
          status: 'unread',
          date: Date.now(),
          priority: 'critical',
        });
      } else if (qty <= min) {
        await DB.dbAdd('alerts', {
          type: 'LOW_STOCK',
          productId: product.id,
          productName: product.name,
          message: `Stock bas : ${product.name} — ${qty} unités (seuil: ${min})`,
          status: 'unread',
          date: Date.now(),
          priority: qty <= Math.floor(min / 2) ? 'high' : 'medium',
        });
      }
    }
  },

  async checkExpiryAlerts() {
    const [lots, products, existingAlerts] = await Promise.all([
      DB.dbGetAll('lots'),
      DB.dbGetAll('products'),
      DB.dbGetAll('alerts'),
    ]);

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });
    const today = new Date().toISOString().split('T')[0];

    for (const lot of lots) {
      if (lot.status !== 'active') continue;
      const days = UI.daysUntilExpiry(lot.expiryDate);
      if (days === null) continue;

      const prod = productMap[lot.productId];
      if (!prod) continue;

      // Don't re-alert same lot same day
      const hasAlert = existingAlerts.some(a =>
        a.lotId === lot.id &&
        a.status === 'unread' &&
        new Date(a.date).toISOString().split('T')[0] === today
      );
      if (hasAlert) continue;

      if (days <= 0) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_CRITICAL',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `LOT EXPIRÉ : ${prod.name} — Lot ${lot.lotNumber} — ${lot.quantity} unités à détruire`,
          status: 'unread',
          date: Date.now(),
          priority: 'critical',
        });
        // Auto-block lot
        await DB.dbPut('lots', { ...lot, status: 'blocked' });
      } else if (days <= 30) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_CRITICAL',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `Expiration dans ${days} jours — ${prod.name} (Lot ${lot.lotNumber}) — ${lot.quantity} unités`,
          status: 'unread',
          date: Date.now(),
          priority: 'high',
        });
      } else if (days <= 90) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_SOON',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `Expiration dans ${days} jours — ${prod.name} (Lot ${lot.lotNumber})`,
          status: 'unread',
          date: Date.now(),
          priority: days <= 60 ? 'medium' : 'low',
        });
      }
    }
  },

  async checkPendingOrders() {
    const orders = await DB.dbGetAll('purchaseOrders');
    const existingAlerts = await DB.dbGetAll('alerts');
    const today = new Date().toISOString().split('T')[0];

    for (const order of orders) {
      if (order.status !== 'sent') continue;
      if (!order.expectedDate) continue;

      const daysLate = Math.floor((new Date() - new Date(order.expectedDate)) / 86400000);
      if (daysLate < 3) continue;

      const hasAlert = existingAlerts.some(a =>
        a.orderId === order.id && a.type === 'ORDER_LATE' && a.status === 'unread'
      );
      if (hasAlert) continue;

      await DB.dbAdd('alerts', {
        type: 'ORDER_LATE',
        orderId: order.id,
        message: `Commande en retard : ${order.orderNumber} — ${daysLate} jours de retard`,
        status: 'unread',
        date: Date.now(),
        priority: daysLate >= 7 ? 'high' : 'medium',
      });
    }
  },

  async checkCaisseReminder() {
    // Remind at end of day if caisse not closed
    const now = new Date();
    if (now.getHours() < 18) return; // Only after 18h

    const today = now.toISOString().split('T')[0];
    const cashRegister = await DB.dbGetAll('cashRegister');
    const todayClosed = cashRegister.some(c => c.type === 'closure' && c.date === today);
    if (todayClosed) return;

    const existingAlerts = await DB.dbGetAll('alerts');
    const hasAlert = existingAlerts.some(a =>
      a.type === 'CAISSE_REMINDER' && a.status === 'unread' &&
      new Date(a.date).toISOString().split('T')[0] === today
    );
    if (hasAlert) return;

    await DB.dbAdd('alerts', {
      type: 'CAISSE_REMINDER',
      message: `Rappel : Clôture de caisse journalière non effectuée`,
      status: 'unread',
      date: Date.now(),
      priority: 'medium',
    });
  },
};

// Auto-generate stock suggestions for low stock
async function generateReorderSuggestions() {
  const [products, stockAll, movements] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('movements'),
  ]);

  const stockMap = {};
  stockAll.forEach(s => { stockMap[s.productId] = s.quantity; });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSales = movements.filter(m => m.type === 'EXIT' && m.subType === 'SALE' && new Date(m.date).getTime() > thirtyDaysAgo);

  const suggestions = [];

  for (const product of products.filter(p => p.status === 'active')) {
    const qty = stockMap[product.id] || 0;
    if (qty > product.minStock * 1.5) continue;

    // Calculate average daily consumption
    const productSales = recentSales.filter(m => m.productId === product.id);
    const totalSold = Math.abs(productSales.reduce((a, m) => a + (m.quantity || 0), 0));
    const avgDailyConsumption = totalSold / 30;

    // Days of stock remaining
    const daysRemaining = avgDailyConsumption > 0 ? Math.floor(qty / avgDailyConsumption) : 999;

    // Suggested order quantity (30-day supply)
    const suggestedQty = Math.max(product.minStock * 3, Math.ceil(avgDailyConsumption * 30));

    suggestions.push({
      product,
      currentStock: qty,
      avgDailyConsumption: avgDailyConsumption.toFixed(2),
      daysRemaining,
      suggestedQty,
      urgency: daysRemaining <= 7 ? 'critical' : daysRemaining <= 14 ? 'high' : 'medium',
    });
  }

  return suggestions.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Render reorder suggestions panel
async function renderReorderSuggestions(container) {
  UI.loading(container, 'Calcul des suggestions de réapprovisionnement...');

  const suggestions = await generateReorderSuggestions();
  const suppliers = await DB.dbGetAll('suppliers');

  if (suggestions.length === 0) {
    UI.empty(container, 'Tous les stocks sont suffisants', 'package');
    return;
  }

  const criticalCount = suggestions.filter(s => s.urgency === 'critical').length;
  const highCount = suggestions.filter(s => s.urgency === 'high').length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Suggestions de Réapprovisionnement</h1>
        <p class="page-subtitle">Basé sur la consommation des 30 derniers jours</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="createOrderFromSuggestions()"><i data-lucide="clipboard-list"></i> Créer BC automatique</button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip stat-red"><span class="stat-val">${criticalCount}</span><span class="stat-label">Urgents &lt;7j</span></div>
      <div class="stat-chip stat-orange"><span class="stat-val">${highCount}</span><span class="stat-label">Prioritaires &lt;14j</span></div>
      <div class="stat-chip stat-blue"><span class="stat-val">${suggestions.length}</span><span class="stat-label">Total à commander</span></div>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all-suggestions" onchange="toggleAllSuggestions(this)"></th>
            <th>Produit</th>
            <th>Stock actuel</th>
            <th>Conso/jour</th>
            <th>Jours restants</th>
            <th>Qté suggérée</th>
            <th>Urgence</th>
            <th>Commander</th>
          </tr>
        </thead>
        <tbody>
          ${suggestions.map((s, idx) => `
            <tr>
              <td><input type="checkbox" class="suggestion-cb" data-idx="${idx}" checked></td>
              <td>
                <div><strong>${s.product.name}</strong></div>
                <div class="text-muted text-sm">${s.product.category}</div>
              </td>
              <td>
                <span class="${s.currentStock === 0 ? 'text-danger' : s.currentStock <= s.product.minStock ? 'text-warning' : 'text-success'} font-bold">${s.currentStock}</span>
                <span class="text-muted text-sm"> / min ${s.product.minStock}</span>
              </td>
              <td>${s.avgDailyConsumption}</td>
              <td>
                <span class="badge badge-${s.urgency === 'critical' ? 'danger' : s.urgency === 'high' ? 'warning' : 'info'}">
                  ${s.daysRemaining >= 999 ? '∞' : s.daysRemaining + 'j'}
                </span>
              </td>
              <td><input type="number" class="input-sm" id="suggest-qty-${idx}" value="${s.suggestedQty}" min="1" style="width:70px"></td>
              <td><span class="badge badge-${s.urgency === 'critical' ? 'danger' : s.urgency === 'high' ? 'warning' : 'info'}">${s.urgency === 'critical' ? 'Critique' : s.urgency === 'high' ? 'Haute' : 'Normale'}</span></td>
              <td>
                <button class="btn btn-xs btn-primary" onclick="quickOrder(${s.product.id}, '${s.product.name}')">Commander</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  window._reorderSuggestions = suggestions;
}

function toggleAllSuggestions(cb) {
  document.querySelectorAll('.suggestion-cb').forEach(c => { c.checked = cb.checked; });
}

async function createOrderFromSuggestions() {
  const suggestions = window._reorderSuggestions || [];
  const selected = suggestions.filter((s, idx) => {
    const cb = document.querySelector(`.suggestion-cb[data-idx="${idx}"]`);
    return cb?.checked;
  });

  if (selected.length === 0) {
    UI.toast('Sélectionnez au moins un produit', 'warning');
    return;
  }

  const suppliers = await DB.dbGetAll('suppliers');
  if (suppliers.length === 0) {
    UI.toast('Aucun fournisseur enregistré', 'warning');
    return;
  }

  // Get quantities from inputs
  const items = selected.map((s, i) => {
    const originalIdx = (window._reorderSuggestions || []).indexOf(s);
    const qty = parseInt(document.getElementById(`suggest-qty-${originalIdx}`)?.value || s.suggestedQty);
    return { productId: s.product.id, productName: s.product.name, quantity: qty, unitPrice: s.product.purchasePrice || 0, receivedQty: 0 };
  });

  const totalAmount = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const orderId = await DB.dbAdd('purchaseOrders', {
    supplierId: suppliers[0].id,
    orderNumber: `BC-AUTO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    date: new Date().toISOString().split('T')[0],
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items,
    totalAmount,
    status: 'pending',
    note: 'Commande générée automatiquement depuis les suggestions de réapprovisionnement',
    createdBy: DB.AppState.currentUser?.id,
  });

  await DB.writeAudit('AUTO_ORDER', 'purchaseOrders', orderId, { itemCount: items.length, totalAmount });
  UI.toast(`Bon de commande BC-AUTO créé — ${items.length} produit(s)`, 'success', 4000);
  Router.navigate('purchase-orders');
}

async function quickOrder(productId, productName) {
  const suppliers = await DB.dbGetAll('suppliers');
  if (suppliers.length === 0) {
    UI.toast('Ajoutez d\'abord un fournisseur', 'warning');
    return;
  }
  await showNewOrder(suppliers[0].id, suppliers[0].name);
}

window.AlertsEngine = AlertsEngine;
window.generateReorderSuggestions = generateReorderSuggestions;
window.renderReorderSuggestions = renderReorderSuggestions;
window.toggleAllSuggestions = toggleAllSuggestions;
window.createOrderFromSuggestions = createOrderFromSuggestions;
window.quickOrder = quickOrder;

Router.register('reorder', (container) => renderReorderSuggestions(container));
