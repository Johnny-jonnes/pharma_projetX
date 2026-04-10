/**
 * PHARMA_PROJET — UI Utilities
 */

const UI = {
  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', minimumFractionDigits: 0 }).format(amount || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  daysUntilExpiry(dateStr) {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  },

  expiryBadge(dateStr) {
    const days = this.daysUntilExpiry(dateStr);
    if (days === null) return '';
    if (days < 0) return `<span class="badge badge-danger">Expiré</span>`;
    if (days <= 30) return `<span class="badge badge-danger">J-${days}</span>`;
    if (days <= 90) return `<span class="badge badge-warning">J-${days}</span>`;
    return `<span class="badge badge-success">${this.formatDate(dateStr)}</span>`;
  },

  stockBadge(qty, minStock) {
    if (qty === 0) return `<span class="badge badge-danger">Rupture</span>`;
    if (qty <= minStock) return `<span class="badge badge-warning">${qty} (bas)</span>`;
    return `<span class="badge badge-success">${qty}</span>`;
  },

  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    toast.innerHTML = `<span class="toast-icon"><i data-lucide="${icons[type] || 'info'}"></i></span><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ props: { size: 18 } });
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box confirm-box">
          <div class="modal-icon"><i data-lucide="alert-triangle"></i></div>
          <p class="modal-msg">${message}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="confirm-no">Annuler</button>
            <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons();
      document.getElementById('confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
      document.getElementById('confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    });
  },

  modal(title, contentHTML, options = {}) {
    const existing = document.getElementById('global-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'global-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box ${options.size === 'large' ? 'modal-large' : ''}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">${contentHTML}</div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    document.getElementById('modal-close-btn').onclick = () => overlay.remove();
    if (options.onClose) overlay.addEventListener('click', e => { if (e.target === overlay) options.onClose(); });
    return overlay;
  },

  closeModal() {
    const m = document.getElementById('global-modal');
    if (m) m.remove();
  },

  loading(container, message = 'Chargement...') {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${message}</p></div>`;
  },

  empty(container, message = 'Aucune donnée', icon = 'package') {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="${icon}"></i></div><p>${message}</p></div>`;
    if (window.lucide) lucide.createIcons();
  },

  table(container, columns, rows, options = {}) {
    if (!rows.length) {
      this.empty(container, options.emptyMessage || 'Aucun résultat', options.emptyIcon);
      return;
    }
    const thead = columns.map(c => `<th>${c.label}</th>`).join('');
    const tbody = rows.map((row, ri) => {
      const cells = columns.map(c => {
        const val = typeof c.render === 'function' ? c.render(row, ri) : (row[c.key] ?? '—');
        // data-label pour le card-view mobile (CSS ::before { content: attr(data-label) })
        // Si pas de label (ex: colonne d'actions), data-label="" masque le pseudo-élément
        const label = c.label || '';
        return `<td data-label="${label}">${val}</td>`;
      }).join('');
      return `<tr ${options.onRowClick ? `class="clickable" data-idx="${ri}"` : ''}>${cells}</tr>`;
    }).join('');

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.innerHTML = `
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>`;
    container.innerHTML = '';
    container.appendChild(wrapper);

    if (options.onRowClick) {
      wrapper.querySelectorAll('tr[data-idx]').forEach(tr => {
        tr.onclick = () => options.onRowClick(rows[parseInt(tr.dataset.idx)]);
      });
    }
    if (window.lucide) lucide.createIcons();
  },

  paymentMethodBadge(method) {
    const m = { cash: ['banknote', 'Espèces', 'badge-neutral'], orange_money: ['smartphone', 'Orange Money', 'badge-orange'], mtn_momo: ['smartphone', 'MTN MoMo', 'badge-yellow'], credit: ['file-clock', 'Crédit', 'badge-warning'], transfer: ['building-2', 'Virement', 'badge-info'] };
    const [icon, label, cls] = m[method] || ['help-circle', method, 'badge-neutral'];
    return `<span class="badge ${cls}"><i data-lucide="${icon}" style="width:12px;height:12px;margin-right:4px"></i> ${label}</span>`;
  },

  roleBadge(role) {
    const r = { admin: ['shield-alert', 'Administrateur', 'badge-danger'], pharmacien: ['user-check', 'Pharmacien', 'badge-success'], caissier: ['user', 'Caissier', 'badge-info'] };
    const [icon, label, cls] = r[role] || ['help-circle', role, 'badge-neutral'];
    return `<span class="badge ${cls}"><i data-lucide="${icon}" style="width:12px;height:12px;margin-right:4px"></i> ${label}</span>`;
  },

  /* ── Master Theme Management (Dark Mode) ── */
  initTheme() {
    const saved = localStorage.getItem('pharma-theme') || 'light';
    this.setTheme(saved);
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pharma-theme', theme);
    // Notify charts to re-render if needed
    window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme } }));
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    this.setTheme(current === 'light' ? 'dark' : 'light');
  },

  getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  },

  // ── Sync Monitoring ──
  async openSyncMonitor() {
    const modal = document.getElementById('sync-monitor-modal');
    const list = document.getElementById('sync-monitor-list');
    document.getElementById('current-device-id-display').textContent = 'Votre ID : ' + (AppState.deviceId || 'Inconnu');
    
    // UI Loading state
    list.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div><p>Analyse du réseau...</p></div>';
    modal.style.display = 'flex';

    if (!navigator.onLine) {
        list.innerHTML = '<div class="alert alert-warning">Vous êtes actuellement hors ligne. Impossible de voir les autres appareils.</div>';
        return;
    }

    try {
        const sb = await getSupabaseClient();
        if (!sb) throw new Error('Supabase déconnecté');

        const { data, error } = await sb.from('settings').select('value').like('key', 'device_status_%');
        if (error) throw error;

        let html = '';
        let hasAlerts = false;
        
        data.forEach(row => {
            try {
                const status = JSON.parse(row.value);
                const isCurrent = status.name === AppState.deviceName;
                const isOnline = status.online && (Date.now() - status.last_sync < 60 * 60 * 1000); // Online if synced in last hour
                const hasPending = status.pending > 0;
                
                if (hasPending && !isCurrent) hasAlerts = true;

                const statusColor = hasPending ? 'var(--warning)' : (isOnline ? 'var(--success)' : 'var(--text-muted)');
                const statusIcon = hasPending ? 'alert-triangle' : (isOnline ? 'check-circle' : 'clock');
                const lastSyncDate = new Date(status.last_sync).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                });

                html += \`
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 8px; border-left: 4px solid \${statusColor};">
                   <div style="display:flex; align-items:center; gap: 10px;">
                      <i data-lucide="monitor" style="color: \${isOnline ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                      <div>
                         <div style="font-weight:600;">\${status.name} \${isCurrent ? '<span class="badge badge-info" style="font-size:0.7em;">(Cet Appareil)</span>' : ''}</div>
                         <div style="font-size:0.8rem; color:var(--text-muted);">Dernier contact : \${lastSyncDate}</div>
                      </div>
                   </div>
                   <div style="display:flex; flex-direction:column; align-items:flex-end; gap: 4px;">
                      <span class="badge" style="background: \${statusColor}; color: white; display:flex; align-items:center; gap:4px;">
                         <i data-lucide="\${statusIcon}" style="width:14px;height:14px;"></i> 
                         \${hasPending ? status.pending + ' En Attente' : (isOnline ? 'Synchronisé' : 'Hors Ligne')}
                      </span>
                   </div>
                </div>\`;
            } catch(e) {}
        });

        if (html === '') {
            html = '<div style="text-align:center; padding:20px;">Aucun périphérique trouvé sur le réseau.</div>';
        }

        list.innerHTML = html;
        if (window.lucide) lucide.createIcons({ root: list });

        // Update badge
        const badge = document.getElementById('device-sync-badge');
        const icon = document.getElementById('device-sync-icon');
        if (badge && icon) {
           icon.style.color = hasAlerts ? 'var(--warning)' : 'var(--success)';
           badge.style.display = hasAlerts ? 'inline-block' : 'none';
        }

    } catch (e) {
        list.innerHTML = \`<div class="alert alert-danger">Erreur réseau: \${e.message}</div>\`;
    }
  }
};

window.addEventListener('themechanged', () => {
  if (window.Router && Router.currentPage) {
    Router.render(Router.currentPage);
  }
});

// Chart utilities
const Charts = {
  bar(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const maxVal = Math.max(...datasets.flatMap(d => d.data));
    const w = canvas.width, h = canvas.height;
    const pad = { top: 50, right: 20, bottom: 50, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

    const barW = Math.floor(chartW / labels.length * 0.6);
    const gap = chartW / labels.length;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + chartH - (i / 5) * chartH;
      ctx.strokeStyle = UI.getThemeColor('--border');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 5).toLocaleString('fr-FR'), pad.left - 8, y + 4);
    }

    // Bars
    datasets.forEach((dataset, di) => {
      const color = dataset.color || `hsl(${200 + di * 40}, 70%, 55%)`;
      dataset.data.forEach((val, i) => {
        const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
        const x = pad.left + gap * i + gap * 0.2 + di * (barW / datasets.length);
        const y = pad.top + chartH - barH;

        const grad = ctx.createLinearGradient(0, y, 0, pad.top + chartH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW / datasets.length - 2, barH, 3);
        ctx.fill();
      });
    });

    // Labels
    labels.forEach((label, i) => {
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      const x = pad.left + gap * i + gap * 0.5;
      ctx.fillText(label.length > 8 ? label.substring(0, 8) + '..' : label, x, h - 10);
    });

    // Title
    if (options.title) {
      ctx.fillStyle = UI.getThemeColor('--text');
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.title, w / 2, 18);
    }
  },

  donut(canvasId, labels, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w * 0.38, cy = h * 0.45; // Décentrer à gauche
    const R = Math.min(w, h) * 0.35; // Rayon optimal
    const r = R * 0.6;
    const total = data.reduce((a, b) => a + b, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

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
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      startAngle += slice;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = UI.getThemeColor('--surface'); // Match background
    ctx.fill();

    // Center text
    ctx.fillStyle = UI.getThemeColor('--text');
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(total.toLocaleString('fr-FR'), cx, cy + 5);
    ctx.font = '11px system-ui';
    ctx.fillStyle = UI.getThemeColor('--text-muted');
    ctx.fillText('Total', cx, cy + 20);

    // Legend (bottom)
    const legY = h - (Math.ceil(labels.length / 2) * 20) - 5;
    labels.forEach((label, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const lx = col === 0 ? w * 0.72 : w * 0.72; // Colonne unique à droite ou ajustée
      const ly = (h * 0.15) + i * 22; // Légende verticale à droite
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(lx, ly - 9, 10, 10, 2);
      ctx.fill();
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '500 10px system-ui';
      ctx.textAlign = 'left';
      const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
      ctx.fillText(`${label.substring(0, 15)} (${pct}%)`, lx + 15, ly);
    });
  },

  line(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const pad = { top: 50, right: 20, bottom: 45, left: 65 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const allVals = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

    // Grid
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + chartH - (i / 5) * chartH;
      ctx.strokeStyle = UI.getThemeColor('--border');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 5).toLocaleString('fr-FR'), pad.left - 6, y + 3);
    }

    datasets.forEach((dataset, di) => {
      const color = dataset.color || `hsl(${180 + di * 60}, 70%, 50%)`;
      const points = dataset.data.map((val, i) => ({
        x: pad.left + (i / (labels.length - 1)) * chartW,
        y: pad.top + chartH - (val / maxVal) * chartH
      }));

      // Area fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.top + chartH);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
      ctx.closePath();
      ctx.fillStyle = color + '22';
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p, i) => {
        if (i > 0) {
          const cp = { x: (points[i - 1].x + p.x) / 2, y: (points[i - 1].y + p.y) / 2 };
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cp.x, cp.y);
        }
      });
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Points
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // X labels
    labels.forEach((label, i) => {
      const x = pad.left + (i / (labels.length - 1)) * chartW;
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, h - 8);
    });

    if (options.title) {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.title, w / 2, 18);
    }
  }
};

window.UI = UI;
window.Charts = Charts;
