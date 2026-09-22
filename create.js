const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'coffee-ordering');

function put(relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.trimStart(), 'utf8');
  console.log('Created:', relativePath);
}

put('package.json', String.raw`
{
  "name": "coffee-qr-ordering-system",
  "version": "1.0.0",
  "description": "Coffee QR Ordering System using Node.js, Express, EJS and SQLite",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "node --watch app.js"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "ejs": "^3.1.10",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "method-override": "^3.0.0",
    "sqlite3": "^5.1.7"
  }
}
`);

put('app.js', String.raw`
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const database = require('./config/database');

const customerRoutes = require('./routes/customerRoutes');
const cashierRoutes = require('./routes/cashierRoutes');
const baristaRoutes = require('./routes/baristaRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.cartCount = Array.isArray(req.session.cart)
    ? req.session.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;

  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.get('/', (req, res) => {
  res.send(
    '<!doctype html><html lang="th"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Coffee QR Ordering System</title>' +
    '<style>body{font-family:system-ui;background:#f6f1eb;color:#33251e;margin:0;padding:40px}' +
    '.box{max-width:680px;margin:auto;background:#fff;padding:32px;border-radius:20px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.08)}a{display:block;padding:14px;margin:10px 0;' +
    'border-radius:12px;background:#6f4e37;color:#fff;text-decoration:none}</style></head>' +
    '<body><main class="box"><h1>Coffee QR Ordering System</h1>' +
    '<p>สำหรับลูกค้า กรุณาเข้าใช้งานผ่าน QR Code ของโต๊ะ เช่น <strong>/customer?table=1</strong></p>' +
    '<a href="/customer?table=1">ตัวอย่างลูกค้าโต๊ะ 1</a>' +
    '<a href="/cashier/dashboard">Cashier Dashboard</a>' +
    '<a href="/barista/dashboard">Barista KDS</a></main></body></html>'
  );
});

app.use('/customer', customerRoutes);
app.use('/cashier', cashierRoutes);
app.use('/barista', baristaRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'ไม่พบหน้าที่ต้องการ',
    message: 'ไม่พบหน้าหรือข้อมูลที่คุณร้องขอ'
  });
});

app.use(errorHandler);

database.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log('Coffee QR Ordering System');
      console.log('Server: http://localhost:' + PORT);
      console.log('Database: ' + database.databasePath);
    });
  })
  .catch((error) => {
    console.error('ไม่สามารถเริ่มระบบได้:', error.message);
    process.exit(1);
  });
`);

put('config/database.js', String.raw`
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'coffee.db');

if (!fs.existsSync(databasePath)) {
  throw new Error(
    'ไม่พบไฟล์ coffee.db กรุณานำฐานข้อมูลที่เตรียมไว้แล้วไปวางที่: ' +
    databasePath +
    ' ระบบจะไม่สร้างฐานข้อมูลใหม่อัตโนมัติ'
  );
}

let resolveReady;
let rejectReady;

const ready = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

const db = new sqlite3.Database(
  databasePath,
  sqlite3.OPEN_READWRITE,
  (error) => {
    if (error) {
      rejectReady(new Error('เชื่อมต่อ coffee.db ไม่สำเร็จ: ' + error.message));
      return;
    }

    db.run('PRAGMA foreign_keys = ON', (pragmaError) => {
      if (pragmaError) {
        rejectReady(
          new Error('เปิดใช้งาน Foreign Key ไม่สำเร็จ: ' + pragmaError.message)
        );
        return;
      }

      console.log('Connected to the existing SQLite database.');
      resolveReady();
    });
  }
);

db.configure('busyTimeout', 5000);

async function all(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

async function get(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

async function run(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({
        id: this.lastID,
        changes: this.changes
      });
    });
  });
}

let transactionQueue = Promise.resolve();

function transaction(work) {
  const task = transactionQueue.then(async () => {
    await run('BEGIN IMMEDIATE TRANSACTION');

    try {
      const result = await work();
      await run('COMMIT');
      return result;
    } catch (error) {
      try {
        await run('ROLLBACK');
      } catch (_) {
        // Preserve the original error.
      }
      throw error;
    }
  });

  transactionQueue = task.catch(() => undefined);
  return task;
}

module.exports = {
  db,
  ready,
  databasePath,
  all,
  get,
  run,
  transaction
};
`);

put('middleware/customerSession.js', String.raw`
const TableSession = require('../models/tableSessionModel');

module.exports = async function customerSession(req, res, next) {
  try {
    const sessionId = req.session.tableSessionId;

    if (!sessionId) {
      req.session.flash = {
        type: 'warning',
        message: 'กรุณาสแกน QR Code ที่โต๊ะก่อนสั่งสินค้า'
      };
      return res.redirect('/');
    }

    const tableSession = await TableSession.findActiveById(sessionId);

    if (!tableSession) {
      req.session.tableSessionId = null;
      req.session.tableId = null;
      req.session.cart = [];

      return res.status(401).render('error', {
        title: 'Session หมดอายุ',
        message: 'Session ของโต๊ะสิ้นสุดแล้ว กรุณาสแกน QR Code ใหม่'
      });
    }

    req.tableSession = tableSession;
    next();
  } catch (error) {
    next(error);
  }
};
`);

put('middleware/errorHandler.js', String.raw`
module.exports = function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const production = process.env.NODE_ENV === 'production';

  res.status(status).render('error', {
    title: status === 500 ? 'เกิดข้อผิดพลาด' : 'ไม่สามารถดำเนินการได้',
    message: production && status === 500
      ? 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
      : error.userMessage || error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
  });
};
`);

put('models/employeeModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  findById(empId) {
    return database.get(
      'SELECT * FROM Employee WHERE emp_id = ?',
      [empId]
    );
  },

  findCashiers() {
    return database.all(
      "SELECT * FROM Employee WHERE role = 'Cashier' ORDER BY first_name, last_name"
    );
  }
};
`);

put('models/tableModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  findById(tableId) {
    return database.get(
      'SELECT * FROM "Table" WHERE table_id = ?',
      [tableId]
    );
  },

  updateStatus(tableId, status) {
    return database.run(
      'UPDATE "Table" SET status = ? WHERE table_id = ?',
      [status, tableId]
    );
  }
};
`);

put('models/tableSessionModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  create(tableId) {
    return database.run(
      "INSERT INTO Table_Session (table_id, start_time, end_time) " +
      "VALUES (?, datetime('now', 'localtime'), NULL)",
      [tableId]
    );
  },

  findById(sessionId) {
    return database.get(
      'SELECT ts.*, t.table_number, t.status AS table_status ' +
      'FROM Table_Session ts ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'WHERE ts.session_id = ?',
      [sessionId]
    );
  },

  findActiveById(sessionId) {
    return database.get(
      'SELECT ts.*, t.table_number, t.status AS table_status ' +
      'FROM Table_Session ts ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'WHERE ts.session_id = ? AND ts.end_time IS NULL',
      [sessionId]
    );
  },

  close(sessionId) {
    return database.run(
      "UPDATE Table_Session " +
      "SET end_time = datetime('now', 'localtime') " +
      "WHERE session_id = ? AND end_time IS NULL",
      [sessionId]
    );
  }
};
`);

put('models/productModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  findAll(category) {
    let sql =
      'SELECT product_id, category, product_name, base_price, img_url, ' +
      'description, is_available FROM Product';
    const params = [];

    if (category !== undefined && category !== null && category !== '') {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY category, product_name';
    return database.all(sql, params);
  },

  findAvailable() {
    return database.all(
      'SELECT * FROM Product WHERE is_available = 1 ' +
      'ORDER BY category, product_name'
    );
  },

  findById(productId) {
    return database.get(
      'SELECT * FROM Product WHERE product_id = ?',
      [productId]
    );
  },

  getCategories() {
    return database.all(
      'SELECT DISTINCT category FROM Product ' +
      'WHERE category IS NOT NULL AND category <> ? ORDER BY category',
      ['']
    );
  }
};
`);

