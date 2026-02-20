import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { parseKiwoomExpiresDt, shouldReuseToken } from './server/kiwoom/tokenManager.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3259);
const KIWOOM_BASE_URL = process.env.KIWOOM_BASE_URL || 'https://api.kiwoom.com';
const JWT_SECRET = process.env.JWT_SECRET || '';

const STOCK_MASTER = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '051910', name: 'LG화학', market: 'KOSPI' },
  { code: '032830', name: '삼성생명', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' }
];

const tokenCacheByUser = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('public')));

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('public')));

function ensureKiwoomEnv() {
  if (!KIWOOM_APPKEY || !KIWOOM_SECRETKEY) {
    throw new Error('KIWOOM_APPKEY, KIWOOM_SECRETKEY 환경변수를 설정하세요.');
  }
}

function getLoginUsers() {
  const users = [];

  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON);
      if (Array.isArray(parsed)) {
        parsed.forEach((user) => {
          if (user?.id && user?.password) {
            users.push({
              id: String(user.id),
              password: String(user.password),
              appkey: String(user.appkey || user.appKey || ''),
              secretkey: String(user.secretkey || user.secretKey || ''),
              account: String(user.account || user.accountNo || '')
            });
          }
        });
      }
    } catch {
      throw new Error('APP_USERS_JSON 값이 올바른 JSON 배열이 아닙니다.');
    }
  }

  for (let i = 1; i <= 20; i += 1) {
    const id = process.env[`APP_USER_${i}_ID`];
    const password = process.env[`APP_USER_${i}_PW`];
    if (!id || !password) continue;

    users.push({
      id,
      password,
      appkey: process.env[`APP_USER_${i}_APPKEY`] || '',
      secretkey: process.env[`APP_USER_${i}_SECRETKEY`] || '',
      account: process.env[`APP_USER_${i}_ACCOUNT`] || ''
    });
  }

  if (process.env.USER_ID && process.env.USER_PW) {
    users.push({
      id: process.env.USER_ID,
      password: process.env.USER_PW,
      appkey: process.env.KIWOOM_APPKEY || '',
      secretkey: process.env.KIWOOM_SECRETKEY || '',
      account: process.env.KIWOOM_ACCOUNT || ''
    });
  }

  return users;
}

function getUserById(userId) {
  return getLoginUsers().find((user) => user.id === userId) || null;
}

function resolveKiwoomCreds(userId) {
  const user = getUserById(userId);
  if (!user) throw new Error('사용자를 찾을 수 없습니다.');

  const appkey = user.appkey || process.env.KIWOOM_APPKEY || '';
  const secretkey = user.secretkey || process.env.KIWOOM_SECRETKEY || '';

  if (!appkey || !secretkey) {
    throw new Error('사용자 Kiwoom 키가 설정되지 않았습니다.');
  }

  return {
    appkey,
    secretkey,
    defaultAccount: user.account || process.env.KIWOOM_ACCOUNT || ''
  };
}

function getTokenCache(userId) {
  if (!tokenCacheByUser.has(userId)) {
    tokenCacheByUser.set(userId, {
      token: null,
      expiresAtMs: 0,
      inFlightPromise: null
    });
  }

  return tokenCacheByUser.get(userId);
}

