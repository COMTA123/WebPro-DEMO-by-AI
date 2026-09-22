const express = require('express');
const controller = require('../controllers/baristaController');

const router = express.Router();

router.get('/dashboard', controller.dashboard);
router.get('/orders', controller.orders);
router.get('/orders/:id', controller.orders);
router.put('/orders/:id/status', controller.updateStatus);

module.exports = router;
