const crypto = require('crypto');
const database = require('../config/database');
const Table = require('../models/tableModel');
const TableSession = require('../models/tableSessionModel');
const Product = require('../models/productModel');
const ProductOption = require('../models/productOptionModel');
const Option = require('../models/optionModel');
const Order = require('../models/orderModel');
const OrderProduct = require('../models/orderProductModel');
const Payment = require('../models/paymentModel');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.userMessage = message;
  return error;
}

function normalizeOptionIds(value) {
  if (value === undefined || value === null || value === '') return [];

  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(Number).filter(Number.isInteger))];
}

async function buildCartItem(input, existingId) {
  const productId = Number(input.product_id);
  const quantity = Number(input.quantity || 1);
  const note = String(input.note || '').trim().slice(0, 500);

  if (!Number.isInteger(productId) || !Number.isInteger(quantity) ||
      quantity < 1 || quantity > 99) {
    throw httpError(400, 'ข้อมูลสินค้าไม่ถูกต้อง');
  }

  const product = await Product.findById(productId);

  if (!product) throw httpError(404, 'ไม่พบสินค้า');
  if (Number(product.is_available) !== 1) {
    throw httpError(409, 'สินค้านี้ไม่พร้อมจำหน่าย');
  }

  const requestedIds = normalizeOptionIds(input.option_ids);
  const options = await ProductOption.findSupportedOptions(productId, requestedIds);

  if (options.length !== requestedIds.length) {
    throw httpError(400, 'มีตัวเลือกที่สินค้านี้ไม่รองรับหรือไม่พร้อมใช้งาน');
  }

  const optionExtra = options.reduce(
    (sum, option) => sum + Number(option.extra_price || 0),
    0
  );

  const unitPrice = Number(product.base_price) + optionExtra;

  return {
    id: existingId || crypto.randomUUID(),
    productId: product.product_id,
    productName: product.product_name,
    imageUrl: product.img_url,
    basePrice: Number(product.base_price),
    options: options.map((option) => ({
      optionId: option.option_id,
      optionName: option.option_name,
      extraPrice: Number(option.extra_price || 0)
    })),
    note,
    quantity,
    unitPrice,
    subtotal: unitPrice * quantity
  };
}

function getCart(req) {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
}

function orderProductNote(item) {
  const parts = [];

  if (item.options.length) {
    parts.push(
      'ตัวเลือก: ' + item.options.map((option) => option.optionName).join(', ')
    );
  }

  if (item.note) parts.push('หมายเหตุ: ' + item.note);
  return parts.join(' | ');
}

