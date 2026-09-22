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
const PORT = 3000;

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
