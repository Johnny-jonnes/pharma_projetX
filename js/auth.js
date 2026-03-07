/**
 * PHARMA_PROJET — Auth & Router
 */

const Auth = {
  async login(username, password) {
    const users = await DB.dbGetAll('users');
    const user = users.find(u => u.username === username && u.password === password && u.active);
    if (!user) return null;
    const session = { id: 'session_' + Date.now(), userId: user.id, username: user.username, role: user.role, name: user.name, loginTime: Date.now() };
    await DB.dbPut('sessions', session);
    DB.AppState.currentUser = { ...user, sessionId: session.id };
    await DB.writeAudit('LOGIN', 'session', session.id, { username }, user.id);
    setTimeout(() => { if (typeof AlertsEngine !== 'undefined') AlertsEngine.start(); if (typeof updateAlertBadge !== 'undefined') updateAlertBadge(); }, 1500);
    return DB.AppState.currentUser;
  },

  async logout() {
    if (DB.AppState.currentUser) {
      await DB.writeAudit('LOGOUT', 'session', null, {}, DB.AppState.currentUser.id);
    }
    DB.AppState.currentUser = null;
    Router.navigate('login');
  },

  async checkSession() {
    // Simple session check via AppState
    return DB.AppState.currentUser;
  },

  async restoreSession() {
    try {
      const sessions = await DB.dbGetAll('sessions');
      if (sessions.length > 0) {
        // Get the most recent session
        const lastSession = sessions.sort((a, b) => b.loginTime - a.loginTime)[0];
        // Session valid for 24 hours
        if (Date.now() - lastSession.loginTime < 24 * 60 * 60 * 1000) {
          DB.AppState.currentUser = {
            id: lastSession.userId,
            username: lastSession.username,
            role: lastSession.role,
            name: lastSession.name,
            sessionId: lastSession.id
          };
          console.log('[Auth] Session restored for:', lastSession.username);
          return DB.AppState.currentUser;
        }
      }
    } catch (e) {
      console.warn('[Auth] Session restoration failed:', e);
    }
    return null;
  },

  can(action) {
    const user = DB.AppState.currentUser;
    if (!user) return false;
    const perms = {
      admin: ['*'],
      pharmacien: ['view_all', 'sell', 'validate_prescription', 'manage_stock', 'view_reports', 'manage_orders', 'view_finance', 'destroy_medicine'],
      caissier: ['sell', 'view_products', 'view_stock_readonly'],
    };
    const userPerms = perms[user.role] || [];
    return userPerms.includes('*') || userPerms.includes(action);
  }
};

const Router = {
  routes: {},
  currentPage: null,

  register(name, renderFn) {
    console.log('[Router] Registering route:', name);
    this.routes[name] = renderFn;
    // Auto-refresh if we are on this page and it showed "not found"
    if (this.currentPage === name) {
      const main = document.getElementById('app-content');
      if (main && main.innerHTML.includes('Page introuvable')) {
        console.log('[Router] Auto-refreshing page now available:', name);
        this.render(name);
      }
    }
  },

  navigate(page, params = {}) {
    if (!DB.AppState.currentUser && page !== 'login' && page !== 'onboarding') {
      page = 'login';
    }
    this.currentPage = page;
    DB.AppState.currentPage = page;
    this.render(page, params);
    this.updateNav(page);
  },

  render(page, params) {
    const main = document.getElementById('app-content');
    if (!main) return;
    const fn = this.routes[page];
    if (fn) {
      main.innerHTML = '';
      fn(main, params);
    } else {
      main.innerHTML = `<div class="empty-state"><h2>Page introuvable : ${page}</h2></div>`;
    }
  },

  updateNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }
};

window.Auth = Auth;
window.Router = Router;
