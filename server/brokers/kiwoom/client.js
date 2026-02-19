const KIWOOM_BASE_URL = process.env.KIWOOM_BASE_URL || 'https://api.kiwoom.com';

async function requestToken() {
  const appKey = process.env.KIWOOM_APP_KEY;
  const secret = process.env.KIWOOM_SECRET_KEY;

  if (!appKey || !secret) return null;

  const response = await fetch(`${KIWOOM_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, secretkey: secret })
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getPortfolio() {
  const token = await requestToken();

  if (!token?.token) {
    return {
      summary: { totalAsset: 12540000, totalReturnRate: 3.91 },
      items: [
        { code: '005930', name: '삼성전자', returnRate: 4.2, evalProfitLoss: 82000, qty: 14, avgPrice: 70500 },
        { code: '035420', name: 'NAVER', returnRate: -2.1, evalProfitLoss: -36000, qty: 5, avgPrice: 215000 }
      ],
      source: 'mock'
    };
  }

  const response = await fetch(`${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
      'api-id': 'ka01690'
    },
    body: JSON.stringify({ cont_yn: 'N', next_key: '' })
  });

  if (!response.ok) {
    throw new Error('키움 잔고 조회 실패');
  }

  const data = await response.json();

  return {
    summary: {
      totalAsset: Number(data?.output?.total_asset || 0),
      totalReturnRate: Number(data?.output?.total_return_rate || 0)
    },
    items: (data?.output1 || []).map((row) => ({
      code: row.pdno,
      name: row.prdt_name,
      returnRate: row.evlu_erng_rt,
      evalProfitLoss: row.evlu_pfls_amt,
      qty: row.hldg_qty,
      avgPrice: row.pchs_avg_pric
    })),
    source: 'kiwoom'
  };
}

export async function placeOrder({ symbol, qty, side }) {
  const token = await requestToken();

  if (!token?.token) {
    return {
      message: `[모의] ${symbol} ${qty}주 ${side === 'buy' ? '매수' : '매도'} 주문이 접수되었습니다.`
    };
  }

  const response = await fetch(`${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
      'api-id': 'kt10000'
    },
    body: JSON.stringify({
      pdno: symbol,
      ord_dvsn: '01',
      ord_qty: String(qty),
      trde_tp: side === 'buy' ? '2' : '1'
    })
  });

  if (!response.ok) {
    throw new Error('키움 주문 실패');
  }

  const data = await response.json();
  return { message: data?.msg1 || '주문 요청 완료', raw: data };
}
