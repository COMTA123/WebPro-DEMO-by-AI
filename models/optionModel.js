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
