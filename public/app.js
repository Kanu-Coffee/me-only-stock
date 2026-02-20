const ACCOUNT_STORAGE_KEY = 'me-only-stock:selected-account';
const RECENT_SYMBOLS_KEY = 'me-only-stock:recent-symbols';
const RECENT_SEARCHES_KEY = 'me-only-stock:recent-searches';
const AUTH_TOKEN_KEY = 'me-only-stock:access-token';
const AUTH_USER_ID_KEY = 'me-only-stock:user-id';

const state = {
  tab: 'home',
  isLoggedIn: Boolean(localStorage.getItem(AUTH_TOKEN_KEY)),
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) || '',
  auth: { id: localStorage.getItem(AUTH_USER_ID_KEY) || '', password: '' },
  accounts: [],
  selectedAccountNo: localStorage.getItem(ACCOUNT_STORAGE_KEY) || '',
  balance: { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] },
  quote: null,
  selectedStock: null,
  qty: 1,
  side: 'buy',
  modal: {
    open: false,
    query: '',
    items: [],
    loading: false,
    error: ''
  },
  recentSymbols: JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) || '[]'),
  recentSearches: JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
};

const ui = {
  container: document.getElementById('screenContainer'),
  statusText: document.getElementById('statusText'),
  tabs: Array.from(document.querySelectorAll('.tab-btn'))
};

ui.tabs.forEach((button) => {
  button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    render();
    if (state.tab === 'balance' && state.isLoggedIn) {
      loadAccounts().then(loadBalance);
    }
  });
});

function setStatus(message) {
  ui.statusText.textContent = message;
}

function setTabActive() {
  ui.tabs.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
  });
}

function money(value) {
  return Number(value || 0).toLocaleString();
}

function showAlert(message) {
  window.alert(message);
}

function persistRecentSymbols(next) {
  state.recentSymbols = next.slice(0, 5);
  localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(state.recentSymbols));
}

function persistRecentSearches(query) {
  if (!query) return;
  const deduped = [query, ...state.recentSearches.filter((item) => item !== query)].slice(0, 5);
  state.recentSearches = deduped;
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(deduped));
}

function saveSelectedAccount(accountNo) {
  state.selectedAccountNo = accountNo;
  localStorage.setItem(ACCOUNT_STORAGE_KEY, accountNo);
}

function logoutToHome() {
  state.isLoggedIn = false;
  state.authToken = '';
  state.accounts = [];
  state.selectedAccountNo = '';
  state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
  state.quote = null;
  state.selectedStock = null;
  state.tab = 'home';

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_STORAGE_KEY);

  setStatus('로그인이 필요합니다.');
  render();
}

async function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    logoutToHome();
    throw new Error('UNAUTHORIZED');
  }

  return response;
}

function render() {
  setTabActive();

  if (state.tab === 'home') renderHome();
  if (state.tab === 'balance') renderBalance();
  if (state.tab === 'order') renderOrder();
}

function renderHome() {
  ui.container.innerHTML = `
    <section class="card">
      <h2>앱 로그인</h2>
      <label>아이디<input id="idInput" value="${state.auth.id}" placeholder="아이디" /></label>
      <label>비밀번호<input id="pwInput" type="password" value="${state.auth.password}" placeholder="비밀번호" /></label>
      <button class="btn-primary" id="loginBtn">로그인</button>
      <p class="muted">로그인 후 하단 탭에서 잔고/주문으로 이동하세요.</p>
    </section>
  `;

  document.getElementById('idInput').addEventListener('input', (e) => (state.auth.id = e.target.value));
  document.getElementById('pwInput').addEventListener('input', (e) => (state.auth.password = e.target.value));
  document.getElementById('loginBtn').addEventListener('click', login);
}

async function login() {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.auth)
    });
    const json = await response.json();

    if (!response.ok || !json.ok || !json.accessToken) {
      showAlert(json.message || '로그인 실패');
      return;
    }

    state.isLoggedIn = true;
    state.authToken = json.accessToken;

    localStorage.setItem(AUTH_TOKEN_KEY, json.accessToken);
    localStorage.setItem(AUTH_USER_ID_KEY, json.user.id);

    setStatus(`${json.user.id} 님 로그인됨`);
    state.tab = 'balance';
    render();
    await loadAccounts();
    await loadBalance();
  } catch {
    showAlert('로그인 중 네트워크 오류가 발생했습니다.');
  }
}