put('models/optionModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  findById(optionId) {
    return database.get(
      'SELECT * FROM "Option" WHERE option_id = ?',
      [optionId]
    );
  },

  findAvailableByProduct(productId) {
    return database.all(
      'SELECT o.option_id, o.option_name, o.extra_price, o.is_available ' +
      'FROM "Option" o ' +
      'JOIN Product_Option po ON po.option_id = o.option_id ' +
      'WHERE po.product_id = ? AND o.is_available = 1 ' +
      'ORDER BY o.option_name',
      [productId]
    );
  }
};
`);

put('models/productOptionModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  findByProduct(productId) {
    return database.all(
      'SELECT po.product_id, po.option_id, o.option_name, ' +
      'o.extra_price, o.is_available ' +
      'FROM Product_Option po ' +
      'JOIN "Option" o ON o.option_id = po.option_id ' +
      'WHERE po.product_id = ? ORDER BY o.option_name',
      [productId]
    );
  },

  findSupportedOptions(productId, optionIds) {
    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return Promise.resolve([]);
    }

    const placeholders = optionIds.map(() => '?').join(',');

    return database.all(
      'SELECT o.option_id, o.option_name, o.extra_price ' +
      'FROM Product_Option po ' +
      'JOIN "Option" o ON o.option_id = po.option_id ' +
      'WHERE po.product_id = ? AND o.is_available = 1 ' +
      'AND o.option_id IN (' + placeholders + ')',
      [productId].concat(optionIds)
    );
  }
};
`);

put('models/orderModel.js', String.raw`
const database = require('../config/database');

const detailSql =
  'SELECT o.*, ts.table_id, t.table_number, ' +
  "COALESCE((" +
  " SELECT p.payment_status FROM Payment p " +
  " WHERE p.order_id = o.order_id " +
  " ORDER BY p.payment_id DESC LIMIT 1" +
  "), 'pending') AS payment_status, " +
  '(SELECT p.payment_method FROM Payment p ' +
  ' WHERE p.order_id = o.order_id ' +
  ' ORDER BY p.payment_id DESC LIMIT 1) AS payment_method ' +
  'FROM "Order" o ' +
  'JOIN Table_Session ts ON ts.session_id = o.session_id ' +
  'JOIN "Table" t ON t.table_id = ts.table_id ';

module.exports = {
  create(data) {
    return database.run(
      'INSERT INTO "Order" ' +
      '(session_id, order_type, order_status, total_paid, created_at) ' +
      "VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
      [
        data.sessionId,
        data.orderType,
        data.orderStatus,
        data.totalPaid
      ]
    );
  },

  findById(orderId) {
    return database.get(
      detailSql + 'WHERE o.order_id = ?',
      [orderId]
    );
  },

  findByIdAndSession(orderId, sessionId) {
    return database.get(
      detailSql + 'WHERE o.order_id = ? AND o.session_id = ?',
      [orderId, sessionId]
    );
  },

  list(status) {
    let sql = detailSql;
    const params = [];

    if (status) {
      sql += 'WHERE o.order_status = ? ';
      params.push(status);
    }

    sql += 'ORDER BY o.created_at DESC, o.order_id DESC';
    return database.all(sql, params);
  },

  listPaidForBarista() {
    return database.all(
      detailSql +
      "WHERE o.order_status IN ('pending', 'preparing', 'ready') " +
      "AND EXISTS (" +
      " SELECT 1 FROM Payment p " +
      " WHERE p.order_id = o.order_id AND p.payment_status = 'paid'" +
      ') ORDER BY ' +
      "CASE o.order_status " +
      "WHEN 'preparing' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, " +
      'o.created_at ASC'
    );
  },

  updateStatus(orderId, status) {
    return database.run(
      'UPDATE "Order" SET order_status = ? WHERE order_id = ?',
      [status, orderId]
    );
  },

  summary() {
    return database.get(
      'SELECT COUNT(*) AS total_orders, ' +
      "SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) AS pending, " +
      "SUM(CASE WHEN order_status = 'preparing' THEN 1 ELSE 0 END) AS preparing, " +
      "SUM(CASE WHEN order_status = 'ready' THEN 1 ELSE 0 END) AS ready, " +
      "SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed " +
      'FROM "Order"'
    );
  }
};
`);

put('models/orderProductModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  create(data) {
    return database.run(
      'INSERT INTO Order_Product ' +
      '(order_id, product_id, quantity, subtotal, note) ' +
      'VALUES (?, ?, ?, ?, ?)',
      [
        data.orderId,
        data.productId,
        data.quantity,
        data.subtotal,
        data.note
      ]
    );
  },

  async createMany(orderId, items) {
    const results = [];

    for (const item of items) {
      results.push(await this.create({
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        subtotal: item.subtotal,
        note: item.databaseNote
      }));
    }

    return results;
  },

  findByOrder(orderId) {
    return database.all(
      'SELECT op.*, p.product_name, p.base_price, p.img_url ' +
      'FROM Order_Product op ' +
      'JOIN Product p ON p.product_id = op.product_id ' +
      'WHERE op.order_id = ? ORDER BY op.order_product_id',
      [orderId]
    );
  }
};
`);

put('models/paymentModel.js', String.raw`
const database = require('../config/database');

module.exports = {
  create(data) {
    return database.run(
      'INSERT INTO Payment ' +
      '(emp_id, order_id, payment_method, payment_status, payment_time) ' +
      "VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
      [
        data.empId || null,
        data.orderId,
        data.paymentMethod,
        data.paymentStatus
      ]
    );
  },

  findById(paymentId) {
    return database.get(
      'SELECT * FROM Payment WHERE payment_id = ?',
      [paymentId]
    );
  },

  findByOrder(orderId) {
    return database.all(
      'SELECT p.*, e.first_name, e.last_name ' +
      'FROM Payment p ' +
      'LEFT JOIN Employee e ON e.emp_id = p.emp_id ' +
      'WHERE p.order_id = ? ORDER BY p.payment_id DESC',
      [orderId]
    );
  },

  list() {
    return database.all(
      'SELECT p.*, o.total_paid, o.order_status, t.table_number, ' +
      'e.first_name, e.last_name ' +
      'FROM Payment p ' +
      'JOIN "Order" o ON o.order_id = p.order_id ' +
      'JOIN Table_Session ts ON ts.session_id = o.session_id ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'LEFT JOIN Employee e ON e.emp_id = p.emp_id ' +
      'ORDER BY p.payment_time DESC, p.payment_id DESC'
    );
  },

  updateStatus(paymentId, status, empId) {
    return database.run(
      "UPDATE Payment SET payment_status = ?, emp_id = ?, " +
      "payment_time = datetime('now', 'localtime') " +
      'WHERE payment_id = ?',
      [status, empId || null, paymentId]
    );
  },

  summary() {
    return database.get(
      'SELECT COUNT(*) AS total_payments, ' +
      "SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pending, " +
      "SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid, " +
      "COALESCE(SUM(CASE WHEN payment_status = 'paid' " +
      'THEN o.total_paid ELSE 0 END), 0) AS revenue ' +
      'FROM Payment p JOIN "Order" o ON o.order_id = p.order_id'
    );
  }
};
`);

put('controllers/customerController.js', String.raw`
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
`);

put('controllers/cashierController.js', String.raw`
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
`);

put('controllers/baristaController.js', String.raw`
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
`);

put('controllers/productController.js', String.raw`
const Product = require('../models/productModel');
const Option = require('../models/optionModel');

module.exports = {
  async list(req, res, next) {
    try {
      const products = await Product.findAll(req.query.category || '');
      res.json(products);
    } catch (error) {
      next(error);
    }
  },

  async detail(req, res, next) {
    try {
      const product = await Product.findById(Number(req.params.id));

      if (!product) {
        return res.status(404).json({ message: 'ไม่พบสินค้า' });
      }

      const options = await Option.findAvailableByProduct(product.product_id);
      res.json({ ...product, options });
    } catch (error) {
      next(error);
    }
  }
};
`);

put('controllers/orderController.js', String.raw`
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
`);

put('controllers/paymentController.js', String.raw`
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
`);

put('routes/customerRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/customerController');
const customerSession = require('../middleware/customerSession');

const router = express.Router();

router.get('/', controller.start);
router.get('/products', customerSession, controller.products);
router.get('/products/:id', customerSession, controller.productDetail);
router.get('/cart', customerSession, controller.cart);
router.post('/cart', customerSession, controller.addCart);
router.put('/cart/:id', customerSession, controller.updateCart);
router.delete('/cart/:id', customerSession, controller.removeCart);
router.get('/checkout', customerSession, controller.checkout);
router.post('/orders', customerSession, controller.createOrder);
router.get('/orders/:id', customerSession, controller.order);
router.get('/orders/:id/status', customerSession, controller.status);

module.exports = router;
`);