async function issueToken(userId) {
  const { appkey, secretkey } = resolveKiwoomCreds(userId);

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/oauth2/token`,
    {
      granttype: 'clientcredentials',
      appkey,
      secretkey
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-id': 'au10001'
      },
      timeout: 10000
    }
  );

  const token = response.data?.token;
  const expiresAtMs = parseKiwoomExpiresDt(response.data?.expiresdt);

  if (!token) {
    throw new Error('Kiwoom 토큰 발급 실패: token이 없습니다.');
  }

  const cache = getTokenCache(userId);
  cache.token = token;
  cache.expiresAtMs = expiresAtMs || Date.now() + 50 * 60 * 1000;

  return token;
}

async function getAccessToken(userId, forceRefresh = false) {
  const cache = getTokenCache(userId);
  const now = Date.now();

  if (!forceRefresh && shouldReuseToken(cache, now)) {
    return cache.token;
  }

  if (!forceRefresh && cache.inFlightPromise) {
    return cache.inFlightPromise;
  }

  cache.inFlightPromise = issueToken(userId).finally(() => {
    cache.inFlightPromise = null;
  });

  return cache.inFlightPromise;
}

function isAuthError(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return true;

  const code = String(error?.response?.data?.return_code || error?.response?.data?.code || '').toLowerCase();
  const msg = String(error?.response?.data?.msg1 || error?.response?.data?.message || '').toLowerCase();
  return code.includes('auth') || msg.includes('token') || msg.includes('인증');
}

async function callKiwoom(userId, config, retryOnAuthError = true) {
  try {
    const token = await getAccessToken(userId, false);
    const response = await axios({
      ...config,
      baseURL: KIWOOM_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    return response;
  } catch (error) {
    if (retryOnAuthError && isAuthError(error)) {
      await getAccessToken(userId, true);
      return callKiwoom(userId, config, false);
    }
    throw error;
  }
}

function normalizeBalancePayload(raw) {
  const summary = raw?.output || raw?.summary || {};
  const list = raw?.output1 || raw?.items || [];

  return {
    summary: {
      totalAsset: Number(summary.total_asset || summary.totalAsset || 0),
      totalReturnRate: Number(summary.total_return_rate || summary.totalReturnRate || 0)
    },
    items: Array.isArray(list)
      ? list.map((row) => ({
          code: row.pdno || row.code || '',
          name: row.prdt_name || row.name || '',
          returnRate: Number(row.evlu_erng_rt || row.returnRate || 0),
          evalProfitLoss: Number(row.evlu_pfls_amt || row.evalProfitLoss || 0),
          qty: Number(row.hldg_qty || row.qty || 0),
          avgPrice: Number(row.pchs_avg_pric || row.avgPrice || 0)
        }))
      : []
  };
}

function createJwt(userId) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 환경변수를 설정하세요.');
  }

  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, message: '인증이 필요합니다.' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ ok: false, message: '서버 인증 설정이 누락되었습니다.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = String(payload.userId || '');

    if (!req.userId) {
      return res.status(401).json({ ok: false, message: '인증이 유효하지 않습니다.' });
    }

    return next();
  } catch {
    return res.status(401).json({ ok: false, message: '인증이 만료되었거나 유효하지 않습니다.' });
  }
}

app.post('/api/auth/login', (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) {
      return res.status(400).json({ ok: false, message: '아이디/비밀번호를 입력하세요.' });
    }

    const users = getLoginUsers();
    if (!users.length) {
      return res.status(500).json({ ok: false, message: '서버 로그인 계정 설정이 없습니다.' });
    }

    const found = users.find((user) => user.id === id && user.password === password);

    if (!found) {
      return res.status(401).json({ ok: false, message: '로그인 정보가 올바르지 않습니다.' });
    }

    resolveKiwoomCreds(found.id);

    const accessToken = createJwt(found.id);

    return res.json({ ok: true, user: { id: found.id }, accessToken });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || '로그인 처리 실패' });
  }
});

app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') {
    return next();
  }
  return requireAuth(req, res, next);
});

app.get('/api/symbols', (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase();
  if (!query) return res.json([]);

  const items = STOCK_MASTER
    .filter((item) => item.name.toLowerCase().includes(query))
    .slice(0, 20)
    .map((item) => ({ name: item.name, code: item.code }));

  return res.json(items);
});

app.get('/api/accounts', async (req, res) => {
  try {
    const { defaultAccount } = resolveKiwoomCreds(req.userId);

    const response = await callKiwoom(req.userId, {
      method: 'POST',
      url: '/api/dostk/acnt',
      headers: { 'api-id': 'ka00001' },
      data: {}
    });

    const raw = response.data;
    const list = [];

    const candidates = [raw?.output, raw?.output1, raw?.acntList, raw?.items].filter(Array.isArray);
    candidates.forEach((rows) => {
      rows.forEach((row) => {
        const acctNo = String(row?.acctNo || row?.acnt_no || row?.accountNo || '').trim();
        if (!acctNo) return;
        const broker = String(row?.brkNm || row?.broker || '키움증권').trim();
        if (!list.some((item) => item.accountNo === acctNo)) {
          list.push({ accountNo: acctNo, broker });
        }
      });
    });

    if (!list.length && defaultAccount) {
      list.push({ accountNo: defaultAccount, broker: '키움증권' });
    }

    return res.json({ ok: true, accounts: list });
  } catch {
    try {
      const { defaultAccount } = resolveKiwoomCreds(req.userId);
      if (defaultAccount) {
        return res.json({ ok: true, accounts: [{ accountNo: defaultAccount, broker: '키움증권' }] });
      }
    } catch {
      // noop
    }

    return res.status(502).json({ ok: false, message: '계좌 목록을 불러오지 못했습니다.', accounts: [] });
  }
});

app.get('/api/quote', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, message: '종목코드가 필요합니다.' });

    const response = await callKiwoom(req.userId, {
      method: 'GET',
      url: '/uapi/domestic-stock/v1/quotations/inquire-price',
      headers: { 'api-id': 'ka10002' },
      params: {
        fid_cond_mrkt_div_code: 'J',
        fid_input_iscd: code
      }
    });

    const out = response.data?.output || {};
    const currentPrice = Number(out.stck_prpr || out.cur_prc || out.current_price || 0);
    const changeRate = Number(out.prdy_ctrt || out.fltt_rt || out.change_rate || 0);
    const sign = changeRate >= 0 ? '+' : '';

    return res.json({
      ok: true,
      quote: {
        code,
        currentPrice,
        changeRate,
        changeRateText: `${sign}${changeRate.toFixed(2)}%`
      }
    });
  } catch {
    return res.status(502).json({ ok: false, message: '시세를 불러올 수 없습니다.' });
  }
});

app.get('/api/balance', async (req, res) => {
  try {
    const accountNo = String(req.query.accountNo || '').trim();
    if (!accountNo) {
      return res.status(400).json({ ok: false, message: '계좌번호를 선택하세요.', summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] });
    }

    const response = await callKiwoom(req.userId, {
      method: 'POST',
      url: '/uapi/domestic-stock/v1/trading/inquire-balance',
      headers: { 'api-id': 'ka01690' },
      data: {
        account_no: accountNo,
        cont_yn: 'N',
        next_key: ''
      }
    });

    const normalized = normalizeBalancePayload(response.data);

    return res.json({ ok: true, summary: normalized.summary, items: normalized.items });
  } catch {
    return res.status(502).json({
      ok: false,
      message: '데이터를 불러올 수 없습니다',
      summary: { totalAsset: 0, totalReturnRate: 0 },
      items: []
    });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const { symbol, qty, side, accountNo } = req.body || {};
    if (!symbol || !qty || !side || !accountNo) {
      return res.status(400).json({ ok: false, message: '주문 파라미터가 부족합니다.' });
    }

    const response = await callKiwoom(req.userId, {
      method: 'POST',
      url: '/uapi/domestic-stock/v1/trading/order-cash',
      headers: { 'api-id': 'kt10000' },
      data: {
        account_no: String(accountNo),
        pdno: String(symbol),
        ord_qty: String(qty),
        ord_dvsn: '01',
        trde_tp: side === 'buy' ? '2' : '1'
      }
    });

    return res.json({ ok: true, message: response.data?.msg1 || '주문 요청 완료' });
  } catch {
    return res.status(502).json({ ok: false, message: '주문 요청에 실패했습니다.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
