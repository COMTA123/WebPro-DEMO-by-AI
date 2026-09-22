const Product = require('../models/productModel');
const Option = require('../models/optionModel');

module.exports = {
  async list(req, res, next) {
    try {
      const products = await Product.findAll(req.query.category || '');
      res.json(products);
    } catch (error) {
      next(error);
    }
  },

  async detail(req, res, next) {
    try {
      const product = await Product.findById(Number(req.params.id));

      if (!product) {
        return res.status(404).json({ message: 'ไม่พบสินค้า' });
      }

      const options = await Option.findAvailableByProduct(product.product_id);
      res.json({ ...product, options });
    } catch (error) {
      next(error);
    }
  }
};