put('routes/cashierRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/cashierController');

const router = express.Router();

router.get('/dashboard', controller.dashboard);
router.get('/orders', controller.orders);
router.get('/orders/:id', controller.orderDetail);
router.put('/orders/:id/status', controller.completeOrder);
router.get('/payments', controller.payments);
router.post('/payments', controller.createPayment);
router.put('/payments/:id', controller.updatePayment);
router.get('/receipt/:id', controller.receipt);

module.exports = router;
`);

put('routes/baristaRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/baristaController');

const router = express.Router();

router.get('/dashboard', controller.dashboard);
router.get('/orders', controller.orders);
router.get('/orders/:id', controller.orders);
router.put('/orders/:id/status', controller.updateStatus);

module.exports = router;
`);

put('routes/productRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/productController');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.detail);

module.exports = router;
`);

put('routes/orderRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/orderController');

const router = express.Router();

router.get('/:id', controller.detail);

module.exports = router;
`);

put('routes/paymentRoutes.js', String.raw`
const express = require('express');
const controller = require('../controllers/paymentController');

const router = express.Router();

router.get('/:id', controller.detail);

module.exports = router;
`);

put('views/error.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body class="bg-light">
  <main class="container py-5">
    <section class="card border-0 shadow-sm mx-auto error-card">
      <div class="card-body p-5 text-center">
        <div class="display-1 mb-3">☕</div>
        <h1 class="h3"><%= title %></h1>
        <p class="text-secondary"><%= message %></p>
        <a href="/" class="btn btn-coffee">กลับหน้าหลัก</a>
      </div>
    </section>
  </main>
</body>
</html>
`);

put('views/customer/products.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <header class="customer-header sticky-top">
    <div class="container py-3 d-flex justify-content-between align-items-center">
      <div>
        <div class="small opacity-75">Coffee QR Ordering</div>
        <strong>โต๊ะ <%= tableSession.table_number %></strong>
      </div>
      <a href="/customer/cart" class="btn btn-light position-relative">
        ตะกร้า
        <% if (cartCount > 0) { %>
          <span class="badge rounded-pill bg-danger cart-badge"><%= cartCount %></span>
        <% } %>
      </a>
    </div>
  </header>

  <main class="container py-4 customer-content">
    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %> alert-dismissible fade show">
        <%= flash.message %>
        <button class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    <% } %>

    <section class="hero-card mb-4">
      <span class="small text-uppercase">Freshly made</span>
      <h1 class="h3 mt-1">เลือกเมนูโปรดของคุณ</h1>
      <p class="mb-0">เครื่องดื่มและขนม พร้อมเสิร์ฟถึงโต๊ะ</p>
    </section>

    <nav class="category-scroll mb-4">
      <a class="btn <%= !selectedCategory ? 'btn-coffee' : 'btn-outline-coffee' %>"
         href="/customer/products">ทั้งหมด</a>
      <% categories.forEach(function(row) { %>
        <a class="btn <%= String(selectedCategory) === String(row.category) ? 'btn-coffee' : 'btn-outline-coffee' %>"
           href="/customer/products?category=<%= encodeURIComponent(row.category) %>">
          <%= row.category %>
        </a>
      <% }) %>
    </nav>

    <div class="row g-3">
      <% if (!products.length) { %>
        <div class="col-12">
          <div class="empty-state">ไม่พบสินค้าในหมวดหมู่นี้</div>
        </div>
      <% } %>

      <% products.forEach(function(product) { %>
        <div class="col-12 col-sm-6 col-lg-4">
          <article class="card product-card h-100 border-0 shadow-sm">
            <% if (product.img_url) { %>
              <img src="<%= product.img_url %>"
                   class="card-img-top product-image"
                   alt="<%= product.product_name %>"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
              <div class="product-placeholder" style="display:none">☕</div>
            <% } else { %>
              <div class="product-placeholder">☕</div>
            <% } %>

            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between gap-2">
                <span class="badge text-bg-light"><%= product.category %></span>
                <span class="availability <%= Number(product.is_available) === 1 ? 'available' : 'unavailable' %>">
                  <%= Number(product.is_available) === 1 ? 'พร้อมขาย' : 'หมด' %>
                </span>
              </div>

              <h2 class="h5 mt-3"><%= product.product_name %></h2>
              <p class="text-secondary small flex-grow-1">
                <%= product.description || 'เมนูพิเศษจากทางร้าน' %>
              </p>

              <div class="d-flex justify-content-between align-items-center">
                <strong class="price">฿<%= Number(product.base_price).toFixed(2) %></strong>
                <% if (Number(product.is_available) === 1) { %>
                  <a href="/customer/products/<%= product.product_id %>"
                     class="btn btn-coffee">เลือก</a>
                <% } else { %>
                  <button class="btn btn-secondary" disabled>ไม่พร้อมขาย</button>
                <% } %>
              </div>
            </div>
          </article>
        </div>
      <% }) %>
    </div>
  </main>

  <nav class="bottom-nav">
    <a class="active" href="/customer/products">เมนู</a>
    <a href="/customer/cart">ตะกร้า (<%= cartCount %>)</a>
    <% if (typeof lastOrderId !== 'undefined' && lastOrderId) { %>
      <a href="/customer/orders/<%= lastOrderId %>">สถานะ</a>
    <% } %>
  </nav>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="/js/customer.js"></script>
</body>
</html>
`);

