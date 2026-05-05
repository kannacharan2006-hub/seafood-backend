-- Migration: Add subscription, referral, and coupon tables

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  plan_id VARCHAR(50),
  status ENUM('pending', 'active', 'cancelled', 'expired') DEFAULT 'pending',
  razorpay_customer_id VARCHAR(255),
  razorpay_subscription_id VARCHAR(255),
  current_period_start DATETIME,
  current_period_end DATETIME,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_company_status (company_id, status)
);

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referred_by INT NULL,
  referral_credits INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_by) REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_referral_code (referral_code)
);

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type ENUM('percentage', 'fixed') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  valid_until DATETIME NOT NULL,
  max_uses INT DEFAULT 100,
  used_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_valid_until (valid_until)
);

-- Add Razorpay fields to companies table if not exists
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free';
