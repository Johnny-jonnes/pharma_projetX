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

        <div class="chart-card dash-panel" style="flex: 1; min-width: 350px; padding: 24px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
          <div class="chart-header" style="margin-bottom: 16px;">
            <h3 class="chart-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;"><i data-lucide="pie-chart" style="color: #3498DB;"></i> Répartition Financière</h3>
          </div>
          <div style="flex: 1; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: relative;">
            <canvas id="custom-giant-donut" width="500" height="300" style="width: 100%; height: 100%; max-height: 280px; object-fit: contain;"></canvas>
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
      
      // Giant Custom Donut Chart (Bypass ui.js limited canvas sizes)
      drawGiantDonut('custom-giant-donut', 
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

function drawGiantDonut(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  
  // Utiliser tout l'espace possible: Rayon énorme, centré sur la gauche / centre
  const total = data.reduce((a, b) => a + b, 0);
  
  // On place le cercle au tiers gauche pour laisser la place à droite pour le texte
  const cx = w * 0.35; 
  const cy = h * 0.50; 
  // Rayon très grand
  const R = Math.min(w * 0.6, h) * 0.45; 
  const r = R * 0.6; // Trou au milieu
  
  ctx.clearRect(0, 0, w, h);
  
  if (total === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui';
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
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(total.toLocaleString('fr-FR'), cx, cy + 8);
  ctx.font = '14px system-ui';
  ctx.fillStyle = UI.getThemeColor('--text-muted') || '#666';
  ctx.fillText('Chiffre brut', cx, cy + 28);
  
  // Legend (Right Side) Large and readable
  labels.forEach((label, i) => {
    const lx = w * 0.75; 
    const ly = (h * 0.30) + (i * 35); // Légende bien espacée et centrée verticalement
    
    // Pastille de couleur plus grande
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(lx - 25, ly - 14, 16, 16, 4);
    ctx.fill();
    
    ctx.fillStyle = UI.getThemeColor('--text') || '#000';
    ctx.font = '600 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(label, lx, ly - 6);
    
    // Pourcentage en dessous
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
    ctx.fillStyle = UI.getThemeColor('--text-muted') || '#666';
    ctx.font = '500 12px system-ui';
    ctx.fillText(`${pct}% - ${data[i].toLocaleString('fr-FR')} FG`, lx, ly + 12);
  });
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

