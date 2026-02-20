import { Router } from 'express';
import * as kiwoom from '../brokers/kiwoom/client.js';

const router = Router();

router.get('/:broker/portfolio', async (req, res) => {
  try {
    const { broker } = req.params;

    if (broker === 'kiwoom') {
      const data = await kiwoom.getPortfolio();
      return res.json(data);
    }

    return res.status(501).json({ message: `${broker} 연동 준비중입니다.` });
  } catch (error) {
    return res.status(500).json({ message: error.message || '잔고 조회 실패' });
  }
});

router.post('/:broker/order', async (req, res) => {
  try {
    const { broker } = req.params;

    if (broker === 'kiwoom') {
      const data = await kiwoom.placeOrder(req.body);
      return res.json(data);
    }

    return res.status(501).json({ message: `${broker} 주문 연동 준비중입니다.` });
  } catch (error) {
    return res.status(500).json({ message: error.message || '주문 실패' });
  }
});

export default router;