put('views/customer/product-detail.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <main class="container py-4 product-detail-page">
    <a href="/customer/products" class="back-link">← กลับไปยังเมนู</a>

    <section class="card border-0 shadow-sm mt-3 overflow-hidden">
      <% if (product.img_url) { %>
        <img src="<%= product.img_url %>"
             class="detail-image"
             alt="<%= product.product_name %>"
             onerror="this.style.display='none'">
      <% } %>

      <div class="card-body p-4">
        <span class="badge text-bg-light"><%= product.category %></span>
        <h1 class="h3 mt-2"><%= product.product_name %></h1>
        <p class="text-secondary"><%= product.description || '' %></p>
        <p class="h4 price">เริ่มต้น ฿<%= Number(product.base_price).toFixed(2) %></p>

        <% if (Number(product.is_available) !== 1) { %>
          <div class="alert alert-warning">สินค้านี้ไม่พร้อมจำหน่าย</div>
        <% } else { %>
          <form action="/customer/cart" method="post" id="customizeForm">
            <input type="hidden" name="product_id" value="<%= product.product_id %>">

            <fieldset class="mb-4">
              <legend class="h6">ตัวเลือกเพิ่มเติม</legend>
              <% if (!options.length) { %>
                <p class="text-secondary small">สินค้านี้ไม่มีตัวเลือกเพิ่มเติม</p>
              <% } %>

              <% options.forEach(function(option) { %>
                <label class="option-row">
                  <span>
                    <input class="form-check-input option-checkbox"
                           type="checkbox"
                           name="option_ids"
                           value="<%= option.option_id %>"
                           data-extra="<%= Number(option.extra_price || 0) %>">
                    <%= option.option_name %>
                  </span>
                  <span>+฿<%= Number(option.extra_price || 0).toFixed(2) %></span>
                </label>
              <% }) %>
            </fieldset>

            <div class="mb-3">
              <label class="form-label" for="note">หมายเหตุ</label>
              <textarea class="form-control" id="note" name="note" maxlength="500"
                        rows="3" placeholder="เช่น ไม่ใส่น้ำแข็ง"></textarea>
            </div>

            <div class="mb-4">
              <label class="form-label" for="quantity">จำนวน</label>
              <div class="quantity-control">
                <button type="button" class="btn btn-outline-secondary quantity-minus">−</button>
                <input class="form-control text-center" id="quantity" name="quantity"
                       type="number" min="1" max="99" value="1">
                <button type="button" class="btn btn-outline-secondary quantity-plus">+</button>
              </div>
            </div>

            <button class="btn btn-coffee btn-lg w-100" type="submit"
                    data-base-price="<%= Number(product.base_price) %>"
                    id="addButton">
              เพิ่มลงตะกร้า — ฿<span id="calculatedPrice"><%= Number(product.base_price).toFixed(2) %></span>
            </button>
          </form>
        <% } %>
      </div>
    </section>
  </main>

  <script src="/js/customer.js"></script>
</body>
</html>
`);

put('views/customer/cart.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <main class="container py-4 customer-content">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <a href="/customer/products" class="back-link">← เลือกสินค้าเพิ่ม</a>
        <h1 class="h3 mt-2 mb-0">ตะกร้าสินค้า</h1>
      </div>
      <span class="badge text-bg-light">โต๊ะ <%= tableSession.table_number %></span>
    </div>

    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %>"><%= flash.message %></div>
    <% } %>

    <% if (!cart.length) { %>
      <section class="empty-state">
        <div class="display-3">🛒</div>
        <h2 class="h5">ตะกร้ายังว่าง</h2>
        <a href="/customer/products" class="btn btn-coffee">เลือกสินค้า</a>
      </section>
    <% } %>

    <% cart.forEach(function(item) { %>
      <article class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <form method="post" action="/customer/cart/<%= item.id %>?_method=PUT">
            <div class="d-flex justify-content-between gap-3">
              <div>
                <h2 class="h5"><%= item.productName %></h2>
                <p class="price mb-2">฿<%= Number(item.subtotal).toFixed(2) %></p>
              </div>
              <span class="text-secondary">฿<%= Number(item.unitPrice).toFixed(2) %>/ชิ้น</span>
            </div>

            <% if (item.supportedOptions.length) { %>
              <div class="mb-3">
                <div class="small fw-semibold mb-2">แก้ไขตัวเลือก</div>
                <div class="row g-2">
                  <% item.supportedOptions.forEach(function(option) {
                    const checked = item.options.some(function(selected) {
                      return Number(selected.optionId) === Number(option.option_id);
                    });
                  %>
                    <div class="col-12 col-sm-6">
                      <label class="option-row compact">
                        <span>
                          <input class="form-check-input" type="checkbox"
                                 name="option_ids" value="<%= option.option_id %>"
                                 <%= checked ? 'checked' : '' %>>
                          <%= option.option_name %>
                        </span>
                        <small>+฿<%= Number(option.extra_price || 0).toFixed(2) %></small>
                      </label>
                    </div>
                  <% }) %>
                </div>
              </div>
            <% } %>

            <div class="row g-2 align-items-end">
              <div class="col-4">
                <label class="form-label small">จำนวน</label>
                <input class="form-control" type="number" name="quantity"
                       min="1" max="99" value="<%= item.quantity %>">
              </div>
              <div class="col-8">
                <label class="form-label small">หมายเหตุ</label>
                <input class="form-control" type="text" name="note"
                       maxlength="500" value="<%= item.note %>">
              </div>
            </div>

            <button class="btn btn-outline-coffee btn-sm mt-3" type="submit">
              บันทึกการแก้ไข
            </button>
          </form>

          <form method="post" action="/customer/cart/<%= item.id %>?_method=DELETE"
                class="mt-2" onsubmit="return confirm('ลบสินค้านี้หรือไม่?')">
            <button class="btn btn-link text-danger p-0" type="submit">ลบสินค้า</button>
          </form>
        </div>
      </article>
    <% }) %>

    <% if (cart.length) { %>
      <section class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between h5">
            <span>ยอดรวม</span>
            <strong class="price">฿<%= Number(total).toFixed(2) %></strong>
          </div>
          <a href="/customer/checkout" class="btn btn-coffee btn-lg w-100 mt-2">
            ดำเนินการ Checkout
          </a>
        </div>
      </section>
    <% } %>
  </main>
</body>
</html>
`);

put('views/customer/checkout.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <main class="container py-4 checkout-page">
    <a href="/customer/cart" class="back-link">← กลับไปตะกร้า</a>
    <h1 class="h3 mt-3">ยืนยันคำสั่งซื้อ</h1>
    <p class="text-secondary">โต๊ะ <%= tableSession.table_number %></p>

    <section class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <% cart.forEach(function(item) { %>
          <div class="d-flex justify-content-between border-bottom py-3">
            <div>
              <strong><%= item.productName %> × <%= item.quantity %></strong>
              <% if (item.options.length) { %>
                <div class="small text-secondary">
                  <%= item.options.map(function(option) {
                    return option.optionName;
                  }).join(', ') %>
                </div>
              <% } %>
              <% if (item.note) { %>
                <div class="small text-secondary">หมายเหตุ: <%= item.note %></div>
              <% } %>
            </div>
            <span>฿<%= Number(item.subtotal).toFixed(2) %></span>
          </div>
        <% }) %>

        <div class="d-flex justify-content-between h5 pt-3">
          <span>ยอดสุทธิ</span>
          <strong class="price">฿<%= Number(total).toFixed(2) %></strong>
        </div>
      </div>
    </section>

    <form action="/customer/orders" method="post" class="card border-0 shadow-sm">
      <div class="card-body">
        <h2 class="h5">รูปแบบ Order</h2>
        <label class="choice-card">
          <input class="form-check-input" type="radio" name="order_type"
                 value="dine-in" checked>
          รับประทานที่ร้าน
        </label>
        <label class="choice-card">
          <input class="form-check-input" type="radio" name="order_type"
                 value="takeaway">
          ซื้อกลับบ้าน
        </label>

        <h2 class="h5 mt-4">วิธีชำระเงิน</h2>
        <label class="choice-card">
          <input class="form-check-input payment-method" type="radio"
                 name="payment_method" value="cash" checked>
          เงินสดที่แคชเชียร์
        </label>
        <label class="choice-card">
          <input class="form-check-input payment-method" type="radio"
                 name="payment_method" value="qr_payment">
          QR Payment
        </label>

        <section id="qrPaymentPanel" class="qr-panel mt-3 d-none">
          <div class="qr-demo">QR<br>PAYMENT</div>
          <p class="small text-secondary mt-2">
            ตัวอย่างระบบเพื่อการศึกษา:
            สามารถนำไฟล์ QR จริงไปวางที่ public/images/payment-qr.png
            และแก้ส่วนแสดงผลนี้เพื่อเชื่อม Payment Gateway
          </p>
          <label>
            <input class="form-check-input" type="checkbox"
                   name="qr_confirmed" value="1">
            ยืนยันว่าได้ดำเนินการชำระเงินแล้ว
          </label>
        </section>

        <button class="btn btn-coffee btn-lg w-100 mt-4" type="submit">
          ยืนยัน Order — ฿<%= Number(total).toFixed(2) %>
        </button>
      </div>
    </form>
  </main>

  <script src="/js/customer.js"></script>
</body>
</html>
`);

put('views/customer/order-success.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <main class="container py-5 order-page">
    <section class="card border-0 shadow-sm text-center">
      <div class="card-body p-4">
        <div class="success-icon">✓</div>
        <h1 class="h3">สั่งซื้อสำเร็จ</h1>
        <p class="text-secondary">หมายเลข Order</p>
        <div class="order-number">#<%= order.order_id %></div>
        <p>โต๊ะ <strong><%= order.table_number %></strong></p>

        <% if (payment && payment.payment_status === 'pending') { %>
          <div class="alert alert-warning">
            กรุณาชำระเงินสดที่แคชเชียร์<br>
            Order จะถูกส่งให้ Barista หลังยืนยันการชำระเงิน
          </div>
        <% } else { %>
          <div class="alert alert-success">ชำระเงินสำเร็จแล้ว</div>
        <% } %>

        <a class="btn btn-coffee w-100"
           href="/customer/orders/<%= order.order_id %>">
          ติดตามสถานะ Order
        </a>
        <a class="btn btn-outline-coffee w-100 mt-2"
           href="/customer/products">
          สั่งสินค้าเพิ่ม
        </a>
      </div>
    </section>
  </main>
</body>
</html>
`);

