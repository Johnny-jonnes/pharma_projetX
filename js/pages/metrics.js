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
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid var(--border); padding-bottom: 15px; margin-bottom: 25px;">
        <div>
          <h1 class="page-title" style="font-size: 28px; background: linear-gradient(90deg, var(--primary-color), #2980b9); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"><i data-lucide="bar-chart-2"></i> Business Metrics Pro</h1>
          <p class="page-subtitle" style="font-size:14px; margin-top:4px;">Plateforme d'analyse et d'intelligence d'affaires</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px; text-transform:uppercase; font-weight:bold; color:var(--text-muted); letter-spacing:1px;">Période d'analyse continue</div>
          <div style="font-size:14px; font-weight:600; background:rgba(41, 128, 185, 0.1); color:#2980b9; padding:4px 12px; border-radius:20px; display:inline-block; margin-top:4px;">
            <i data-lucide="calendar" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Depuis ${startedUsingDate}
          </div>
        </div>
      </div>

      <!-- Hero Impact Section -->
      <div style="background: linear-gradient(135deg, #091e38 0%, #174b78 100%); border-radius: 20px; padding: 35px; color: white; display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px; box-shadow: 0 20px 40px rgba(23, 75, 120, 0.25); position:relative; overflow:hidden;">
        <!-- Animated Background Elements -->
        <div style="position:absolute; top:-100px; right:-50px; width:300px; height:300px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); border-radius:50%;"></div>
        <div style="position:absolute; bottom:-50px; left:10%; width:200px; height:200px; background: radial-gradient(circle, rgba(74, 189, 172, 0.15) 0%, rgba(255,255,255,0) 70%); border-radius:50%;"></div>
        
        <div style="position:relative; z-index:2; flex:1;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:700; text-transform:uppercase; font-size:14px; letter-spacing:1px; color:rgba(255,255,255,0.8); margin-bottom:12px;">
            <i data-lucide="zap" style="color: #f1c40f;"></i> Bénéfice Net Généré
          </div>
          <div style="font-size: 56px; font-weight: 900; line-height: 1.1; letter-spacing:-1px; text-shadow: 0 4px 10px rgba(0,0,0,0.2);">
            ${UI.formatCurrency(totalProfit)}
          </div>
          <div style="margin-top:16px; display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); padding:8px 16px; border-radius:30px; font-size:14px; font-weight:500; border:1px solid rgba(255,255,255,0.1);">
            <i data-lucide="activity" style="width:16px; height:16px; color:#4ade80;"></i>
            Marge Globale : ${globalMargin}% 
          </div>
        </div>

        <div style="position:relative; z-index:2; border-left:1px solid rgba(255,255,255,0.2); padding-left:40px; margin-left:20px; display:flex; flex-direction:column; gap:20px;">
          <div>
            <div style="font-size:12px; text-transform:uppercase; color:rgba(255,255,255,0.7); font-weight:600; margin-bottom:4px;">Chiffre d'Affaires Net</div>
            <div style="font-size:26px; font-weight:800;">${UI.formatCurrency(totalRevenue)}</div>
          </div>
          <div>
            <div style="font-size:12px; text-transform:uppercase; color:rgba(255,255,255,0.7); font-weight:600; margin-bottom:4px;">Transactions</div>
            <div style="font-size:26px; font-weight:800;">${totalTransactions} <span style="font-size:14px; font-weight:500; color:rgba(255,255,255,0.7);">ventes</span></div>
          </div>
        </div>
      </div>

      <!-- Main KPI Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 30px;">
        
        <!-- Metric Card 1: Panier Moyen -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:var(--shadow-sm); position:relative; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'">
          <div style="position:absolute; top:0; right:0; width:80px; height:80px; background:linear-gradient(135deg, transparent 50%, rgba(52, 152, 219, 0.1) 100%);"></div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:4px;">Panier Moyen</div>
              <div style="font-size:28px; font-weight:800; color:var(--text);">${UI.formatCurrency(avgBasket)}</div>
            </div>
            <div style="width:48px; height:48px; background:rgba(52, 152, 219, 0.1); color:#3498DB; border-radius:14px; display:flex; align-items:center; justify-content:center;">
              <i data-lucide="shopping-cart" style="width:24px; height:24px;"></i>
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
            Indicateur de dépense par client
          </div>
        </div>

        <!-- Metric Card 2: Rotation Stock -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:var(--shadow-sm); position:relative; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'">
          <div style="position:absolute; top:0; right:0; width:80px; height:80px; background:linear-gradient(135deg, transparent 50%, rgba(26, 188, 156, 0.1) 100%);"></div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:4px;">Rotation des Stocks</div>
              <div style="font-size:28px; font-weight:800; color:var(--text);">${stockRotation}x</div>
            </div>
            <div style="width:48px; height:48px; background:rgba(26, 188, 156, 0.1); color:#1ABC9C; border-radius:14px; display:flex; align-items:center; justify-content:center;">
              <i data-lucide="refresh-cw" style="width:24px; height:24px;"></i>
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between;">
            <span>Efficacité du renouvellement</span>
            <span class="${outOfStock > 0 ? 'text-danger' : 'text-success'} font-bold" style="display:flex;align-items:center;gap:4px;"><i data-lucide="alert-triangle" style="width:12px;height:12px;"></i> ${outOfStock} ruptures</span>
          </div>
        </div>

        <!-- Metric Card 3: DSO / Recouvrement -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:var(--shadow-sm); position:relative; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s; cursor:pointer;" onclick="Router.navigate('sales')" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'">
          <div style="position:absolute; top:0; right:0; width:80px; height:80px; background:linear-gradient(135deg, transparent 50%, rgba(155, 89, 182, 0.1) 100%);"></div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
               <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:4px;">Santé Client (DSO)</div>
               <div style="font-size:28px; font-weight:800; color:var(--text);">${dsoAvg} jours</div>
            </div>
            <div style="width:48px; height:48px; background:rgba(155, 89, 182, 0.1); color:#9B59B6; border-radius:14px; display:flex; align-items:center; justify-content:center;">
              <i data-lucide="user-check" style="width:24px; height:24px;"></i>
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between;">
            <span>Délai moyen de paiement</span>
            <span class="${totalCreances > 0 ? 'text-danger' : 'text-success'} font-bold">${totalCreances > 0 ? UI.formatCurrency(totalCreances) + ' impayés' : '0 dettes !'}</span>
          </div>
        </div>

      </div>

      <!-- Graphiques et Data -->
      <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; margin-bottom: 24px;">
        <div style="flex: 1.5; min-width: 450px; padding: 24px; background: var(--surface); border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight:700; margin:0;"><i data-lucide="trending-up" style="color:var(--primary-color); vertical-align:text-bottom; margin-right:6px;"></i> Dynamique des Ventes (7 Jours)</h3>
          </div>
          <canvas id="metrics-chart-trend" style="width: 100%; flex: 1; min-height: 280px;"></canvas>
        </div>

        <div style="flex: 1; min-width: 350px; padding: 24px; background: var(--surface); border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight:700; margin:0;"><i data-lucide="pie-chart" style="color:#3498DB; vertical-align:text-bottom; margin-right:6px;"></i> Répartition Financière</h3>
          </div>
          <canvas id="metrics-chart-finance" style="width: 100%; height: 260px;"></canvas>
        </div>
      </div>

      <!-- Tableaux Financiers Avancés -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px;">
        
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:var(--shadow-sm);">
          <h3 style="font-size: 16px; font-weight:700; margin-bottom: 20px; padding-bottom:12px; border-bottom:1px solid var(--border);"><i data-lucide="file-spreadsheet" style="vertical-align:text-bottom; margin-right:6px;"></i> État de Résultat (Comptable)</h3>
          
          <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color:var(--text-muted); font-weight:500;">Chiffre d'Affaires Théorique</span>
              <strong style="font-size:15px">${UI.formatCurrency(rawCOGS + totalProfit + totalRefunds)}</strong>
            </div>
            
            <div style="display: flex; justify-content: space-between; position:relative;">
              <div style="position:absolute; left:-12px; top:8px; width:6px; height:6px; border-radius:50%; background:var(--danger-color);"></div>
              <span style="font-weight:500;">Moins : Remboursements & Retours</span>
              <strong class="text-danger">-${UI.formatCurrency(totalRefunds)}</strong>
            </div>
            
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;">
              <span style="font-weight:700; text-transform:uppercase; font-size:13px; letter-spacing:0.5px;">Chiffre d'Affaires Net</span>
              <strong style="font-size:16px; color:var(--text);">${UI.formatCurrency(totalRevenue)}</strong>
            </div>
            
            <div style="display: flex; justify-content: space-between; position:relative;">
              <div style="position:absolute; left:-12px; top:8px; width:6px; height:6px; border-radius:50%; background:#f39c12;"></div>
              <span style="font-weight:500;">Moins : Coût des Marchandises Vendues</span>
              <strong style="color:#f39c12;">-${UI.formatCurrency(totalCOGS)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(46, 204, 113, 0.1), rgba(46, 204, 113, 0.05)); padding: 16px; border-radius: 12px; margin-top: 12px; border:1px dashed rgba(46,204,113,0.3);">
              <div>
                <div style="font-weight: 800; color: var(--success-color); text-transform:uppercase; letter-spacing:0.5px;">Bénéfice Net Brut</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Avant charges fixes (Loyer, salaires...)</div>
              </div>
              <strong style="font-size: 24px; font-weight:900; color: var(--success-color);">${UI.formatCurrency(totalProfit)}</strong>
            </div>
          </div>
        </div>

        <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:var(--shadow-sm);">
          <h3 style="font-size: 16px; font-weight:700; margin-bottom: 20px; padding-bottom:12px; border-bottom:1px solid var(--border);"><i data-lucide="award" style="vertical-align:text-bottom; margin-right:6px; color:#f1c40f;"></i> Top 5 Produits (En Volume)</h3>
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${getTopProducts(saleItems).map((p, i) => `
              <div style="display: flex; align-items: center; padding: 12px 16px; background: var(--surface-2); border-radius: 12px; border: 1px solid var(--border); transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: ${i===0 ? 'linear-gradient(135deg, #f1c40f, #e67e22)' : i===1 ? 'linear-gradient(135deg, #bdc3c7, #95a5a6)' : i===2 ? 'linear-gradient(135deg, #d35400, #e67e22)' : 'var(--border)'}; color: ${i<3 ? '#fff' : 'inherit'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; margin-right: 16px; box-shadow:0 4px 8px rgba(0,0,0,0.1);">
                  ${i + 1}
                </div>
                <div style="flex: 1; min-width:0;">
                  <div style="font-weight: 600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                </div>
                <div style="background: rgba(41, 128, 185, 0.1); color: #2980b9; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-left:12px;">
                  ${p.qty} vendus
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Rendu des graphiques
    requestAnimationFrame(() => {
      Charts.line('metrics-chart-trend', last7DaysLabels, [{
        data: trendData,
        color: '#0B3D6F' 
      }], { title: '' });

      const donutLabels = ['Coût Achats', 'Bénéfice Brut', 'Remboursements'];
      const donutData = [totalCOGS, Math.max(0, totalProfit), Math.max(0, totalRefunds)];
      const donutColors = ['#0B3D6F', '#0D9B6C', '#D63B3B']; // Palette standard
      
      Charts.donut('metrics-chart-finance',
        donutLabels,
        donutData,
        donutColors
      );
      if (window.lucide) lucide.createIcons();
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

