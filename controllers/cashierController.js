const database = require('../config/database');
const Order = require('../models/orderModel');
const OrderProduct = require('../models/orderProductModel');
const Payment = require('../models/paymentModel');
const Employee = require('../models/employeeModel');
const Table = require('../models/tableModel');
const TableSession = require('../models/tableSessionModel');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.userMessage = message;
  return error;
}

async function getOrderDetail(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, 'ไม่พบ Order');

  const [items, payments] = await Promise.all([
    OrderProduct.findByOrder(orderId),
    Payment.findByOrder(orderId)
  ]);

  return {
    order,
    items,
    payment: payments[0] || null
  };
}

module.exports = {
  async dashboard(req, res, next) {
    try {
      const [orderSummary, paymentSummary, recentOrders] = await Promise.all([
        Order.summary(),
        Payment.summary(),
        Order.list()
      ]);

      res.render('cashier/dashboard', {
        title: 'Cashier Dashboard',
        orderSummary,
        paymentSummary,
        recentOrders: recentOrders.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  },

  async orders(req, res, next) {
    try {
      const status = req.query.status || '';
      const orders = await Order.list(status);

      res.render('cashier/orders', {
        title: 'รายการ Order',
        orders,
        selected: null,
        status
      });
    } catch (error) {
      next(error);
    }
  },

  async orderDetail(req, res, next) {
    try {
      const status = req.query.status || '';
      const [orders, selected] = await Promise.all([
        Order.list(status),
        getOrderDetail(Number(req.params.id))
      ]);

      res.render('cashier/orders', {
        title: 'รายละเอียด Order',
        orders,
        selected,
        status
      });
    } catch (error) {
      next(error);
    }
  },

  async payments(req, res, next) {
    try {
      const [payments, cashiers] = await Promise.all([
        Payment.list(),
        Employee.findCashiers()
      ]);

      res.render('cashier/payment', {
        title: 'จัดการ Payment',
        payments,
        cashiers
      });
    } catch (error) {
      next(error);
    }
  },

  async createPayment(req, res, next) {
    try {
      const orderId = Number(req.body.order_id);
      const empId = Number(req.body.emp_id);
      const method = req.body.payment_method;

      const [order, employee] = await Promise.all([
        Order.findById(orderId),
        Employee.findById(empId)
      ]);

      if (!order) throw httpError(404, 'ไม่พบ Order');
      if (!employee || employee.role !== 'Cashier') {
        throw httpError(400, 'กรุณาเลือกพนักงาน Cashier');
      }
      if (!['cash', 'qr_payment'].includes(method)) {
        throw httpError(400, 'วิธีชำระเงินไม่ถูกต้อง');
      }

      await Payment.create({
        empId,
        orderId,
        paymentMethod: method,
        paymentStatus: 'paid'
      });

      req.session.flash = {
        type: 'success',
        message: 'บันทึก Payment สำเร็จ'
      };

      res.redirect('/cashier/payments');
    } catch (error) {
      next(error);
    }
  },

  async updatePayment(req, res, next) {
    try {
      const paymentId = Number(req.params.id);
      const empId = Number(req.body.emp_id);
      const status = req.body.payment_status;

      if (!['paid', 'failed', 'cancelled'].includes(status)) {
        throw httpError(400, 'สถานะ Payment ไม่ถูกต้อง');
      }

      const [payment, employee] = await Promise.all([
        Payment.findById(paymentId),
        Employee.findById(empId)
      ]);

      if (!payment) throw httpError(404, 'ไม่พบ Payment');
      if (!employee || employee.role !== 'Cashier') {
        throw httpError(400, 'กรุณาเลือกพนักงาน Cashier');
      }

      await Payment.updateStatus(paymentId, status, empId);

      req.session.flash = {
        type: 'success',
        message: status === 'paid'
          ? 'ยืนยันการชำระเงินสำเร็จ Order ถูกส่งไปยัง Barista แล้ว'
          : 'อัปเดตสถานะ Payment แล้ว'
      };

      res.redirect('/cashier/payments');
    } catch (error) {
      next(error);
    }
  },

  async completeOrder(req, res, next) {
    try {
      const orderId = Number(req.params.id);
      const order = await Order.findById(orderId);

      if (!order) throw httpError(404, 'ไม่พบ Order');
      if (order.order_status !== 'ready') {
        throw httpError(409, 'Order ต้องอยู่ในสถานะ Ready ก่อนส่งมอบ');
      }

      await database.transaction(async () => {
        await Order.updateStatus(orderId, 'completed');
        await TableSession.close(order.session_id);
        await Table.updateStatus(order.table_id, 'available');
      });

      req.session.flash = {
        type: 'success',
        message: 'ส่งมอบ Order และปิด Table Session แล้ว'
      };

      res.redirect('/cashier/orders/' + orderId);
    } catch (error) {
      next(error);
    }
  },

  async receipt(req, res, next) {
    try {
      const selected = await getOrderDetail(Number(req.params.id));

      res.render('cashier/receipt', {
        title: 'ใบเสร็จ Order #' + selected.order.order_id,
        ...selected
      });
    } catch (error) {
      next(error);
    }
  }
};
