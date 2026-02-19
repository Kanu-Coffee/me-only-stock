import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  const { id, password } = req.body || {};
  const appId = process.env.USER_ID;
  const appPw = process.env.USER_PW;

  if (!appId || !appPw) {
    return res.status(500).json({ message: 'USER_ID/USER_PW 환경변수가 설정되지 않았습니다.' });
  }

  if (id !== appId || password !== appPw) {
    return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  return res.json({ success: true, userId: appId });
});

export default router;
