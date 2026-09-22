const database = require('../config/database');

module.exports = {
  findById(empId) {
    return database.get(
      'SELECT * FROM Employee WHERE emp_id = ?',
      [empId]
    );
  },

  findCashiers() {
    return database.all(
      "SELECT * FROM Employee WHERE role = 'Cashier' ORDER BY first_name, last_name"
    );
  }
};
