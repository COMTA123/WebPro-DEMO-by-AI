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