put('views/customer/order-status.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/customer.css">
</head>
<body class="customer-body">
  <main class="container py-4 order-page"
        id="orderStatusPage" data-order-id="<%= order.order_id %>">
    <a href="/customer/products" class="back-link">← กลับไปยังเมนู</a>

    <section class="card border-0 shadow-sm mt-3">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between">
          <div>
            <span class="text-secondary">Order Number</span>
            <h1 class="order-number">#<%= order.order_id %></h1>
          </div>
          <span class="status-pill status-<%= order.order_status %>"
                id="orderStatusText"><%= order.order_status %></span>
        </div>

        <p class="text-secondary">
          โต๊ะ <%= order.table_number %> · <%= order.created_at %>
        </p>

        <div class="progress-steps" data-current="<%= order.order_status %>">
          <% [
            ['pending', 'รับ Order แล้ว'],
            ['preparing', 'กำลังจัดเตรียม'],
            ['ready', 'พร้อมรับ'],
            ['completed', 'เสร็จสมบูรณ์']
          ].forEach(function(step) { %>
            <div class="progress-step" data-step="<%= step[0] %>">
              <span class="step-dot">✓</span>
              <span><%= step[1] %></span>
            </div>
          <% }) %>
        </div>

        <h2 class="h5 mt-4">รายการสินค้า</h2>
        <% items.forEach(function(item) { %>
          <div class="border-bottom py-3 d-flex justify-content-between">
            <div>
              <strong><%= item.product_name %> × <%= item.quantity %></strong>
              <% if (item.note) { %>
                <div class="small text-secondary"><%= item.note %></div>
              <% } %>
            </div>
            <span>฿<%= Number(item.subtotal).toFixed(2) %></span>
          </div>
        <% }) %>

        <div class="d-flex justify-content-between h5 pt-3">
          <span>ยอดรวม</span>
          <strong class="price">฿<%= Number(order.total_paid).toFixed(2) %></strong>
        </div>

        <div class="status-summary mt-3">
          <div>
            <small>Payment</small>
            <strong id="paymentStatusText">
              <%= payment ? payment.payment_status : 'pending' %>
            </strong>
          </div>
          <div>
            <small>Order</small>
            <strong id="orderStatusSummary"><%= order.order_status %></strong>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script src="/js/customer.js"></script>
</body>
</html>
`);

put('views/cashier/dashboard.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/cashier.css">
</head>
<body>
  <aside class="admin-sidebar">
    <h2>Coffee POS</h2>
    <a class="active" href="/cashier/dashboard">Dashboard</a>
    <a href="/cashier/orders">Orders</a>
    <a href="/cashier/payments">Payments</a>
    <a href="/barista/dashboard">Barista KDS</a>
  </aside>

  <main class="admin-main">
    <header class="admin-header">
      <div>
        <h1 class="h3 mb-0">Cashier Dashboard</h1>
        <span class="text-secondary">ภาพรวม Order และ Payment</span>
      </div>
    </header>

    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %>"><%= flash.message %></div>
    <% } %>

    <div class="row g-3 mb-4">
      <div class="col-6 col-xl-3">
        <div class="summary-card">
          <small>Order ทั้งหมด</small>
          <strong><%= orderSummary.total_orders || 0 %></strong>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="summary-card warning">
          <small>รอดำเนินการ</small>
          <strong><%= orderSummary.pending || 0 %></strong>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="summary-card success">
          <small>ชำระแล้ว</small>
          <strong><%= paymentSummary.paid || 0 %></strong>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="summary-card dark">
          <small>รายรับ</small>
          <strong>฿<%= Number(paymentSummary.revenue || 0).toFixed(2) %></strong>
        </div>
      </div>
    </div>

    <section class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-3">
          <h2 class="h5">Order ล่าสุด</h2>
          <a href="/cashier/orders">ดูทั้งหมด</a>
        </div>
        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Order</th>
                <th>โต๊ะ</th>
                <th>ยอดรวม</th>
                <th>Payment</th>
                <th>Status</th>
                <th>เวลา</th>
              </tr>
            </thead>
            <tbody>
              <% recentOrders.forEach(function(order) { %>
                <tr>
                  <td><a href="/cashier/orders/<%= order.order_id %>">#<%= order.order_id %></a></td>
                  <td><%= order.table_number %></td>
                  <td>฿<%= Number(order.total_paid).toFixed(2) %></td>
                  <td><span class="status-pill status-<%= order.payment_status %>"><%= order.payment_status %></span></td>
                  <td><span class="status-pill status-<%= order.order_status %>"><%= order.order_status %></span></td>
                  <td><%= order.created_at %></td>
                </tr>
              <% }) %>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </main>
</body>
</html>
`);

put('views/cashier/orders.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/cashier.css">
</head>
<body>
  <aside class="admin-sidebar">
    <h2>Coffee POS</h2>
    <a href="/cashier/dashboard">Dashboard</a>
    <a class="active" href="/cashier/orders">Orders</a>
    <a href="/cashier/payments">Payments</a>
    <a href="/barista/dashboard">Barista KDS</a>
  </aside>

  <main class="admin-main">
    <header class="admin-header">
      <h1 class="h3 mb-0">Order Management</h1>
    </header>

    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %>"><%= flash.message %></div>
    <% } %>

    <nav class="filter-tabs mb-3">
      <% ['', 'pending', 'preparing', 'ready', 'completed', 'cancelled']
        .forEach(function(item) { %>
        <a class="<%= status === item ? 'active' : '' %>"
           href="/cashier/orders<%= item ? '?status=' + item : '' %>">
          <%= item || 'ทั้งหมด' %>
        </a>
      <% }) %>
    </nav>

    <div class="row g-3">
      <div class="<%= selected ? 'col-xl-8' : 'col-12' %>">
        <section class="card border-0 shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>โต๊ะ</th>
                  <th>ประเภท</th>
                  <th>ยอดรวม</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <% orders.forEach(function(order) { %>
                  <tr>
                    <td>#<%= order.order_id %></td>
                    <td><%= order.table_number %></td>
                    <td><%= order.order_type %></td>
                    <td>฿<%= Number(order.total_paid).toFixed(2) %></td>
                    <td><span class="status-pill status-<%= order.payment_status %>"><%= order.payment_status %></span></td>
                    <td><span class="status-pill status-<%= order.order_status %>"><%= order.order_status %></span></td>
                    <td>
                      <a class="btn btn-sm btn-outline-coffee"
                         href="/cashier/orders/<%= order.order_id %>">รายละเอียด</a>
                    </td>
                  </tr>
                <% }) %>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <% if (selected) { %>
        <div class="col-xl-4">
          <section class="card border-0 shadow-sm sticky-detail">
            <div class="card-body">
              <div class="d-flex justify-content-between">
                <h2 class="h4">Order #<%= selected.order.order_id %></h2>
                <span class="status-pill status-<%= selected.order.order_status %>">
                  <%= selected.order.order_status %>
                </span>
              </div>
              <p>โต๊ะ <strong><%= selected.order.table_number %></strong></p>

              <% selected.items.forEach(function(item) { %>
                <div class="border-bottom py-3">
                  <div class="d-flex justify-content-between">
                    <strong><%= item.product_name %> × <%= item.quantity %></strong>
                    <span>฿<%= Number(item.subtotal).toFixed(2) %></span>
                  </div>
                  <% if (item.note) { %>
                    <small class="text-secondary"><%= item.note %></small>
                  <% } %>
                </div>
              <% }) %>

              <div class="d-flex justify-content-between h5 mt-3">
                <span>ยอดรวม</span>
                <strong>฿<%= Number(selected.order.total_paid).toFixed(2) %></strong>
              </div>

              <p>
                Payment:
                <span class="status-pill status-<%= selected.payment ? selected.payment.payment_status : 'pending' %>">
                  <%= selected.payment ? selected.payment.payment_status : 'pending' %>
                </span>
              </p>

              <% if (selected.order.order_status === 'ready') { %>
                <form method="post"
                      action="/cashier/orders/<%= selected.order.order_id %>/status?_method=PUT"
                      onsubmit="return confirm('ยืนยันการส่งมอบ Order?')">
                  <button class="btn btn-success w-100">ส่งมอบและปิด Order</button>
                </form>
              <% } %>

              <a class="btn btn-outline-coffee w-100 mt-2"
                 href="/cashier/receipt/<%= selected.order.order_id %>">
                พิมพ์ Receipt
              </a>
            </div>
          </section>
        </div>
      <% } %>
    </div>
  </main>
