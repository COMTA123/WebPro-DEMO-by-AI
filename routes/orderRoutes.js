const express = require('express');
const controller = require('../controllers/orderController');

const router = express.Router();

router.get('/:id', controller.detail);

module.exports = router;
