import { Router } from 'express';

const router = Router();

function parseUsersFromEnv() {
  const users = [];

  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item?.id && item?.password) {
            users.push({
              id: String(item.id),
              password: String(item.password),
              apiKey: item.apiKey ? String(item.apiKey) : ''
            });
          }
        });
      }
    } catch {
      throw new Error('APP_USERS_JSON 형식이 올바른 JSON 배열이 아닙니다.');
    }
  }

  for (let index = 1; index <= 10; index += 1) {
    const id = process.env[`APP_USER_${index}_ID`];
    const password = process.env[`APP_USER_${index}_PW`];
    const apiKey = process.env[`APP_USER_${index}_APIKEY`] || '';

    if (id && password) {
      users.push({ id, password, apiKey });
    }
  }

  const singleId = process.env.USER_ID;
  const singlePw = process.env.USER_PW;
  const singleApiKey = process.env.USER_APIKEY || '';

  if (singleId && singlePw) {
    users.push({ id: singleId, password: singlePw, apiKey: singleApiKey });
  }

  return users;
}

router.post('/login', (req, res) => {
  const { id, password, apiKey } = req.body || {};

  if (!id || !password) {
    return res.status(400).json({ message: '아이디/비밀번호를 입력하세요.' });
  }

  let users;
  try {
    users = parseUsersFromEnv();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  if (!users.length) {
    return res.status(500).json({ message: '로그인 계정 환경변수가 없습니다.' });
  }

  const matched = users.find((user) => {
    if (user.id !== id || user.password !== password) {
      return false;
    }

    if (!user.apiKey) {
      return true;
    }

    return user.apiKey === String(apiKey || '');
  });

  if (!matched) {
    return res.status(401).json({ message: '로그인 정보가 올바르지 않습니다.' });
  }

  return res.json({ success: true, userId: matched.id });
});

export default router;
