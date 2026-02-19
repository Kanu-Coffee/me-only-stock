import { useState } from 'react';
import Layout from '../components/Layout';

export default function LoginPage({ onLogin, defaultAuth }) {
  const [id, setId] = useState(defaultAuth?.id ?? 'demo_user');
  const [password, setPassword] = useState(defaultAuth?.password ?? 'demo_pass');
  const [remember, setRemember] = useState(Boolean(defaultAuth?.remember));

  const submit = (event) => {
    event.preventDefault();
    onLogin({ id, password, remember });
  };

  return (
    <Layout title="내 주식 주문" subtitle="한 번 로그인하고 증권사를 선택하세요.">
      <form className="card" onSubmit={submit}>
        <label>
          아이디
          <input value={id} onChange={(event) => setId(event.target.value)} placeholder="아이디" required />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            required
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          아이디/비밀번호 저장
        </label>
        <button className="primary-btn" type="submit">
          로그인
        </button>
      </form>
    </Layout>
  );
}
