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
