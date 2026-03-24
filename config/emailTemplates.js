class EmailTemplates {
  static passwordReset(otp, userName) {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Seafood ERP</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Enterprise Resource Planning</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px;">Password Reset Request</h2>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Hello ${userName},
              </p>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                We received a request to reset your password. Use the following OTP code to reset your password:
              </p>
              
              <!-- OTP Box -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
                <p style="color: #64748b; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                <p style="color: #1e3a5f; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: monospace;">${otp}</p>
              </div>
              
              <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; color: #92400e; font-size: 14px; border-radius: 0 8px 8px 0;">
                ⚠️ This code is valid for <strong>15 minutes</strong>. If you didn't request this, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                © ${year} Seafood ERP. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  static welcomeEmail(userName, email, companyName) {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Seafood ERP</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Enterprise Resource Planning</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <span style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; line-height: 60px; font-size: 30px;">✓</span>
              </div>
              
              <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; text-align: center;">Welcome Aboard!</h2>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Your account has been successfully created for <strong>${companyName}</strong>.
              </p>
              
              <!-- Account Details -->
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-size: 14px;">Email</span>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                      <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #64748b; font-size: 14px;">Role</span>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #2563eb; font-size: 14px; font-weight: 500;">Owner</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 15px; color: #065f46; font-size: 14px; border-radius: 0 8px 8px 0;">
                ✓ Your account is ready. You can now login to Seafood ERP.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                © ${year} Seafood ERP. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  static passwordResetSuccess(userName) {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Seafood ERP</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 25px;">
                <span style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; line-height: 60px; font-size: 30px;">✓</span>
              </div>
              <h2 style="color: #1e293b; margin: 0 0 15px; font-size: 24px; text-align: center;">Password Changed Successfully</h2>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 20px 0; text-align: center;">
                Your password has been changed successfully.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">© ${year} Seafood ERP</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

module.exports = EmailTemplates;
