const Database = require('../config/database');
const logger = require('../config/logger');

class ReferralService {
  static generateReferralCode(companyName) {
    const prefix = companyName.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${random}`;
  }

  static async createReferral(companyId, companyName) {
    try {
      const referralCode = this.generateReferralCode(companyName);
      
      await Database.insert('referrals', {
        company_id: companyId,
        referral_code: referralCode,
        referral_credits: 0
      });

      return referralCode;
    } catch (error) {
      logger.error('Failed to create referral', { error: error.message, companyId });
      throw error;
    }
  }

  static async applyReferralCode(companyId, referralCode) {
    try {
      const referral = await Database.getOne(
        'SELECT * FROM referrals WHERE referral_code = ?', [referralCode]
      );

      if (!referral) throw new Error('Invalid referral code');

      await Database.update(
        'referrals',
        { referred_by: referral.company_id },
        'company_id = ?', [companyId]
      );

      // Give referrer credits
      await Database.update(
        'referrals',
        { referral_credits: referral.referral_credits + 100 },
        'company_id = ?', [referral.company_id]
      );

      logger.info('Referral applied', { companyId, referredBy: referral.company_id });
      return true;
    } catch (error) {
      logger.error('Failed to apply referral', { error: error.message, companyId, referralCode });
      throw error;
    }
  }

  static async getReferralCredits(companyId) {
    const referral = await Database.getOne(
      'SELECT referral_credits FROM referrals WHERE company_id = ?', [companyId]
    );
    return referral ? referral.referral_credits : 0;
  }
}

module.exports = ReferralService;
