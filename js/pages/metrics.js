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
    const completedSales = sales.filter(s => ['completed', 'paid'].includes(s.status));
    const totalRevenue = completedSales.reduce((a, s) => a + (s.total || 0), 0) - totalRefunds;
    const totalTransactions = completedSales.length;
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
    const rawCOGS = saleItems.reduce((a, si) => a + (si.purchasePrice || 0) * (si.quantity || 0), 0);
    const refundsCOGS = approvedReturns.reduce((a, r) => {
      return a + (r.items || []).reduce((acc, ri) => {
        const si = saleItems.find(s => s.id === ri.saleItemId);
        return acc + (si?.purchasePrice || 0) * (ri.quantity || 0);
      }, 0);
    }, 0);

    const totalCOGS = rawCOGS - refundsCOGS;
    const totalProfit = totalRevenue - totalCOGS;
    const globalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0;

    // 7-day trend
    const last7DaysLabels = [];
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      last7DaysLabels.push(d.toLocaleDateString('fr-FR', { weekday: 'short', day:'numeric' }));
      const dSales = completedSales.filter(s => s.date && s.date.startsWith(ds)).reduce((a, s) => a + (s.total || 0), 0);
      trendData.push(dSales);
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Tableau de Bord Exécutif</h1>
          <p class="page-subtitle">Indicateurs de Performance Clés (KPI)</p>
        </div>
      </div>

      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <!-- Card 1 -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(46, 204, 113, 0.1); color: var(--success-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="trending-up" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">CA Cumulé Net</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${UI.formatCurrency(totalRevenue)}</div>
          </div>
        </div>
        
        <!-- Card 2 -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(52, 152, 219, 0.1); color: #3498DB; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="shopping-bag" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Panier Moyen</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${UI.formatCurrency(avgBasket)}</div>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(243, 156, 18, 0.1); color: #F39C12; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="activity" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Marge Globale</div>
            <div style="font-size: 24px; font-weight: 800; color: #F39C12; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${globalMargin}%</div>
          </div>
        </div>

        <!-- Card 4 -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(231, 76, 60, 0.1); color: var(--danger-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="alert-triangle" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Rupture Stock</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--danger-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${outOfStock}</div>
          </div>
        </div>
      </div>

      <div class="charts-row" style="margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 24px;">
        <div class="chart-card dash-panel" style="flex: 2; min-width: 400px; padding: 24px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
          <div class="chart-header" style="margin-bottom: 16px;">
            <h3 class="chart-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><i data-lucide="activity" style="color: var(--primary-color);"></i> Tendance des Ventes (7 Derniers Jours)</h3>
          </div>
          <div style="width: 100%; height: 260px; display: flex; justify-content: center; align-items: center;">
            <canvas id="chart-metrics-trend" width="600" height="260" style="max-width: 100%; object-fit: contain;"></canvas>
          </div>
        </div>

        <div class="chart-card dash-panel" style="flex: 1; min-width: 300px; padding: 24px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
          <div class="chart-header" style="margin-bottom: 16px;">
            <h3 class="chart-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><i data-lucide="pie-chart" style="color: #3498DB;"></i> Répartition Financière</h3>
          </div>
          <div style="width: 100%; height: 260px; display: flex; justify-content: center; align-items: center;">
            <canvas id="chart-metrics-donut" width="450" height="260" style="max-width: 100%; object-fit: contain; margin-left: -20px;"></canvas>
          </div>
        </div>
      </div>

      <div class="metrics-row mt-2" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        <div class="metrics-main-card elite-card" style="padding: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;"><i data-lucide="calculator"></i> Bilan Comptable</h3>
          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 15px;">
            <div style="display: flex; justify-content: space-between;">
              <span class="text-muted">Chiffre d'Affaires Brut</span>
              <strong>${UI.formatCurrency(rawCOGS + totalProfit + totalRefunds)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--danger-color);">
              <span>- Retours Client</span>
              <strong>-${UI.formatCurrency(totalRefunds)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 8px;">
              <span class="text-muted">Chiffre d'Affaires Net</span>
              <strong>${UI.formatCurrency(totalRevenue)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
              <span>- Coût d'Achat (COGS)</span>
              <strong>-${UI.formatCurrency(totalCOGS)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(46, 204, 113, 0.1); padding: 12px; border-radius: 8px; margin-top: 8px;">
              <span style="font-weight: bold; color: var(--success-color);">Bénéfice Brut</span>
              <strong style="font-size: 18px; color: var(--success-color);">${UI.formatCurrency(totalProfit)}</strong>
            </div>
          </div>
        </div>

        <div class="metrics-side-card elite-card" style="padding: 20px;">
          <h3 class="card-title" style="margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;"><i data-lucide="award"></i> Top 5 Produits (Volume)</h3>
          <div class="top-list">
            ${getTopProducts(saleItems).map((p, i) => `
              <div class="top-item" style="display: flex; align-items: center; padding: 10px; background: var(--surface); margin-bottom: 8px; border-radius: 8px; border: 1px solid var(--border);">
                <span class="rank" style="background: ${i===0 ? '#F1C40F' : i===1 ? '#BDC3C7' : i===2 ? '#CD7F32' : 'var(--border)'}; color: ${i<3 ? '#fff' : 'inherit'}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 12px;">${i + 1}</span>
                <span class="name" style="flex: 1; font-weight: 500;">${p.name}</span>
                <span class="count" style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${p.qty} vtes</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Rendu des graphiques
    requestAnimationFrame(() => {
      // Line Chart (Tendance)
      Charts.line('chart-metrics-trend', last7DaysLabels, [
        { data: trendData, color: UI.getThemeColor('--primary-color') || '#2980b9' }
      ]);
      
      // Donut Chart (Répartition: COGS vs Profit vs Refunds)
      Charts.donut('chart-metrics-donut', 
        ['Coût Achats', 'Bénéfice Net', 'Remboursements'], 
        [totalCOGS, Math.max(0, totalProfit), Math.max(0, totalRefunds)], 
        ['#3498db', '#2ecc71', '#e74c3c']
      );
    });

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

