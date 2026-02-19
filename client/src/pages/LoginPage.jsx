import { useState } from 'react';
import Layout from '../components/Layout';

export default function LoginPage({ onLogin, defaultAuth }) {
  const [id, setId] = useState(defaultAuth?.id ?? '');
  const [password, setPassword] = useState(defaultAuth?.password ?? '');
  const [remember, setRemember] = useState(Boolean(defaultAuth?.remember));
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.message || '로그인에 실패했습니다.');
      return;
    }

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
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-btn" type="submit">
          로그인
        </button>
      </form>
    </Layout>
  );
}
