import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';

export default function PortfolioPage({ onLogout }) {
  const { broker } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/brokers/${broker}/portfolio`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setError('잔고 정보를 불러오지 못했습니다.'));
  }, [broker]);

  return (
    <Layout
      title="내 잔고"
      subtitle="핵심 수치만 간단하게 확인"
      rightAction={<button className="ghost-btn" onClick={onLogout}>로그아웃</button>}
    >
      {error ? <p className="error">{error}</p> : null}
      {!data ? (
        <p className="muted">불러오는 중...</p>
      ) : (
        <>
          <section className="summary-grid">
            <article className="card">
              <span>총 자산</span>
              <strong>{Number(data.summary.totalAsset).toLocaleString()}원</strong>
            </article>
            <article className="card">
              <span>총 수익률</span>
              <strong className={Number(data.summary.totalReturnRate) >= 0 ? 'up' : 'down'}>
                {data.summary.totalReturnRate}%
              </strong>
            </article>
          </section>
          <section className="card">
            {data.items.map((item) => (
              <details key={item.code} className="holding-item">
                <summary>
                  <span>{item.name}</span>
                  <span className={Number(item.returnRate) >= 0 ? 'up' : 'down'}>{item.returnRate}%</span>
                  <span className={Number(item.evalProfitLoss) >= 0 ? 'up' : 'down'}>
                    {Number(item.evalProfitLoss).toLocaleString()}원
                  </span>
                </summary>
                <div className="holding-detail">
                  <p>보유수량: {item.qty}주</p>
                  <p>평균단가: {Number(item.avgPrice).toLocaleString()}원</p>
                </div>
              </details>
            ))}
          </section>
        </>
      )}
      <Link className="sticky-order" to={`/order/${broker}`}>
        즉시 주문하기
      </Link>
    </Layout>
  );
}
