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
