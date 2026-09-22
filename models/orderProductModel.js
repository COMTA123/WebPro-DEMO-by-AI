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
