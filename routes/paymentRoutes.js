const express = require('express');
const controller = require('../controllers/paymentController');

const router = express.Router();

router.get('/:id', controller.detail);

module.exports = router;
