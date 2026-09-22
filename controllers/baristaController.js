const Order = require('../models/orderModel');
const OrderProduct = require('../models/orderProductModel');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.userMessage = message;
  return error;
}

async function loadCards() {
  const orders = await Order.listPaidForBarista();

  return Promise.all(
    orders.map(async (order) => ({
      ...order,
      items: await OrderProduct.findByOrder(order.order_id)
    }))
  );
}

module.exports = {
  async dashboard(req, res, next) {
    try {
      const cards = await loadCards();

      res.render('barista/dashboard', {
        title: 'Barista KDS',
        cards
      });
    } catch (error) {
      next(error);
    }
  },

  async orders(req, res, next) {
    try {
      const cards = await loadCards();
      let selected = null;

      if (req.params.id) {
        const order = await Order.findById(Number(req.params.id));

        if (!order) throw httpError(404, 'ไม่พบ Order');

        selected = {
          ...order,
          items: await OrderProduct.findByOrder(order.order_id)
        };
      }

      res.render('barista/orders', {
        title: 'Barista Orders',
        cards,
        selected
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const orderId = Number(req.params.id);
      const nextStatus = req.body.order_status;
      const order = await Order.findById(orderId);

      if (!order) throw httpError(404, 'ไม่พบ Order');

      const allowed = {
        pending: ['preparing'],
        preparing: ['ready'],
        ready: []
      };

      if (
        !allowed[order.order_status] ||
        !allowed[order.order_status].includes(nextStatus)
      ) {
        throw httpError(409, 'ไม่สามารถเปลี่ยนสถานะตามลำดับที่ระบุได้');
      }

      await Order.updateStatus(orderId, nextStatus);

      req.session.flash = {
        type: 'success',
        message: 'เปลี่ยนสถานะ Order #' + orderId + ' เป็น ' + nextStatus
      };

      res.redirect('/barista/dashboard');
    } catch (error) {
      next(error);
    }
  }
};
