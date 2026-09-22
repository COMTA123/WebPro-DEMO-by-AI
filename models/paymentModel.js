const database = require('../config/database');

module.exports = {
  create(data) {
    return database.run(
      'INSERT INTO Payment ' +
      '(emp_id, order_id, payment_method, payment_status, payment_time) ' +
      "VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
      [
        data.empId || null,
        data.orderId,
        data.paymentMethod,
        data.paymentStatus
      ]
    );
  },

  findById(paymentId) {
    return database.get(
      'SELECT * FROM Payment WHERE payment_id = ?',
      [paymentId]
    );
  },

  findByOrder(orderId) {
    return database.all(
      'SELECT p.*, e.first_name, e.last_name ' +
      'FROM Payment p ' +
      'LEFT JOIN Employee e ON e.emp_id = p.emp_id ' +
      'WHERE p.order_id = ? ORDER BY p.payment_id DESC',
      [orderId]
    );
  },

  list() {
    return database.all(
      'SELECT p.*, o.total_price, o.order_status, t.table_number, ' +
      'e.first_name, e.last_name ' +
      'FROM Payment p ' +
      'JOIN "Order" o ON o.order_id = p.order_id ' +
      'JOIN Table_Session ts ON ts.session_id = o.session_id ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'LEFT JOIN Employee e ON e.emp_id = p.emp_id ' +
      'ORDER BY p.payment_time DESC, p.payment_id DESC'
    );
  },

  updateStatus(paymentId, status, empId) {
    return database.run(
      "UPDATE Payment SET payment_status = ?, emp_id = ?, " +
      "payment_time = datetime('now', 'localtime') " +
      'WHERE payment_id = ?',
      [status, empId || null, paymentId]
    );
  },

  summary() {
    return database.get(
      'SELECT COUNT(*) AS total_payments, ' +
      "SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pending, " +
      "SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid, " +
      "COALESCE(SUM(CASE WHEN payment_status = 'paid' " +
      'THEN o.total_price ELSE 0 END), 0) AS revenue ' +
      'FROM Payment p JOIN "Order" o ON o.order_id = p.order_id'
    );
  }
};
