/**
 * PHARMA_PROJET — metrics.js
 * Internal business metrics and KPIs dashboard
 */

async function renderMetrics(container) {
  UI.loading(container, 'Analyse des données business...');

  try {
    const [sales, saleItems, products, stockAll, auditLog, alerts, returns] = await Promise.all([
      DB.dbGetAll('sales'),
      DB.dbGetAll('saleItems'),
      DB.dbGetAll('products'),
      DB.dbGetAll('stock'),
      DB.dbGetAll('auditLog'),
      DB.dbGetAll('alerts'),
      DB.dbGetAll('returns'),
    ]);

    const approvedReturns = returns.filter(r => r.status === 'approved');
    const totalRefunds = approvedReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);
    const totalRevenue = sales.filter(s => ['completed', 'paid'].includes(s.status)).reduce((a, s) => a + s.total, 0) - totalRefunds;
    const totalTransactions = sales.length;
    const avgBasket = totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(0) : 0;

    // Usage activity
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const activeDays = new Set(auditLog
      .filter(l => l.timestamp > last30Days.getTime())
      .map(l => new Date(l.timestamp).toDateString())
    ).size;

    // Stock health
    const outOfStock = products.filter(p => {
      const s = stockAll.find(st => st.productId === p.id);
      return !s || s.quantity <= 0;
    }).length;

    // Margin analysis (Net)
    const rawCOGS = saleItems.reduce((a, si) => a + (si.purchasePrice || 0) * si.quantity, 0);
    const refundsCOGS = approvedReturns.reduce((a, r) => {
      return a + (r.items || []).reduce((acc, ri) => {
        const si = saleItems.find(s => s.id === ri.saleItemId);
        return acc + (si?.purchasePrice || 0) * ri.quantity;
      }, 0);
    }, 0);

    const totalCOGS = rawCOGS - refundsCOGS;
    const totalProfit = totalRevenue - totalCOGS;
    const globalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Métriques Business Internes</h1>
          <p class="page-subtitle">Suivi de la performance et de l'engagement officine</p>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card elite-card">
          <div class="metric-icon primary"><i data-lucide="trending-up"></i></div>
          <div class="metric-content">
            <span class="metric-label">CA Cumulé</span>
            <span class="metric-value">${UI.formatCurrency(totalRevenue)}</span>
          </div>
        </div>
        
        <div class="metric-card elite-card">
          <div class="metric-icon secondary"><i data-lucide="shopping-bag"></i></div>
          <div class="metric-content">
            <span class="metric-label">Panier Moyen</span>
            <span class="metric-value">${UI.formatCurrency(avgBasket)}</span>
          </div>
        </div>

        <div class="metric-card elite-card">
          <div class="metric-icon warning"><i data-lucide="activity"></i></div>
          <div class="metric-content">
            <span class="metric-label">Engagement (30j)</span>
            <span class="metric-value">${activeDays} j / 30</span>
          </div>
        </div>

        <div class="metric-card elite-card">
          <div class="metric-icon danger"><i data-lucide="alert-triangle"></i></div>
          <div class="metric-content">
            <span class="metric-label">Produits en Rupture</span>
            <span class="metric-value">${outOfStock}</span>
          </div>
        </div>
      </div>

      <div class="metrics-row mt-2">
        <div class="metrics-main-card elite-card flex-2">
          <h3 class="card-title">Analyse Financière</h3>
          <div class="margin-analytics">
            <div class="margin-circle">
              <span class="margin-number">${globalMargin}%</span>
              <span class="margin-label">Marge Brute</span>
            </div>
            <div class="margin-details">
              <div class="detail-row">
                <span>Chiffre d'Affaires</span>
                <strong>${UI.formatCurrency(totalRevenue)}</strong>
              </div>
              <div class="detail-row">
                <span>Coût d'Achat (COGS)</span>
                <strong>${UI.formatCurrency(totalCOGS)}</strong>
              </div>
              <div class="detail-row total">
                <span>Profit Brut</span>
                <strong>${UI.formatCurrency(totalProfit)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="metrics-side-card elite-card flex-1">
          <h3 class="card-title">Top 5 Produits (Volume)</h3>
          <div class="top-list">
            ${getTopProducts(saleItems).map((p, i) => `
              <div class="top-item">
                <span class="rank">${i + 1}</span>
                <span class="name">${p.name}</span>
                <span class="count">${p.qty} vtes</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="info-box-small info mt-2">
        <i data-lucide="info"></i>
        <span>Ces données sont calculées localement. Pour une analyse multi-sites, activez la synchronisation Cloud Supabase.</span>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error-state">Erreur d'analyse : ${err.message}</div>`;
  }
}

function getTopProducts(items) {
  const map = {};
  items.forEach(it => {
    if (!map[it.productName]) map[it.productName] = 0;
    map[it.productName] += it.quantity;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));
}

window.renderMetrics = renderMetrics;
