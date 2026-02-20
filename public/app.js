const state = {
  tab: 'home',
  isLoggedIn: false,
  selectedBroker: 'kiwoom',
  auth: { id: '', password: '', apiKey: '' },
  balance: { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] },
  quote: null,
  selectedStock: null,
  searchItems: [],
  qty: 1,
  side: 'buy'
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
    if (state.tab === 'balance') loadBalance();
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
      <label>API Key(선택/정책필수)<input id="apiInput" value="${state.auth.apiKey}" placeholder="사용자 API Key" /></label>
      <button class="btn-primary" id="loginBtn">로그인</button>
      <p class="muted">로그인 후 하단 탭에서 잔고/주문으로 이동하세요.</p>
    </section>

    <section class="card">
      <h2>증권사</h2>
      <button class="btn-secondary" id="brokerKiwoom">키움증권 사용</button>
    </section>
  `;

  document.getElementById('idInput').addEventListener('input', (e) => (state.auth.id = e.target.value));
  document.getElementById('pwInput').addEventListener('input', (e) => (state.auth.password = e.target.value));
  document.getElementById('apiInput').addEventListener('input', (e) => (state.auth.apiKey = e.target.value));
  document.getElementById('brokerKiwoom').addEventListener('click', () => {
    state.selectedBroker = 'kiwoom';
    setStatus('키움증권 선택됨');
  });
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

    if (!response.ok || !json.ok) {
      showAlert(json.message || '로그인 실패');
      return;
    }

    state.isLoggedIn = true;
    setStatus(`${json.user.id} 님 로그인됨`);
    state.tab = 'balance';
    render();
    loadBalance();
  } catch {
    showAlert('로그인 중 네트워크 오류가 발생했습니다.');
  }
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

  document.getElementById('refreshBalance').addEventListener('click', loadBalance);
}

async function loadBalance() {
  if (!state.isLoggedIn) {
    setStatus('먼저 홈에서 로그인하세요');
    return;
  }

  try {
    const response = await fetch('/api/kiwoom/balance');
    const json = await response.json();

    if (!response.ok || !json.ok) {
      state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
      renderBalance();
      showAlert(json.message || '데이터를 불러올 수 없습니다');
      return;
    }

    state.balance = {
      summary: json.summary || { totalAsset: 0, totalReturnRate: 0 },
      items: Array.isArray(json.items) ? json.items : []
    };

    if (state.tab === 'balance') renderBalance();
  } catch {
    state.balance = { summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] };
    if (state.tab === 'balance') renderBalance();
    showAlert('데이터를 불러올 수 없습니다');
  }
}

function renderOrder() {
  const quoteHtml = state.quote
    ? `
      <div class="card quote-box">
        <div class="muted">${state.selectedStock?.name || ''} (${state.selectedStock?.code || ''})</div>
        <strong>${money(state.quote.currentPrice)}원</strong>
        <div class="${Number(state.quote.changeRate) >= 0 ? 'up' : 'down'}">${state.quote.changeRateText}</div>
      </div>
    `
    : '<p class="muted">종목을 선택하면 현재가/등락률을 보여줍니다.</p>';

  const searchHtml = state.searchItems
    .map(
      (item) =>
        `<button class="search-item" data-code="${item.code}" data-name="${item.name}">${item.name} (${item.code})</button>`
    )
    .join('');

  ui.container.innerHTML = `
    <section class="card">
      <h2>빠른 주문</h2>
      <label>종목 검색<input id="searchInput" placeholder="예: 삼성, 하이닉스, 005930" /></label>
      <div class="search-results">${searchHtml}</div>
      ${quoteHtml}

      <div class="card">
        <label>종목코드<input id="codeInput" value="${state.selectedStock?.code || ''}" placeholder="종목 선택 시 자동입력" /></label>
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
  `;

  document.getElementById('searchInput').addEventListener('input', onSearchInput);

  ui.container.querySelectorAll('.search-item').forEach((button) => {
    button.addEventListener('click', () => {
      const stock = { code: button.dataset.code, name: button.dataset.name };
      state.selectedStock = stock;
      state.searchItems = [];
      loadQuote(stock.code);
    });
  });

  document.getElementById('codeInput').addEventListener('input', (e) => {
    state.selectedStock = { code: e.target.value, name: '선택 종목' };
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
}

let searchTimer = null;
function onSearchInput(event) {
  const q = event.target.value.trim();
  clearTimeout(searchTimer);

  searchTimer = setTimeout(async () => {
    if (!q) {
      state.searchItems = [];
      renderOrder();
      return;
    }

    const response = await fetch(`/api/kiwoom/search?q=${encodeURIComponent(q)}`);
    const json = await response.json();
    state.searchItems = json.items || [];
    renderOrder();
  }, 250);
}

async function loadQuote(code) {
  try {
    const response = await fetch(`/api/kiwoom/quote?code=${encodeURIComponent(code)}`);
    const json = await response.json();

    if (!response.ok || !json.ok) {
      showAlert(json.message || '시세를 불러올 수 없습니다.');
      return;
    }

    state.quote = json.quote;
    renderOrder();
  } catch {
    showAlert('시세를 불러올 수 없습니다.');
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

  try {
    const response = await fetch('/api/kiwoom/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, qty: state.qty, side: state.side })
    });
    const json = await response.json();

    if (!response.ok || !json.ok) {
      showAlert(json.message || '주문에 실패했습니다.');
      return;
    }

    showAlert(json.message || '주문 요청 완료');
  } catch {
    showAlert('주문 요청에 실패했습니다.');
  }
}

render();
