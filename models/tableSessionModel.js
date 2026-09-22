const database = require('../config/database');

module.exports = {
  create(tableId) {
    return database.run(
      "INSERT INTO Table_Session (table_id, start_time, end_time) " +
      "VALUES (?, datetime('now', 'localtime'), NULL)",
      [tableId]
    );
  },

  findById(sessionId) {
    return database.get(
      'SELECT ts.*, t.table_number, t.status AS table_status ' +
      'FROM Table_Session ts ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'WHERE ts.session_id = ?',
      [sessionId]
    );
  },

  findActiveById(sessionId) {
    return database.get(
      'SELECT ts.*, t.table_number, t.status AS table_status ' +
      'FROM Table_Session ts ' +
      'JOIN "Table" t ON t.table_id = ts.table_id ' +
      'WHERE ts.session_id = ? AND ts.end_time IS NULL',
      [sessionId]
    );
  },

  close(sessionId) {
    return database.run(
      "UPDATE Table_Session " +
      "SET end_time = datetime('now', 'localtime') " +
      "WHERE session_id = ? AND end_time IS NULL",
      [sessionId]
    );
  }
};
