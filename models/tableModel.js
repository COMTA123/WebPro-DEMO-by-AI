const database = require('../config/database');

module.exports = {
  findById(tableId) {
    return database.get(
      'SELECT * FROM "Table" WHERE table_id = ?',
      [tableId]
    );
  },

  updateStatus(tableId, status) {
    return database.run(
      'UPDATE "Table" SET status = ? WHERE table_id = ?',
      [status, tableId]
    );
  }
};
