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
