const TableSession = require('../models/tableSessionModel');

module.exports = async function customerSession(req, res, next) {
  try {
    const sessionId = req.session.tableSessionId;

    if (!sessionId) {
      req.session.flash = {
        type: 'warning',
        message: 'กรุณาสแกน QR Code ที่โต๊ะก่อนสั่งสินค้า'
      };
      return res.redirect('/');
    }

    const tableSession = await TableSession.findActiveById(sessionId);

    if (!tableSession) {
      req.session.tableSessionId = null;
      req.session.tableId = null;
      req.session.cart = [];

      return res.status(401).render('error', {
        title: 'Session หมดอายุ',
        message: 'Session ของโต๊ะสิ้นสุดแล้ว กรุณาสแกน QR Code ใหม่'
      });
    }

    req.tableSession = tableSession;
    next();
  } catch (error) {
    next(error);
  }
};
