/**
 * PHARMA_PROJET — Auth & Router
 */

const Auth = {
  async login(username, password) {
    const users = await DB.dbGetAll('users');
    const uInput = String(username || '').trim().toLowerCase();
    const pInput = String(password || '').trim();

    console.log('[Auth] Attempting login for:', uInput);
    console.log('[Auth] Users in database:', users.map(u => ({
      username: u.username,
      pwd_len: String(u.password).length,
      active: u.active
    })));

    const user = users.find(u => {
      const dbUser = String(u.username || '').trim().toLowerCase();
      const dbPass = String(u.password || '').trim();
      return (dbUser === uInput && dbPass === pInput);
    });

    if (!user) {
      console.warn('[Auth] Login failed: Credentials mismatch.');
      return null;
    }
    if (!user.active) {
      console.warn('[Auth] Login failed: Account is inactive.');
      return null;
    }
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
    // Session restoration disabled to force login on every app start as requested
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

    this.routes[name] = renderFn;
    // Auto-refresh if we are on this page and it showed "not found"
    if (this.currentPage === name) {
      const main = document.getElementById('app-content');
      if (main && main.innerHTML.includes('Page introuvable')) {

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
