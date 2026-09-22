const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'coffee.db');

if (!fs.existsSync(databasePath)) {
  throw new Error(
    'ไม่พบไฟล์ coffee.db กรุณานำฐานข้อมูลที่เตรียมไว้แล้วไปวางที่: ' +
    databasePath +
    ' ระบบจะไม่สร้างฐานข้อมูลใหม่อัตโนมัติ'
  );
}

let resolveReady;
let rejectReady;

const ready = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

const db = new sqlite3.Database(
  databasePath,
  sqlite3.OPEN_READWRITE,
  (error) => {
    if (error) {
      rejectReady(new Error('เชื่อมต่อ coffee.db ไม่สำเร็จ: ' + error.message));
      return;
    }

    db.run('PRAGMA foreign_keys = ON', (pragmaError) => {
      if (pragmaError) {
        rejectReady(
          new Error('เปิดใช้งาน Foreign Key ไม่สำเร็จ: ' + pragmaError.message)
        );
        return;
      }

      console.log('Connected to the existing SQLite database.');
      resolveReady();
    });
  }
);

db.configure('busyTimeout', 5000);

async function all(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

async function get(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

async function run(sql, params = []) {
  await ready;
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({
        id: this.lastID,
        changes: this.changes
      });
    });
  });
}

let transactionQueue = Promise.resolve();

function transaction(work) {
  const task = transactionQueue.then(async () => {
    await run('BEGIN IMMEDIATE TRANSACTION');

    try {
      const result = await work();
      await run('COMMIT');
      return result;
    } catch (error) {
      try {
        await run('ROLLBACK');
      } catch (_) {
        // Preserve the original error.
      }
      throw error;
    }
  });

  transactionQueue = task.catch(() => undefined);
  return task;
}

module.exports = {
  db,
  ready,
  databasePath,
  all,
  get,
  run,
  transaction
};
