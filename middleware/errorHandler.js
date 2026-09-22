module.exports = function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const production = process.env.NODE_ENV === 'production';

  res.status(status).render('error', {
    title: status === 500 ? 'เกิดข้อผิดพลาด' : 'ไม่สามารถดำเนินการได้',
    message: production && status === 500
      ? 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
      : error.userMessage || error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
  });
};