</body>
</html>
`);

put('views/cashier/payment.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/cashier.css">
</head>
<body>
  <aside class="admin-sidebar">
    <h2>Coffee POS</h2>
    <a href="/cashier/dashboard">Dashboard</a>
    <a href="/cashier/orders">Orders</a>
    <a class="active" href="/cashier/payments">Payments</a>
    <a href="/barista/dashboard">Barista KDS</a>
  </aside>

  <main class="admin-main">
    <header class="admin-header">
      <h1 class="h3 mb-0">Payment Management</h1>
    </header>

    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %>"><%= flash.message %></div>
    <% } %>

    <section class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Order</th>
              <th>โต๊ะ</th>
              <th>วิธีชำระ</th>
              <th>ยอด</th>
              <th>Status</th>
              <th>Cashier</th>
              <th>ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            <% payments.forEach(function(payment) { %>
              <tr>
                <td>#<%= payment.payment_id %></td>
                <td>
                  <a href="/cashier/orders/<%= payment.order_id %>">
                    #<%= payment.order_id %>
                  </a>
                </td>
                <td><%= payment.table_number %></td>
                <td><%= payment.payment_method %></td>
                <td>฿<%= Number(payment.total_paid).toFixed(2) %></td>
                <td>
                  <span class="status-pill status-<%= payment.payment_status %>">
                    <%= payment.payment_status %>
                  </span>
                </td>
                <td>
                  <%= payment.first_name
                    ? payment.first_name + ' ' + payment.last_name
                    : '-' %>
                </td>
                <td>
                  <% if (payment.payment_status === 'pending') { %>
                    <form method="post"
                          action="/cashier/payments/<%= payment.payment_id %>?_method=PUT"
                          class="payment-form">
                      <select class="form-select form-select-sm"
                              name="emp_id" required>
                        <option value="">เลือก Cashier</option>
                        <% cashiers.forEach(function(employee) { %>
                          <option value="<%= employee.emp_id %>">
                            <%= employee.first_name %> <%= employee.last_name %>
                          </option>
                        <% }) %>
                      </select>
                      <input type="hidden" name="payment_status" value="paid">
                      <button class="btn btn-success btn-sm mt-2 w-100">
                        Confirm Paid
                      </button>
                    </form>
                  <% } else { %>
                    <a class="btn btn-sm btn-outline-coffee"
                       href="/cashier/receipt/<%= payment.order_id %>">
                      Receipt
                    </a>
                  <% } %>
                </td>
              </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <script src="/js/cashier.js"></script>
</body>
</html>
`);

put('views/cashier/receipt.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/cashier.css">
</head>
<body class="receipt-body">
  <main class="receipt">
    <header>
      <h1>Coffee QR Ordering</h1>
      <p>Receipt</p>
    </header>

    <div class="receipt-meta">
      <div>Order: #<%= order.order_id %></div>
      <div>Table: <%= order.table_number %></div>
      <div>Time: <%= order.created_at %></div>
      <div>Type: <%= order.order_type %></div>
    </div>

    <hr>

    <% items.forEach(function(item) { %>
      <div class="receipt-item">
        <span>
          <%= item.product_name %> × <%= item.quantity %>
          <% if (item.note) { %>
            <small><%= item.note %></small>
          <% } %>
        </span>
        <strong>฿<%= Number(item.subtotal).toFixed(2) %></strong>
      </div>
    <% }) %>

    <hr>

    <div class="receipt-total">
      <span>Total</span>
      <strong>฿<%= Number(order.total_paid).toFixed(2) %></strong>
    </div>

    <p class="receipt-payment">
      Payment: <%= payment ? payment.payment_method : '-' %><br>
      Status: <%= payment ? payment.payment_status : 'pending' %>
    </p>

    <footer>ขอบคุณที่ใช้บริการ</footer>

    <div class="no-print receipt-actions">
      <button onclick="window.print()">พิมพ์ Receipt</button>
      <a href="/cashier/orders/<%= order.order_id %>">กลับ</a>
    </div>
  </main>
</body>
</html>
`);

put('views/barista/dashboard.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/barista.css">
</head>
<body class="kds-body">
  <header class="kds-header">
    <div>
      <h1>Barista KDS</h1>
      <span>Kitchen Display System</span>
    </div>
    <div class="d-flex gap-2 align-items-center">
      <span class="live-indicator">● LIVE</span>
      <a href="/cashier/dashboard" class="btn btn-outline-light">Cashier</a>
    </div>
  </header>

  <main class="container-fluid py-4">
    <% if (flash) { %>
      <div class="alert alert-<%= flash.type %>"><%= flash.message %></div>
    <% } %>

    <div class="kds-columns">
      <% [
        ['pending', 'Order ใหม่'],
        ['preparing', 'กำลังเตรียม'],
        ['ready', 'พร้อมเสิร์ฟ']
      ].forEach(function(column) { %>
        <section class="kds-column">
          <header>
            <h2><%= column[1] %></h2>
            <span><%= cards.filter(function(card) {
              return card.order_status === column[0];
            }).length %></span>
          </header>

          <div class="kds-list">
            <% cards.filter(function(card) {
              return card.order_status === column[0];
            }).forEach(function(order) { %>
              <article class="kds-card status-border-<%= order.order_status %>">
                <div class="kds-card-header">
                  <strong>#<%= order.order_id %></strong>
                  <span>โต๊ะ <%= order.table_number %></span>
                </div>
                <div class="kds-time"><%= order.created_at %></div>

                <div class="kds-items">
                  <% order.items.forEach(function(item) { %>
                    <div class="kds-item">
                      <strong><%= item.quantity %>× <%= item.product_name %></strong>
                      <% if (item.note) { %>
                        <p><%= item.note %></p>
                      <% } %>
                    </div>
                  <% }) %>
                </div>

                <% if (order.order_status === 'pending') { %>
                  <form method="post"
                        action="/barista/orders/<%= order.order_id %>/status?_method=PUT">
                    <input type="hidden" name="order_status" value="preparing">
                    <button class="btn btn-warning btn-lg w-100">
                      เริ่มจัดเตรียม
                    </button>
                  </form>
                <% } %>

                <% if (order.order_status === 'preparing') { %>
                  <form method="post"
                        action="/barista/orders/<%= order.order_id %>/status?_method=PUT">
                    <input type="hidden" name="order_status" value="ready">
                    <button class="btn btn-success btn-lg w-100">
                      พร้อมเสิร์ฟ
                    </button>
                  </form>
                <% } %>

                <% if (order.order_status === 'ready') { %>
                  <div class="ready-message">รอ Cashier ส่งมอบ</div>
                <% } %>
              </article>
            <% }) %>
          </div>
        </section>
      <% }) %>
    </div>
  </main>

  <script src="/js/barista.js"></script>
</body>
</html>
`);

put('views/barista/orders.ejs', String.raw`
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/barista.css">
</head>
<body class="kds-body">
  <header class="kds-header">
    <div>
      <h1>Barista Orders</h1>
      <span>รายการ Order ที่ชำระเงินแล้ว</span>
    </div>
    <a class="btn btn-outline-light" href="/barista/dashboard">กลับ KDS</a>
  </header>

  <main class="container-fluid py-4">
    <div class="row g-3">
      <% cards.forEach(function(order) { %>
        <div class="col-md-6 col-xl-4">
          <article class="kds-card status-border-<%= order.order_status %>">
            <div class="kds-card-header">
              <strong>#<%= order.order_id %></strong>
              <span>โต๊ะ <%= order.table_number %></span>
            </div>
            <div class="kds-time"><%= order.created_at %></div>
            <% order.items.forEach(function(item) { %>
              <div class="kds-item">
                <strong><%= item.quantity %>× <%= item.product_name %></strong>
                <% if (item.note) { %><p><%= item.note %></p><% } %>
              </div>
            <% }) %>
          </article>
        </div>
      <% }) %>
    </div>
  </main>
</body>
</html>
`);

put('public/css/style.css', String.raw`
:root {
  --coffee: #6f4e37;
  --coffee-dark: #3d2b1f;
  --coffee-light: #efe3d8;
  --cream: #faf7f2;
  --accent: #c78b52;
  --success: #2f855a;
  --danger: #c53030;
}

* {
  box-sizing: border-box;
}

body {
  color: #302721;
}

a {
  color: var(--coffee);
}

.btn-coffee {
  color: #fff;
  background: var(--coffee);
  border-color: var(--coffee);
}

.btn-coffee:hover,
.btn-coffee:focus {
  color: #fff;
  background: var(--coffee-dark);
  border-color: var(--coffee-dark);
}

.btn-outline-coffee {
  color: var(--coffee);
  border-color: var(--coffee);
}

.btn-outline-coffee:hover {
  color: #fff;
  background: var(--coffee);
}

.price {
  color: var(--coffee);
}

.error-card {
  max-width: 520px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: .78rem;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-preparing {
  background: #cfe2ff;
  color: #084298;
}

.status-ready,
.status-paid,
.status-completed {
  background: #d1e7dd;
  color: #0f5132;
}

.status-failed,
.status-cancelled {
  background: #f8d7da;
  color: #842029;
}
`);

