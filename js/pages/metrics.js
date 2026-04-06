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

    // First usage / App creation date (ignoring any test data before 2026)
    const realSales = sales.filter(s => new Date(s.date).getFullYear() >= 2026);
    const firstSale = [...realSales].sort((a,b) => new Date(a.date) - new Date(b.date))[0];
    const startedUsingDate = firstSale ? new Date(firstSale.date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    }) : "Aujourd'hui";

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

    // DSO — Délai Moyen de Recouvrement (jours)
    const creditSales = sales.filter(s => s.paymentMethod === 'credit');
    const paidCredits = creditSales.filter(s => s.status === 'completed' || s.status === 'paid');
    const unpaidCredits = creditSales.filter(s => s.status === 'pending');
    const totalCreances = unpaidCredits.reduce((a, s) => a + (s.total || 0), 0);
    let dsoAvg = 0;
    if (paidCredits.length > 0) {
      const dsoDays = paidCredits.map(s => {
        const saleDate = new Date(s.date);
        const paidDate = s.paidAt ? new Date(s.paidAt) : new Date(); // Si pas de date de paiement, date courante
        return Math.max(0, Math.floor((paidDate - saleDate) / 86400000));
      });
      dsoAvg = Math.round(dsoDays.reduce((a, d) => a + d, 0) / dsoDays.length);
    }

    // Rotation des stocks (moyenne)
    const totalStockValue = products.reduce((a, p) => {
      const s = stockAll.find(st => st.productId === p.id);
      return a + ((s?.quantity || 0) * (p.purchasePrice || 0));
    }, 0);
    const stockRotation = totalStockValue > 0 ? (totalCOGS / totalStockValue).toFixed(1) : 0;

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

      <!-- Hero Impact Card -->
      <div class="elite-card impact-card" style="padding: 32px; background: linear-gradient(135deg, #0d324d, #1b6fae); color: white; border-radius: 16px; margin-bottom: 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; box-shadow: 0 15px 35px rgba(27, 111, 174, 0.25); position: relative; overflow: hidden;">
        <!-- Decor pattern -->
        <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: rgba(255,255,255,0.08); border-radius: 50%; blur(10px);"></div>
        <div style="position: absolute; bottom: -30px; left: 20%; width: 100px; height: 100px; background: rgba(255,255,255,0.04); border-radius: 50%; blur(5px);"></div>
        
        <div style="z-index: 1;">
          <div style="font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.85); margin-bottom: 8px; display:flex; align-items:center; gap:8px;">
            <i data-lucide="award" style="width: 18px; height: 18px;"></i>
            Valeur nette générée via PharmaProjet
          </div>
          <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 4px;">
            <span style="font-size: 42px; font-weight: 900; line-height: 1;">${UI.formatCurrency(totalProfit)}</span>
          </div>
          <div style="font-size: 14px; margin-top: 10px; color: rgba(255,255,255,0.9); display:flex; align-items:center; gap:6px;">
            <i data-lucide="trending-up" style="width:16px; height: 16px;"></i>
            C'est votre bénéfice brut dégagé depuis l'installation
          </div>
        </div>
        <div style="z-index: 1; text-align: right; padding-left: 32px; border-left: 1px solid rgba(255,255,255,0.25);">
          <div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Utilisé au quotidien depuis le</div>
          <div style="font-size: 20px; font-weight: bold; margin-bottom: 6px;">${startedUsingDate}</div>
          <div style="font-size: 14px; font-weight: 500; background: rgba(255,255,255,0.2); display: inline-block; padding: 4px 12px; border-radius: 20px;">
            <i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:text-bottom;"></i>
            ${totalTransactions} transactions conclues
          </div>
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

        <!-- Card 5 : DSO -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(155, 89, 182, 0.1); color: #9B59B6; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="clock" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">DSO (Délai Recouvrement)</div>
            <div style="font-size: 24px; font-weight: 800; color: #9B59B6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dsoAvg} jours</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${paidCredits.length} crédit(s) réglé(s)</div>
          </div>
        </div>

        <!-- Card 6 : Créances -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid ${totalCreances > 0 ? 'var(--danger-color)' : 'var(--border)'}; box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(231, 76, 60, 0.08); color: #e74c3c; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file-clock" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Créances en Cours</div>
            <div style="font-size: 24px; font-weight: 800; color: ${totalCreances > 0 ? '#e74c3c' : 'var(--success-color)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${totalCreances > 0 ? UI.formatCurrency(totalCreances) : '✔ Aucune'}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${unpaidCredits.length > 0 ? unpaidCredits.length + ' dette(s) impayée(s)' : 'Tout est réglé'}</div>
          </div>
        </div>

        <!-- Card 7 : Rotation Stock -->
        <div class="metric-card elite-card" style="padding: 24px; display: flex; align-items: center; gap: 16px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-radius: 12px; transition: transform 0.2s;">
          <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(26, 188, 156, 0.1); color: #1ABC9C; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="refresh-cw" style="width: 28px; height: 28px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Rotation Stock</div>
            <div style="font-size: 24px; font-weight: 800; color: #1ABC9C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${stockRotation}x</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Coût marchandises / Valeur stock</div>
          </div>
        </div>
      </div>

      <div class="charts-row" style="margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 24px;">
        <div class="chart-card dash-panel" style="flex: 2; min-width: 400px; padding: 24px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
          <style>
            .trend-bar-wrapper { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; cursor: crosshair; }
            .trend-bar-wrapper:hover { transform: scale(1.15); z-index: 10; }
            .trend-bar-wrapper:hover .trend-bar-fill { filter: brightness(1.2); box-shadow: 0 0 15px rgba(52, 152, 219, 0.7); }
            .trend-bar-wrapper:hover .trend-value { color: var(--primary-color, #3498db); font-size: 16px; font-weight: 900; transform: translateY(-8px); }
            .trend-bar-wrapper:hover .trend-label { color: var(--text); font-weight: 800; transform: scale(1.1); }
          </style>
          <div class="chart-header" style="margin-bottom: 16px;">
            <h3 class="chart-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><i data-lucide="activity" style="color: var(--primary-color);"></i> Tendance des Ventes (7 Derniers Jours)</h3>
          </div>
          <div id="custom-trend-chart-container" style="flex: 1; width: 100%; height: 260px; display: flex; align-items: flex-end; justify-content: space-around; gap: 12px; padding: 30px 10px 10px 10px;">
            <!-- Injected by JS -->
          </div>
        </div>

        <div class="chart-card dash-panel" style="flex: 1; min-width: 450px; padding: 24px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
          <style>
            .donut-hover-item:hover {
              transform: scale(1.05) translateX(10px);
              background: var(--bg-body, #f8fafc);
              box-shadow: 0 10px 25px rgba(0,0,0,0.06);
              border-color: var(--primary-color) !important;
              z-index: 10;
            }
          </style>
          <div class="chart-header" style="margin-bottom: 16px;">
            <h3 class="chart-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><i data-lucide="pie-chart" style="color: #3498DB;"></i> Répartition Financière</h3>
          </div>
          <div style="flex: 1; width: 100%; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 32px; flex-wrap: nowrap;">
            <div style="flex: 0 0 auto; width: 260px; display: flex; justify-content: center; align-items: center;">
              <canvas id="custom-giant-donut" width="260" height="260" style="max-width: 100%; height: auto;"></canvas>
            </div>
            <div id="giant-donut-legend" style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
               <!-- Injecté par JS -->
            </div>
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
      // 1. Custom Interactive DOM Curve Chart (Tendance)
      const trendContainer = document.getElementById('custom-trend-chart-container');
      if (trendContainer) {
        const maxVal = Math.max(...trendData, 1);
        const svgW = 800;
        const svgH = 260;
        const padX = 40;
        const padY = 40;
        
        const pts = [];
        for (let i = 0; i < trendData.length; i++) {
          const x = padX + (i / (trendData.length - 1)) * (svgW - 2 * padX);
          const y = svgH - padY - (trendData[i] / maxVal) * (svgH - 2 * padY);
          pts.push({x, y, val: trendData[i], lbl: last7DaysLabels[i]});
        }
        
        // Génération de la courbe de Bézier (Spline)
        // Génération de la courbe de Bézier (Spline)
        let pathD = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const cx = (pts[i].x + pts[i+1].x) / 2;
          pathD += ` C ${cx},${pts[i].y} ${cx},${pts[i+1].y} ${pts[i+1].x},${pts[i+1].y}`;
        }
        
        const fillPathD = pathD + ` L ${pts[pts.length-1].x},${svgH - padY} L ${pts[0].x},${svgH - padY} Z`;

        trendContainer.innerHTML = `
          <div style="position: relative; width: 100%; height: 100%;">
            <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible; padding-bottom: 20px;">
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3498db" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#3498db" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <!-- Ligne de base -->
              <line x1="${padX}" y1="${svgH - padY}" x2="${svgW - padX}" y2="${svgH - padY}" stroke="var(--border)" stroke-width="2" stroke-dasharray="5,5" />
              <!-- Remplissage Gradient -->
              <path d="${fillPathD}" fill="url(#curveGradient)" />
              <!-- Courbe dynamique -->
              <path d="${pathD}" fill="none" stroke="#3498db" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <!-- Points -->
              ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="var(--surface)" stroke="#3498db" stroke-width="3" style="transition: all 0.3s;" onmouseover="this.setAttribute('r', '9'); this.setAttribute('fill', '#3498db')" onmouseout="this.setAttribute('r', '6'); this.setAttribute('fill', 'var(--surface)')" />`).join('')}
            </svg>
            
            <div style="position: absolute; bottom: -10px; left: 0; width: 100%; display: flex; justify-content: space-between; padding: 0 ${(padX/svgW)*100}% 0 ${(padX/svgW)*100}%;">
              ${pts.map(p => `
                 <div class="trend-hover-group" style="position: absolute; left: ${((p.x - padX) / (svgW - 2 * padX)) * 100}%; bottom: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer;">
                   <div class="trend-tooltip" style="opacity: 0; position: absolute; bottom: ${svgH - p.y + 15}px; background: var(--text); color: var(--surface); padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 13px; white-space: nowrap; pointer-events: none; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10; transform: translateY(10px);">
                     ${p.val.toLocaleString('fr-FR')} FG
                   </div>
                   <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: capitalize; text-align: center; line-height: 1.2;">${p.lbl.split(' ')[0]} <br> <span style="font-size:14px; color: var(--text); font-weight:800;">${p.lbl.split(' ')[1]}</span></div>
                 </div>
              `).join('')}
            </div>
            <style>
              .trend-hover-group:hover .trend-tooltip { opacity: 1 !important; transform: translateY(0) !important; }
            </style>
          </div>
        `;
      }
      
      const donutLabels = ['Coût Achats', 'Bénéfice Net', 'Remboursements'];
      const donutData = [totalCOGS, Math.max(0, totalProfit), Math.max(0, totalRefunds)];
      const donutColors = ['#3498db', '#2ecc71', '#e74c3c'];
      const donutTotal = donutData.reduce((a, b) => a + b, 0);

      // Giant Custom Donut Chart (Bypass ui.js limited canvas sizes)
      drawGiantDonut('custom-giant-donut', donutData, donutColors);

      // DOM based legend for large scalable hover effects
      const legContainer = document.getElementById('giant-donut-legend');
      if (legContainer) {
        legContainer.innerHTML = donutLabels.map((lbl, i) => {
          const pct = donutTotal > 0 ? ((donutData[i] / donutTotal) * 100).toFixed(1) : 0;
          return `
            <div class="donut-hover-item" style="display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid transparent; border-radius: 16px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; background: rgba(0,0,0,0.02);">
              <div style="width: 32px; height: 32px; background: ${donutColors[i]}; border-radius: 8px; flex-shrink: 0; box-shadow: 0 4px 15px ${donutColors[i]}80;"></div>
              <div>
                <div style="font-size: 18px; font-weight: 800; color: var(--text);">${lbl}</div>
                <div style="font-size: 17px; font-weight: 700; color: var(--text-muted); margin-top: 6px;">${pct}% <span style="opacity: 0.3; margin: 0 8px;">|</span> ${donutData[i].toLocaleString('fr-FR')} FG</div>
              </div>
            </div>
          `;
        }).join('');
      }
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error-state">Erreur d'analyse : ${err.message}</div>`;
  }
}

function drawGiantDonut(canvasId, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  
  // Utiliser tout l'espace possible: Rayon énorme, centré  
  const total = data.reduce((a, b) => a + b, 0);
  
  // On place le cercle parfaitement au centre puisque la légende html prend sa propre place
  const cx = w * 0.50; 
  const cy = h * 0.50; 
  // Rayon très grand occupant le maximum
  const R = Math.min(w, h) * 0.45; 
  const r = R * 0.6; // Trou au milieu
  
  ctx.clearRect(0, 0, w, h);
  
  if (total === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée', cx, cy);
    return;
  }
  
  let startAngle = -Math.PI / 2;
  data.forEach((val, i) => {
    const slice = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = UI.getThemeColor('--surface') || '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    startAngle += slice;
  });
  
  // Center hole
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = UI.getThemeColor('--surface') || '#fff'; 
  ctx.fill();
  
  // Center text (Large)
  ctx.fillStyle = UI.getThemeColor('--text') || '#000';
  ctx.font = '900 26px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(total.toLocaleString('fr-FR'), cx, cy + 8);
  ctx.font = '15px system-ui';
  ctx.fillStyle = UI.getThemeColor('--text-muted') || '#666';
  ctx.fillText('Chiffre brut', cx, cy + 28);
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

