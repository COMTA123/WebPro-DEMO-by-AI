const Payment = require('../models/paymentModel');

module.exports = {
  async detail(req, res, next) {
    try {
      const payment = await Payment.findById(Number(req.params.id));

      if (!payment) {
        return res.status(404).json({ message: 'ไม่พบ Payment' });
      }

      res.json(payment);
    } catch (error) {
      next(error);
    }
  }
};
