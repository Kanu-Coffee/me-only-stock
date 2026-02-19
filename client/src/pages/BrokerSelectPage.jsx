import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const brokers = [
  { key: 'kiwoom', label: '키움증권', ready: true, desc: '실거래 API 연동' },
  { key: 'kis', label: '한국투자증권', ready: false, desc: '준비중' }
];

export default function BrokerSelectPage({ onLogout }) {
  return (
    <Layout
      title="증권사 선택"
      subtitle="연결할 계좌를 선택하세요."
      rightAction={
        <button className="ghost-btn" onClick={onLogout}>
          로그아웃
        </button>
      }
    >
      <section className="broker-list">
        {brokers.map((broker) => (
          <article key={broker.key} className="broker-card">
            <h2>{broker.label}</h2>
            <p>{broker.desc}</p>
            {broker.ready ? (
              <div className="row-gap">
                <Link to={`/portfolio/${broker.key}`} className="primary-btn">잔고 보기</Link>
                <Link to={`/order/${broker.key}`} className="secondary-btn">빠른 주문</Link>
              </div>
            ) : (
              <button className="secondary-btn" disabled>
                오픈 예정
              </button>
            )}
          </article>
        ))}
      </section>
    </Layout>
  );
}
