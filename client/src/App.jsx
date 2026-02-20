import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import BrokerSelectPage from './pages/BrokerSelectPage';
import PortfolioPage from './pages/PortfolioPage';
import QuickOrderPage from './pages/QuickOrderPage';
import { useEffect, useState } from 'react';

const SAVED_KEY = 'me-only-stock.auth';

function App() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (auth?.remember) {
      localStorage.setItem(SAVED_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(SAVED_KEY);
    }
  }, [auth]);

  const onLogin = (payload) => {
    setAuth(payload);
    navigate('/brokers', { replace: true });
  };

  const onLogout = () => {
    setAuth(null);
    localStorage.removeItem(SAVED_KEY);
    navigate('/login', { replace: true });
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={onLogin} defaultAuth={auth} />} />
      <Route path="/brokers" element={auth ? <BrokerSelectPage onLogout={onLogout} /> : <Navigate to="/login" />} />
      <Route path="/portfolio/:broker" element={auth ? <PortfolioPage onLogout={onLogout} /> : <Navigate to="/login" />} />
      <Route path="/order/:broker" element={auth ? <QuickOrderPage onLogout={onLogout} /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={auth ? '/brokers' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