async function loadOrder(orderId, sessionId) {
  const order = await Order.findByIdAndSession(orderId, sessionId);

  if (!order) throw httpError(404, 'ไม่พบ Order หรือไม่มีสิทธิ์ดู Order นี้');

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
  async start(req, res, next) {
    try {
      const tableId = Number(req.query.table);

      if (!Number.isInteger(tableId) || tableId < 1) {
        throw httpError(400, 'QR Code ไม่ถูกต้องหรือไม่ได้ระบุหมายเลขโต๊ะ');
      }

      const table = await Table.findById(tableId);

      if (!table) throw httpError(404, 'ไม่พบโต๊ะที่ระบุใน QR Code');

      if (
        req.session.tableSessionId &&
        Number(req.session.tableId) === tableId
      ) {
        const active = await TableSession.findActiveById(
          req.session.tableSessionId
        );

        if (active) return res.redirect('/customer/products');
      }

      const result = await database.transaction(async () => {
        const created = await TableSession.create(tableId);
        await Table.updateStatus(tableId, 'occupied');
        return created;
      });

      req.session.tableSessionId = result.id;
      req.session.tableId = tableId;
      req.session.tableNumber = table.table_number;
      req.session.cart = [];

      res.redirect('/customer/products');
    } catch (error) {
      next(error);
    }
  },

  async products(req, res, next) {
    try {
      const category = req.query.category || '';
      const [products, categories] = await Promise.all([
        Product.findAll(category),
        Product.getCategories()
      ]);

      res.render('customer/products', {
        title: 'เมนูสินค้า',
        products,
        categories,
        selectedCategory: category,
        tableSession: req.tableSession
      });
    } catch (error) {
      next(error);
    }
  },

  async productDetail(req, res, next) {
    try {
      const product = await Product.findById(Number(req.params.id));

      if (!product) throw httpError(404, 'ไม่พบสินค้า');

      const options = await Option.findAvailableByProduct(product.product_id);

      res.render('customer/product-detail', {
        title: product.product_name,
        product,
        options,
        tableSession: req.tableSession
      });
    } catch (error) {
      next(error);
    }
  },

  async cart(req, res, next) {
    try {
      const cart = getCart(req);

      const enrichedCart = await Promise.all(
        cart.map(async (item) => ({
          ...item,
          supportedOptions: await Option.findAvailableByProduct(item.productId)
        }))
      );

      const total = cart.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0
      );

      res.render('customer/cart', {
        title: 'ตะกร้าสินค้า',
        cart: enrichedCart,
        total,
        tableSession: req.tableSession
      });
    } catch (error) {
      next(error);
    }
  },

  async addCart(req, res, next) {
    try {
      const item = await buildCartItem(req.body);
      getCart(req).push(item);

      req.session.flash = {
        type: 'success',
        message: 'เพิ่มสินค้าในตะกร้าแล้ว'
      };

      res.redirect('/customer/cart');
    } catch (error) {
      next(error);
    }
  },

  async updateCart(req, res, next) {
    try {
      const cart = getCart(req);
      const index = cart.findIndex((item) => item.id === req.params.id);

      if (index < 0) throw httpError(404, 'ไม่พบรายการในตะกร้า');

      const updated = await buildCartItem({
        product_id: cart[index].productId,
        quantity: req.body.quantity,
        note: req.body.note,
        option_ids: req.body.option_ids
      }, cart[index].id);

      cart[index] = updated;

      req.session.flash = {
        type: 'success',
        message: 'แก้ไขรายการแล้ว'
      };

      res.redirect('/customer/cart');
    } catch (error) {
      next(error);
    }
  },

  removeCart(req, res, next) {
    try {
      const cart = getCart(req);
      const index = cart.findIndex((item) => item.id === req.params.id);

      if (index < 0) throw httpError(404, 'ไม่พบรายการในตะกร้า');

      cart.splice(index, 1);

      req.session.flash = {
        type: 'success',
        message: 'ลบสินค้าออกจากตะกร้าแล้ว'
      };

      res.redirect('/customer/cart');
    } catch (error) {
      next(error);
    }
  },

  checkout(req, res, next) {
    try {
      const cart = getCart(req);

      if (!cart.length) {
        req.session.flash = {
          type: 'warning',
          message: 'กรุณาเลือกสินค้าก่อน Checkout'
        };
        return res.redirect('/customer/products');
      }

      const total = cart.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0
      );

      res.render('customer/checkout', {
        title: 'ยืนยันคำสั่งซื้อ',
        cart,
        total,
        tableSession: req.tableSession
      });
    } catch (error) {
      next(error);
    }
  },

  async createOrder(req, res, next) {
    try {
      const cart = getCart(req);
      if (!cart.length) throw httpError(400, 'ตะกร้าสินค้าว่าง');

      const orderType = req.body.order_type;
      const paymentMethod = req.body.payment_method;

      if (!['dine-in', 'takeaway'].includes(orderType)) {
        throw httpError(400, 'รูปแบบ Order ไม่ถูกต้อง');
      }

      if (!['cash', 'qr_payment'].includes(paymentMethod)) {
        throw httpError(400, 'วิธีชำระเงินไม่ถูกต้อง');
      }

      if (
        paymentMethod === 'qr_payment' &&
        req.body.qr_confirmed !== '1'
      ) {
        throw httpError(400, 'กรุณายืนยันการชำระเงินผ่าน QR');
      }

      const validatedItems = [];

      for (const oldItem of cart) {
        const item = await buildCartItem({
          product_id: oldItem.productId,
          quantity: oldItem.quantity,
          note: oldItem.note,
          option_ids: oldItem.options.map((option) => option.optionId)
        }, oldItem.id);

        item.databaseNote = orderProductNote(item);
        validatedItems.push(item);
      }

      const total = validatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );

      const created = await database.transaction(async () => {
        const orderResult = await Order.create({
          sessionId: req.tableSession.session_id,
          orderType,
          orderStatus: 'pending',
          totalPaid: total
        });

        await OrderProduct.createMany(orderResult.id, validatedItems);

        const paymentResult = await Payment.create({
          empId: null,
          orderId: orderResult.id,
          paymentMethod,
          paymentStatus: paymentMethod === 'qr_payment' ? 'paid' : 'pending'
        });

        return {
          orderId: orderResult.id,
          paymentId: paymentResult.id
        };
      });

      req.session.cart = [];
      req.session.lastOrderId = created.orderId;

      res.redirect('/customer/orders/' + created.orderId + '?success=1');
    } catch (error) {
      next(error);
    }
  },

  async order(req, res, next) {
    try {
      const result = await loadOrder(
        Number(req.params.id),
        req.tableSession.session_id
      );

      const template = req.query.success === '1'
        ? 'customer/order-success'
        : 'customer/order-status';

      res.render(template, {
        title: 'Order #' + result.order.order_id,
        ...result
      });
    } catch (error) {
      next(error);
    }
  },

  async status(req, res, next) {
    try {
      const result = await loadOrder(
        Number(req.params.id),
        req.tableSession.session_id
      );

      res.json({
        orderId: result.order.order_id,
        orderStatus: result.order.order_status,
        paymentStatus: result.payment
          ? result.payment.payment_status
          : 'pending',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
};
