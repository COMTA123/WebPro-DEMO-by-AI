const database = require('../config/database');

const detailSql =
  'SELECT o.*, ts.table_id, t.table_number, ' +
  "COALESCE((" +
  " SELECT p.payment_status FROM Payment p " +
  " WHERE p.order_id = o.order_id " +
  " ORDER BY p.payment_id DESC LIMIT 1" +
  "), 'pending') AS payment_status, " +
  '(SELECT p.payment_method FROM Payment p ' +
  ' WHERE p.order_id = o.order_id ' +
  ' ORDER BY p.payment_id DESC LIMIT 1) AS payment_method ' +
  'FROM "Order" o ' +
  'JOIN Table_Session ts ON ts.session_id = o.session_id ' +
  'JOIN "Table" t ON t.table_id = ts.table_id ';

module.exports = {
  create(data) {
    return database.run(
      'INSERT INTO "Order" ' +
      '(session_id, order_type, order_status, total_price, created_at) ' +
      "VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
      [
        data.sessionId,
        data.orderType,
        data.orderStatus,
        data.totalPaid
      ]
    );
  },

  findById(orderId) {
    return database.get(
      detailSql + 'WHERE o.order_id = ?',
      [orderId]
    );
  },

  findByIdAndSession(orderId, sessionId) {
    return database.get(
      detailSql + 'WHERE o.order_id = ? AND o.session_id = ?',
      [orderId, sessionId]
    );
  },

  list(status) {
    let sql = detailSql;
    const params = [];

    if (status) {
      sql += 'WHERE o.order_status = ? ';
      params.push(status);
    }

    sql += 'ORDER BY o.created_at DESC, o.order_id DESC';
    return database.all(sql, params);
  },

  listPaidForBarista() {
    return database.all(
      detailSql +
      "WHERE o.order_status IN ('pending', 'preparing', 'ready') " +
      "AND EXISTS (" +
      " SELECT 1 FROM Payment p " +
      " WHERE p.order_id = o.order_id AND p.payment_status = 'paid'" +
      ') ORDER BY ' +
      "CASE o.order_status " +
      "WHEN 'preparing' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, " +
      'o.created_at ASC'
    );
  },

  updateStatus(orderId, status) {
    return database.run(
      'UPDATE "Order" SET order_status = ? WHERE order_id = ?',
      [status, orderId]
    );
  },

  summary() {
    return database.get(
      'SELECT COUNT(*) AS total_orders, ' +
      "SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) AS pending, " +
      "SUM(CASE WHEN order_status = 'preparing' THEN 1 ELSE 0 END) AS preparing, " +
      "SUM(CASE WHEN order_status = 'ready' THEN 1 ELSE 0 END) AS ready, " +
      "SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed " +
      'FROM "Order"'
    );
  }
};