function renderAccountSelector() {
  const options = state.accounts
    .map(
      (account) =>
        `<option value="${account.accountNo}" ${account.accountNo === state.selectedAccountNo ? 'selected' : ''}>${account.broker} · ${account.accountNo}</option>`
    )
    .join('');

  return `
    <section class="card">
      <h2>계좌 선택</h2>
      <label>
        잔고 조회 계좌
        <select id="accountSelect" ${!state.accounts.length ? 'disabled' : ''}>
          ${options || '<option value="">사용 가능한 계좌 없음</option>'}
        </select>
      </label>
    </section>
  `;
}

function renderBalance() {
  const itemsHtml = state.balance.items.length
    ? state.balance.items
        .map(
          (item) => `
          <div class="item-row">
            <div>${item.name || item.code}</div>
            <div class="${Number(item.returnRate) >= 0 ? 'up' : 'down'}">${Number(item.returnRate).toFixed(2)}%</div>
            <div class="${Number(item.evalProfitLoss) >= 0 ? 'up' : 'down'}">${money(item.evalProfitLoss)}원</div>
          </div>
        `
        )
        .join('')
    : '<p class="muted">보유 종목이 없습니다.</p>';

  ui.container.innerHTML = `
    ${renderAccountSelector()}
    <section class="summary">
      <article class="card">
        <span>총 자산</span>
        <strong>${money(state.balance.summary.totalAsset)}원</strong>
      </article>
      <article class="card">
        <span>총 수익률</span>
        <strong class="${Number(state.balance.summary.totalReturnRate) >= 0 ? 'up' : 'down'}">${Number(
    state.balance.summary.totalReturnRate
  ).toFixed(2)}%</strong>
      </article>
    </section>

    <section class="card">
      <h2>보유 종목</h2>
      ${itemsHtml}
      <button class="btn-secondary" id="refreshBalance">새로고침</button>
    </section>
  `;

  const accountSelect = document.getElementById('accountSelect');
  if (accountSelect) {
    accountSelect.addEventListener('change', async (event) => {
      saveSelectedAccount(event.target.value);
      await loadBalance();
    });
  }

  document.getElementById('refreshBalance').addEventListener('click', loadBalance);
}

async function loadAccounts() {
  if (!state.isLoggedIn) return;

  try {
    const response = await authFetch('/api/accounts');
    const json = await response.json();

    if (!response.ok || !json.ok) {
      showAlert(json.message || '계좌 목록을 불러오지 못했습니다.');
      return;
    }

    state.accounts = Array.isArray(json.accounts) ? json.accounts : [];

    if (!state.accounts.find((account) => account.accountNo === state.selectedAccountNo)) {
      const fallback = state.accounts[0]?.accountNo || '';
      saveSelectedAccount(fallback);
    }

    if (state.tab === 'balance') {
      renderBalance();
    }
  } catch (error) {
    if (error.message !== 'UNAUTHORIZED') {
      showAlert('계좌 목록을 불러오지 못했습니다.');
    }
  }
}

async function loadBalance() {
  if (!state.isLoggedIn) {
    setStatus('먼저 홈에서 로그인하세요');
    return;
  }

  if (!state.selectedAccountNo) {
    state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
    if (state.tab === 'balance') renderBalance();
    return;
  }

  try {
    const response = await authFetch(`/api/balance?accountNo=${encodeURIComponent(state.selectedAccountNo)}`);
    const json = await response.json();

    if (!response.ok || !json.ok) {
      state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
      if (state.tab === 'balance') renderBalance();
      showAlert(json.message || '데이터를 불러올 수 없습니다');
      return;
    }

    state.balance = {
      summary: json.summary || { totalAsset: 0, totalReturnRate: 0 },
      items: Array.isArray(json.items) ? json.items : []
    };

    if (state.tab === 'balance') renderBalance();
  } catch (error) {
    state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
    if (state.tab === 'balance') renderBalance();

    if (error.message !== 'UNAUTHORIZED') {
      showAlert('데이터를 불러올 수 없습니다');
    }
  }
}

