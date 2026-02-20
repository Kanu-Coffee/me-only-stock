import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';

export default function QuickOrderPage({ onLogout }) {
  const { broker } = useParams();
  const [symbol, setSymbol] = useState('005930');
  const [qty, setQty] = useState(1);
  const [side, setSide] = useState('buy');
  const [message, setMessage] = useState('');

  const placeOrder = async () => {
    const res = await fetch(`/api/brokers/${broker}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, qty, side, priceType: 'market' })
    });
    const json = await res.json();
    setMessage(json.message || '주문 요청 완료');
  };

  return (
    <Layout
      title="초간편 주문"
      subtitle="현재가(시장가) 즉시 주문"
      rightAction={<button className="ghost-btn" onClick={onLogout}>로그아웃</button>}
    >
      <section className="card gap16">
        <label>
          종목 검색/코드
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="예: 005930" />
        </label>
        <div className="qty-box">
          <span>수량</span>
          <div className="qty-controls">
            <button className="qty-btn" onClick={() => setQty((v) => Math.max(1, v - 1))}>-</button>
            <strong>{qty}</strong>
            <button className="qty-btn" onClick={() => setQty((v) => v + 1)}>+</button>
          </div>
        </div>
      </section>
      <div className="bottom-actions">
        <button className={side === 'buy' ? 'primary-btn active' : 'secondary-btn'} onClick={() => setSide('buy')}>
          매수
        </button>
        <button className={side === 'sell' ? 'danger-btn active' : 'secondary-btn'} onClick={() => setSide('sell')}>
          매도
        </button>
        <button className="primary-btn" onClick={placeOrder}>
          시장가 즉시 주문
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
      <Link className="secondary-btn" to={`/portfolio/${broker}`}>
        잔고로 돌아가기
      </Link>
    </Layout>
  );
}
