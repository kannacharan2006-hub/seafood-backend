const { validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      message: errors.array()[0].msg
    });
  };
};

describe('Validation Middleware', () => {
  describe('Email Validation', () => {
    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid',
        'test@',
        '@test.com',
        'test@.com',
        'test@test',
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@test.com',
        'user.name@domain.co.in',
        'user+tag@example.org',
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });
  });

  describe('Password Validation', () => {
    it('should reject passwords shorter than 6 characters', () => {
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('123')).toBe(false);
    });

    it('should accept passwords with 6+ characters', () => {
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('password123')).toBe(true);
    });
  });

  describe('OTP Validation', () => {
    it('should reject invalid OTP formats', () => {
      expect(isValidOtp('12345')).toBe(false);
      expect(isValidOtp('1234567')).toBe(false);
      expect(isValidOtp('abc123')).toBe(false);
    });

    it('should accept valid 6-digit OTP', () => {
      expect(isValidOtp('123456')).toBe(true);
      expect(isValidOtp('000000')).toBe(true);
      expect(isValidOtp('999999')).toBe(true);
    });
  });
});

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPassword(password) {
  return password && password.length >= 6;
}

function isValidOtp(otp) {
  return /^\d{6}$/.test(otp);
}
