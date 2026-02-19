import { Router } from 'express';
import * as kiwoom from '../brokers/kiwoom/client.js';

const router = Router();

router.get('/:broker/portfolio', async (req, res) => {
  const { broker } = req.params;

  if (broker === 'kiwoom') {
    const data = await kiwoom.getPortfolio();
    return res.json(data);
  }

  return res.status(501).json({ message: `${broker} 연동 준비중입니다.` });
});

router.post('/:broker/order', async (req, res) => {
  const { broker } = req.params;

  if (broker === 'kiwoom') {
    const data = await kiwoom.placeOrder(req.body);
    return res.json(data);
  }

  return res.status(501).json({ message: `${broker} 주문 연동 준비중입니다.` });
});

export default router;