function renderRecentList() {
  const recentSymbols = state.recentSymbols
    .map((item) => `<button class="search-item" data-code="${item.code}" data-name="${item.name}">${item.name}</button>`)
    .join('');
  const recentSearches = state.recentSearches
    .map((query) => `<button class="tag-btn" data-query="${query}">${query}</button>`)
    .join('');

  return `
    <div class="recent-block">
      <h4>최근 검색어</h4>
      <div class="tag-list">${recentSearches || '<span class="muted">없음</span>'}</div>
      <h4>최근 선택 종목</h4>
      <div class="search-results">${recentSymbols || '<span class="muted">없음</span>'}</div>
    </div>
  `;
}

function renderSearchModal() {
  if (!state.modal.open) return '';

  const listHtml = state.modal.items.length
    ? state.modal.items
        .map((item) => `<button class="search-item" data-code="${item.code}" data-name="${item.name}">${item.name}</button>`)
        .join('')
    : '<p class="muted">검색 결과가 없습니다.</p>';

  return `
    <div class="modal-backdrop" id="searchModalBackdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>종목 검색</h3>
          <button class="icon-btn" id="closeSearchModal">닫기</button>
        </div>
        <label>
          종목명
          <input id="modalSearchInput" placeholder="예: 삼성전자" value="${state.modal.query}" />
        </label>
        <div class="modal-actions">
          <button class="btn-primary" id="modalSearchBtn">검색</button>
        </div>
        ${renderRecentList()}
        ${state.modal.loading ? '<p class="muted">검색 중...</p>' : ''}
        ${state.modal.error ? `<p class="error">${state.modal.error}</p>` : ''}
        <div class="search-results">${listHtml}</div>
      </div>
    </div>
  `;
}

function renderOrder() {
  const quoteHtml = state.quote
    ? `
      <div class="card quote-box">
        <div class="muted">${state.selectedStock?.name || ''}</div>
        <strong>${money(state.quote.currentPrice)}원</strong>
        <div class="${Number(state.quote.changeRate) >= 0 ? 'up' : 'down'}">${state.quote.changeRateText}</div>
      </div>
    `
    : '<p class="muted">종목 검색에서 종목명을 선택하세요.</p>';

  ui.container.innerHTML = `
    <section class="card">
      <h2>빠른 주문</h2>
      <label>주문 계좌
        <select id="orderAccountSelect" ${!state.accounts.length ? 'disabled' : ''}>
          ${state.accounts
            .map(
              (account) =>
                `<option value="${account.accountNo}" ${account.accountNo === state.selectedAccountNo ? 'selected' : ''}>${account.broker} · ${account.accountNo}</option>`
            )
            .join('')}
        </select>
      </label>
      <div class="selected-stock-box">
        <div>
          <div class="muted">선택 종목</div>
          <strong>${state.selectedStock?.name || '선택 안됨'}</strong>
        </div>
        <button class="btn-secondary" id="openSearchModal">종목 검색</button>
      </div>
      ${quoteHtml}

      <div class="card">
        <div class="qty">
          <button id="qtyMinus">-</button>
          <div>${state.qty}주</div>
          <button id="qtyPlus">+</button>
        </div>
        <div class="order-actions">
          <button class="${state.side === 'buy' ? 'btn-primary' : 'btn-secondary'}" id="buyBtn">매수</button>
          <button class="${state.side === 'sell' ? 'btn-danger' : 'btn-secondary'}" id="sellBtn">매도</button>
        </div>
        <button class="btn-primary" id="orderBtn">시장가 즉시 주문</button>
      </div>
    </section>
    ${renderSearchModal()}
  `;

  const orderAccountSelect = document.getElementById('orderAccountSelect');
  if (orderAccountSelect) {
    orderAccountSelect.addEventListener('change', (event) => {
      saveSelectedAccount(event.target.value);
    });
  }

  document.getElementById('openSearchModal').addEventListener('click', () => {
    state.modal.open = true;
    state.modal.items = [];
    state.modal.error = '';
    renderOrder();
    bindModalEvents();
  });

  document.getElementById('qtyMinus').addEventListener('click', () => {
    state.qty = Math.max(1, state.qty - 1);
    renderOrder();
  });

  document.getElementById('qtyPlus').addEventListener('click', () => {
    state.qty += 1;
    renderOrder();
  });

  document.getElementById('buyBtn').addEventListener('click', () => {
    state.side = 'buy';
    renderOrder();
  });

  document.getElementById('sellBtn').addEventListener('click', () => {
    state.side = 'sell';
    renderOrder();
  });

  document.getElementById('orderBtn').addEventListener('click', placeOrder);

  if (state.modal.open) {
    bindModalEvents();
  }
}

