const Order = require('../models/orderModel');
const OrderProduct = require('../models/orderProductModel');
const Payment = require('../models/paymentModel');

module.exports = {
  async detail(req, res, next) {
    try {
      const order = await Order.findById(Number(req.params.id));

      if (!order) {
        return res.status(404).json({ message: 'ไม่พบ Order' });
      }

      const [items, payments] = await Promise.all([
        OrderProduct.findByOrder(order.order_id),
        Payment.findByOrder(order.order_id)
      ]);

      res.json({
        order,
        items,
        payment: payments[0] || null
      });
    } catch (error) {
      next(error);
    }
  }
};