put('public/css/customer.css', String.raw`
.customer-body {
  min-height: 100vh;
  background: var(--cream);
  padding-bottom: 72px;
}

.customer-header {
  color: #fff;
  background: linear-gradient(135deg, var(--coffee-dark), var(--coffee));
  box-shadow: 0 5px 20px rgba(61, 43, 31, .2);
}

.customer-content,
.product-detail-page,
.checkout-page,
.order-page {
  max-width: 980px;
}

.hero-card {
  color: #fff;
  padding: 28px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(255,255,255,.15), transparent 35%),
    linear-gradient(135deg, #8b5e3c, #4a3324);
}

.category-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 5px;
}

.category-scroll .btn {
  white-space: nowrap;
  border-radius: 999px;
}

.product-card {
  overflow: hidden;
  border-radius: 18px;
  transition: transform .2s, box-shadow .2s;
}

.product-card:hover {
  transform: translateY(-3px);
}

.product-image,
.detail-image {
  width: 100%;
  object-fit: cover;
}

.product-image {
  height: 210px;
}

.detail-image {
  max-height: 430px;
}

.product-placeholder {
  height: 210px;
  place-items: center;
  background: var(--coffee-light);
  font-size: 4rem;
}

.availability {
  font-size: .75rem;
  font-weight: 700;
}

.availability.available {
  color: var(--success);
}

.availability.unavailable {
  color: var(--danger);
}

.bottom-nav {
  position: fixed;
  z-index: 100;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-around;
  padding: 12px;
  background: #fff;
  box-shadow: 0 -5px 20px rgba(0,0,0,.08);
}

.bottom-nav a {
  color: #6b625d;
  text-decoration: none;
  font-weight: 600;
}

.bottom-nav a.active {
  color: var(--coffee);
}

.cart-badge {
  position: absolute;
  top: -7px;
  right: -7px;
}

.back-link {
  color: var(--coffee);
  font-weight: 600;
  text-decoration: none;
}

.option-row,
.choice-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px;
  margin-bottom: 8px;
  border: 1px solid #e3d8ce;
  border-radius: 13px;
  background: #fff;
  cursor: pointer;
}

.option-row.compact {
  padding: 9px 11px;
  font-size: .9rem;
}

.quantity-control {
  display: grid;
  grid-template-columns: 48px minmax(70px, 100px) 48px;
  gap: 8px;
}

.empty-state {
  padding: 50px 20px;
  border: 2px dashed #d8c9bc;
  border-radius: 18px;
  background: #fff;
  text-align: center;
}

.qr-panel {
  padding: 20px;
  border-radius: 15px;
  background: #f5f5f5;
  text-align: center;
}

.qr-demo {
  display: grid;
  place-items: center;
  width: 180px;
  height: 180px;
  margin: auto;
  border: 12px solid #111;
  background:
    repeating-linear-gradient(45deg, #111 0 8px, #fff 8px 16px);
  color: #fff;
  font-weight: 900;
  text-shadow: 0 1px 4px #000;
}

.success-icon {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin: 0 auto 18px;
  border-radius: 50%;
  color: #fff;
  background: var(--success);
  font-size: 2.5rem;
}

.order-number {
  color: var(--coffee);
  font-size: 2.5rem;
  font-weight: 800;
}

.progress-steps {
  margin-top: 28px;
}

.progress-step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  color: #999;
}

.progress-step:not(:last-child)::after {
  position: absolute;
  top: 34px;
  left: 15px;
  width: 2px;
  height: 28px;
  content: "";
  background: #ddd;
}

.step-dot {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ddd;
  color: #fff;
  font-weight: 700;
}

.progress-step.done {
  color: var(--coffee-dark);
  font-weight: 700;
}

.progress-step.done .step-dot,
.progress-step.done:not(:last-child)::after {
  background: var(--success);
}

.status-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.status-summary > div {
  padding: 14px;
  border-radius: 12px;
  background: #f4eee8;
}

.status-summary small,
.status-summary strong {
  display: block;
}

@media (min-width: 768px) {
  .product-detail-page,
  .checkout-page,
  .order-page {
    max-width: 680px;
  }
}
`);

put('public/css/cashier.css', String.raw`
body {
  min-height: 100vh;
  background: #f5f6f8;
}

.admin-sidebar {
  position: fixed;
  z-index: 10;
  top: 0;
  bottom: 0;
  left: 0;
  width: 240px;
  padding: 28px 18px;
  color: #fff;
  background: var(--coffee-dark);
}

.admin-sidebar h2 {
  margin-bottom: 30px;
  font-size: 1.35rem;
}

.admin-sidebar a {
  display: block;
  margin-bottom: 7px;
  padding: 12px 14px;
  border-radius: 10px;
  color: #e7dbd1;
  text-decoration: none;
}

.admin-sidebar a:hover,
.admin-sidebar a.active {
  color: #fff;
  background: rgba(255,255,255,.14);
}

.admin-main {
  margin-left: 240px;
  padding: 28px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.summary-card {
  min-height: 125px;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 5px 20px rgba(0,0,0,.05);
}

.summary-card small,
.summary-card strong {
  display: block;
}

.summary-card strong {
  margin-top: 14px;
  font-size: 2rem;
}

.summary-card.warning {
  background: #fff5dc;
}

.summary-card.success {
  background: #ddf5e7;
}

.summary-card.dark {
  color: #fff;
  background: var(--coffee-dark);
}

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.filter-tabs a {
  padding: 8px 14px;
  border-radius: 999px;
  background: #fff;
  text-decoration: none;
  text-transform: capitalize;
  white-space: nowrap;
}

.filter-tabs a.active {
  color: #fff;
  background: var(--coffee);
}

.sticky-detail {
  position: sticky;
  top: 20px;
}

.payment-form {
  min-width: 160px;
}

.receipt-body {
  padding: 30px;
  background: #eee;
}

.receipt {
  width: 360px;
  margin: auto;
  padding: 26px;
  background: #fff;
  font-family: monospace;
}

.receipt header,
.receipt footer {
  text-align: center;
}

.receipt h1 {
  font-size: 1.4rem;
}

.receipt-meta {
  line-height: 1.7;
}

.receipt-item,
.receipt-total {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin: 12px 0;
}

.receipt-item small {
  display: block;
  max-width: 220px;
}

.receipt-total {
  font-size: 1.2rem;
}

.receipt-payment {
  text-align: right;
}

.receipt-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.receipt-actions button,
.receipt-actions a {
  flex: 1;
  padding: 10px;
  border: 0;
  color: #fff;
  background: var(--coffee);
  text-align: center;
  text-decoration: none;
}

@media (max-width: 850px) {
  .admin-sidebar {
    position: static;
    display: flex;
    width: 100%;
    padding: 12px;
    overflow-x: auto;
  }

  .admin-sidebar h2 {
    display: none;
  }

  .admin-sidebar a {
    margin: 0 4px;
    white-space: nowrap;
  }

  .admin-main {
    margin-left: 0;
    padding: 18px;
  }
}

@media print {
  .no-print {
    display: none !important;
  }

  .receipt-body {
    padding: 0;
    background: #fff;
  }

  .receipt {
    width: 100%;
  }
}
`);