function bindModalEvents() {
  document.getElementById('closeSearchModal')?.addEventListener('click', () => {
    state.modal.open = false;
    renderOrder();
  });

  document.getElementById('searchModalBackdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'searchModalBackdrop') {
      state.modal.open = false;
      renderOrder();
    }
  });

  const searchInput = document.getElementById('modalSearchInput');
  const searchButton = document.getElementById('modalSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.modal.query = event.target.value;
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchSymbols();
      }
    });
  }

  searchButton?.addEventListener('click', searchSymbols);

  ui.container.querySelectorAll('.search-item').forEach((button) => {
    button.addEventListener('click', async () => {
      const stock = { code: button.dataset.code, name: button.dataset.name };
      state.selectedStock = stock;
      persistRecentSymbols([stock, ...state.recentSymbols.filter((item) => item.code !== stock.code)]);
      state.modal.open = false;
      state.modal.items = [];
      await loadQuote(stock.code);
    });
  });

  ui.container.querySelectorAll('.tag-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.modal.query = button.dataset.query;
      searchSymbols();
    });
  });
}

async function searchSymbols() {
  const query = state.modal.query.trim();
  if (!query) {
    state.modal.items = [];
    state.modal.error = '종목명을 입력하세요.';
    renderOrder();
    return;
  }

  state.modal.loading = true;
  state.modal.error = '';
  renderOrder();

  try {
    const response = await authFetch(`/api/symbols?query=${encodeURIComponent(query)}`);
    const items = await response.json();
    state.modal.items = Array.isArray(items) ? items : [];
    persistRecentSearches(query);
  } catch (error) {
    state.modal.items = [];
    if (error.message !== 'UNAUTHORIZED') {
      state.modal.error = '검색에 실패했습니다.';
    }
  } finally {
    state.modal.loading = false;
    renderOrder();
  }
}

async function loadQuote(code) {
  try {
    const response = await authFetch(`/api/quote?code=${encodeURIComponent(code)}`);
    const json = await response.json();

    if (!response.ok || !json.ok) {
      showAlert(json.message || '시세를 불러올 수 없습니다.');
      return;
    }

    state.quote = json.quote;
    renderOrder();
  } catch (error) {
    if (error.message !== 'UNAUTHORIZED') {
      showAlert('시세를 불러올 수 없습니다.');
    }
  }
}

async function placeOrder() {
  if (!state.isLoggedIn) {
    showAlert('먼저 로그인하세요.');
    return;
  }

  const symbol = state.selectedStock?.code;
  if (!symbol) {
    showAlert('종목을 먼저 선택하세요.');
    return;
  }

  if (!state.selectedAccountNo) {
    showAlert('주문 계좌를 선택하세요.');
    return;
  }

  try {
    const response = await authFetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, qty: state.qty, side: state.side, accountNo: state.selectedAccountNo })
    });
    const json = await response.json();

    if (!response.ok || !json.ok) {
      showAlert(json.message || '주문에 실패했습니다.');
      return;
    }

    showAlert(json.message || '주문 요청 완료');
  } catch (error) {
    if (error.message !== 'UNAUTHORIZED') {
      showAlert('주문 요청에 실패했습니다.');
    }
  }
}

render();

if (state.isLoggedIn) {
  setStatus('자동 로그인 상태입니다.');
  state.tab = 'balance';
  render();
  loadAccounts().then(loadBalance);
}
