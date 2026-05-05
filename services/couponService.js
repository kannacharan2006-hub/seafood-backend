const Database = require('../config/database');
const logger = require('../config/logger');

class CouponService {
  static async createCoupon(code, discountType, discountValue, validDays = 30, maxUses = 100) {
    try {
      await Database.insert('coupons', {
        code: code.toUpperCase(),
        discount_type: discountType, // 'percentage' or 'fixed'
        discount_value: discountValue,
        valid_until: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000),
        max_uses: maxUses,
        used_count: 0
      });

      return { success: true, message: 'Coupon created' };
    } catch (error) {
      logger.error('Failed to create coupon', { error: error.message, code });
      throw error;
    }
  }

  static async validateCoupon(code) {
    const coupon = await Database.getOne(
      'SELECT * FROM coupons WHERE code = ? AND used_count < max_uses AND valid_until > NOW()',
      [code.toUpperCase()]
    );

    if (!coupon) throw new Error('Invalid or expired coupon');

    return coupon;
  }

  static async applyCoupon(code, planPrice) {
    try {
      const coupon = await this.validateCoupon(code);

      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = Math.floor(planPrice * (coupon.discount_value / 100));
      } else {
        discountAmount = Math.min(coupon.discount_value * 100, planPrice); // discount_value in rupees
      }

      const finalPrice = Math.max(0, planPrice - discountAmount);

      // Increment used count
      await Database.update(
        'coupons',
        { used_count: coupon.used_count + 1 },
        'id = ?', [coupon.id]
      );

      return {
        originalPrice: planPrice,
        discount: discountAmount,
        finalPrice: finalPrice,
        coupon: coupon.code
      };
    } catch (error) {
      logger.error('Failed to apply coupon', { error: error.message, code });
      throw error;
    }
  }
}

module.exports = CouponService;