put('public/css/barista.css', String.raw`
.kds-body {
  min-height: 100vh;
  background: #16191d;
  color: #f4f4f4;
}

.kds-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  background: #252a30;
  border-bottom: 1px solid #3a4047;
}

.kds-header h1 {
  margin: 0;
  font-size: 1.7rem;
}

.kds-header span {
  color: #afb6bd;
}

.live-indicator {
  color: #5ee188 !important;
  font-weight: 700;
}

.kds-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(310px, 1fr));
  gap: 18px;
  overflow-x: auto;
}

.kds-column {
  min-height: calc(100vh - 130px);
  padding: 14px;
  border-radius: 16px;
  background: #20242a;
}

.kds-column > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 5px 15px;
}

.kds-column h2 {
  margin: 0;
  font-size: 1.25rem;
}

.kds-column header span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #353b43;
}

.kds-list {
  display: grid;
  gap: 14px;
}

.kds-card {
  padding: 18px;
  border-radius: 13px;
  background: #fff;
  color: #222;
  box-shadow: 0 5px 18px rgba(0,0,0,.2);
  border-left: 7px solid #888;
}

.status-border-pending {
  border-left-color: #f5bd3d;
}

.status-border-preparing {
  border-left-color: #3b8eea;
}

.status-border-ready {
  border-left-color: #2fb66d;
}

.kds-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.35rem;
}

.kds-time {
  padding-bottom: 12px;
  border-bottom: 1px solid #ddd;
  color: #707070;
}

.kds-item {
  padding: 13px 0;
  border-bottom: 1px dashed #ddd;
  font-size: 1.08rem;
}

.kds-item p {
  margin: 5px 0 0;
  color: #ad3f25;
  font-weight: 600;
}

.ready-message {
  padding: 13px;
  border-radius: 10px;
  background: #d9f5e5;
  color: #126838;
  text-align: center;
  font-weight: 800;
}

@media (max-width: 1000px) {
  .kds-columns {
    grid-template-columns: repeat(3, 85vw);
  }
}
`);

put('public/js/customer.js', String.raw`
document.addEventListener('DOMContentLoaded', function () {
  const quantity = document.querySelector('#quantity');
  const minus = document.querySelector('.quantity-minus');
  const plus = document.querySelector('.quantity-plus');
  const addButton = document.querySelector('#addButton');
  const priceText = document.querySelector('#calculatedPrice');
  const optionCheckboxes = document.querySelectorAll('.option-checkbox');

  function calculatePrice() {
    if (!quantity || !addButton || !priceText) return;

    let unitPrice = Number(addButton.dataset.basePrice || 0);

    optionCheckboxes.forEach(function (checkbox) {
      if (checkbox.checked) {
        unitPrice += Number(checkbox.dataset.extra || 0);
      }
    });

    const qty = Math.max(1, Number(quantity.value || 1));
    priceText.textContent = (unitPrice * qty).toFixed(2);
  }

  if (minus) {
    minus.addEventListener('click', function () {
      quantity.value = Math.max(1, Number(quantity.value || 1) - 1);
      calculatePrice();
    });
  }

  if (plus) {
    plus.addEventListener('click', function () {
      quantity.value = Math.min(99, Number(quantity.value || 1) + 1);
      calculatePrice();
    });
  }

  if (quantity) quantity.addEventListener('input', calculatePrice);
  optionCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', calculatePrice);
  });

  const paymentMethods = document.querySelectorAll('.payment-method');
  const qrPanel = document.querySelector('#qrPaymentPanel');

  function toggleQrPanel() {
    if (!qrPanel) return;

    const selected = document.querySelector(
      '.payment-method[name="payment_method"]:checked'
    );

    qrPanel.classList.toggle(
      'd-none',
      !selected || selected.value !== 'qr_payment'
    );
  }

  paymentMethods.forEach(function (radio) {
    radio.addEventListener('change', toggleQrPanel);
  });

  toggleQrPanel();

  const statusPage = document.querySelector('#orderStatusPage');

  function renderProgress(status) {
    const order = ['pending', 'preparing', 'ready', 'completed'];
    const currentIndex = order.indexOf(status);

    document.querySelectorAll('.progress-step').forEach(function (element) {
      const index = order.indexOf(element.dataset.step);
      element.classList.toggle(
        'done',
        currentIndex >= index && currentIndex >= 0
      );
    });
  }

  if (statusPage) {
    const orderId = statusPage.dataset.orderId;
    const initialStatus = document
      .querySelector('.progress-steps')
      .dataset.current;

    renderProgress(initialStatus);

    setInterval(async function () {
      try {
        const response = await fetch(
          '/customer/orders/' + orderId + '/status',
          { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) return;

        const data = await response.json();
        const orderText = document.querySelector('#orderStatusText');
        const orderSummary = document.querySelector('#orderStatusSummary');
        const paymentText = document.querySelector('#paymentStatusText');

        orderText.textContent = data.orderStatus;
        orderText.className = 'status-pill status-' + data.orderStatus;
        orderSummary.textContent = data.orderStatus;
        paymentText.textContent = data.paymentStatus;
        renderProgress(data.orderStatus);
      } catch (_) {
        // Keep the page usable if polling temporarily fails.
      }
    }, 10000);
  }
});
`);

put('public/js/cashier.js', String.raw`
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.payment-form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      const employee = form.querySelector('[name="emp_id"]');

      if (!employee || !employee.value) {
        event.preventDefault();
        alert('กรุณาเลือก Cashier');
        return;
      }

      if (!confirm('ยืนยันว่าได้รับชำระเงินแล้ว?')) {
        event.preventDefault();
      }
    });
  });
});
`);

put('public/js/barista.js', String.raw`
document.addEventListener('DOMContentLoaded', function () {
  const hasFocusedControl = function () {
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']
      .includes(document.activeElement.tagName);
  };

  setInterval(function () {
    if (!hasFocusedControl()) {
      window.location.reload();
    }
  }, 15000);
});
`);

put('public/images/.gitkeep', '');

put('README.md', String.raw`
# Coffee QR Ordering System

ระบบสั่งเครื่องดื่มและขนมผ่าน QR Code สำหรับโครงการศึกษา

## เทคโนโลยี

- Node.js
- Express.js
- EJS
- Bootstrap 5
- SQLite
- sqlite3
- MVC
- Monolithic Architecture

## การติดตั้ง

1. นำไฟล์ฐานข้อมูลเดิมชื่อ coffee.db มาวางในโฟลเดอร์หลักของโปรเจกต์
2. ติดตั้ง Dependency

    npm install

3. เริ่มระบบ

    npm start

4. เปิดระบบที่ http://localhost:3000

## URL ตัวอย่าง

- ลูกค้าโต๊ะ 1: http://localhost:3000/customer?table=1
- Cashier: http://localhost:3000/cashier/dashboard
- Barista: http://localhost:3000/barista/dashboard

## ข้อกำหนดฐานข้อมูล

โปรเจกต์นี้ไม่สร้างฐานข้อมูล ไม่สร้าง Table ไม่ทำ Migration และไม่ทำ Seed Data

ระบบจะตรวจสอบไฟล์ coffee.db ก่อนเปิด Connection และใช้ SQLite ในโหมด
OPEN_READWRITE เท่านั้น หากไม่พบไฟล์ ระบบจะหยุดทำงานพร้อมแสดงข้อผิดพลาด

ชื่อคอลัมน์ Product ที่ใช้ตาม ERD ล่าสุดคือ category ไม่ใช่ category_id

## Payment QR

QR Payment ในโปรเจกต์เป็น Simulation เพื่อการศึกษา การนำไปใช้งานจริงต้องเชื่อมต่อ
Payment Gateway และตรวจสอบผลชำระเงินจาก Server-to-Server Callback ห้ามเชื่อถือ
การยืนยันจาก Browser เพียงอย่างเดียว

## หมายเหตุ Schema

Payment ที่สร้างจาก QR Payment จะยังไม่มี emp_id ดังนั้น Schema ควรอนุญาตให้ emp_id
เป็น NULL หากฐานข้อมูลกำหนด NOT NULL จำเป็นต้องปรับ Flow ให้ Payment Gateway หรือ
Cashier Employee เป็นผู้ดำเนินการ โดยไม่ควรให้ Application เปลี่ยน Schema อัตโนมัติ

## Production

ก่อนนำขึ้น Production ควรเพิ่ม:

- Authentication และ Authorization สำหรับ Cashier และ Barista
- Session Store ภายนอกแทน MemoryStore
- CSRF Protection
- HTTPS
- Secure Cookie
- Rate Limiting
- Payment Gateway จริง
- Validation และ Logging เพิ่มเติม
`);

console.log('');
console.log('สร้างโปรเจกต์สำเร็จที่: ' + root);
console.log('');
console.log('ขั้นตอนถัดไป:');
console.log('1. นำ coffee.db ไปวางที่ ' + path.join(root, 'coffee.db'));
console.log('2. cd coffee-ordering');
console.log('3. npm install');
console.log('4. npm start');
console.log('');
console.log('หมายเหตุ: Script นี้ไม่ได้สร้างหรือแก้ไขไฟล์ coffee.db');