/**
 * Email templates for verification and password reset
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate verification email content
 */
export function verificationEmail(link: string): EmailContent {
  const subject = 'Verify your email address';
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Verify your email</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="white"/>
                      </svg>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                      Welcome! We're excited to have you on board. To get started, please verify your email address by clicking the button below.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                      <tr>
                        <td align="center" style="padding: 0;">
                          <a href="${link}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative Link -->
                    <div style="margin: 32px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #667eea;">
                      <p style="margin: 0 0 12px; color: #64748b; font-size: 14px; font-weight: 600;">
                        Button not working?
                      </p>
                      <p style="margin: 0; color: #475569; font-size: 13px; word-break: break-all; line-height: 1.5;">
                        Copy and paste this link into your browser:<br>
                        <a href="${link}" style="color: #667eea; text-decoration: none;">${link}</a>
                      </p>
                    </div>
                    
                    <!-- Info Box -->
                    <div style="margin-top: 32px; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>⏰ Important:</strong> This verification link will expire in <strong>24 hours</strong> for security reasons.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 12px; color: #64748b; font-size: 13px; line-height: 1.5;">
                      If you didn't create an account with us, you can safely ignore this email.
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      © ${new Date().getFullYear()} Chat App. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Bottom Spacing -->
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
                This email was sent by Chat App
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  const text = `
Verify Your Email Address

Welcome! We're excited to have you on board.

To verify your email address, please click the link below:
${link}

This verification link will expire in 24 hours for security reasons.

If the button doesn't work, copy and paste the link above into your browser.

If you didn't create an account with us, you can safely ignore this email.

© ${new Date().getFullYear()} Chat App. All rights reserved.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate password reset email content
 */
export function passwordResetEmail(link: string): EmailContent {
  const subject = 'Reset your password';
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Reset your password</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 40px 30px; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1L3 5V11C3 16.55 6.16 21.74 12 23C17.84 21.74 21 16.55 21 11V5L12 1ZM12 7C13.4 7 14.8 8.6 14.8 10V11H16V17H8V11H9.2V10C9.2 8.6 10.6 7 12 7ZM12 8.2C11.2 8.2 10.4 8.7 10.4 10V11H13.6V10C13.6 8.7 12.8 8.2 12 8.2Z" fill="white"/>
                      </svg>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Reset Your Password</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password. Click the button below to create a new secure password for your account.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                      <tr>
                        <td align="center" style="padding: 0;">
                          <a href="${link}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative Link -->
                    <div style="margin: 32px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #f5576c;">
                      <p style="margin: 0 0 12px; color: #64748b; font-size: 14px; font-weight: 600;">
                        Button not working?
                      </p>
                      <p style="margin: 0; color: #475569; font-size: 13px; word-break: break-all; line-height: 1.5;">
                        Copy and paste this link into your browser:<br>
                        <a href="${link}" style="color: #f5576c; text-decoration: none;">${link}</a>
                      </p>
                    </div>
                    
                    <!-- Security Warning -->
                    <div style="margin-top: 32px; padding: 16px; background-color: #fee2e2; border-radius: 8px; border-left: 4px solid #ef4444;">
                      <p style="margin: 0 0 8px; color: #991b1b; font-size: 13px; font-weight: 600; line-height: 1.5;">
                        🔒 Security Notice
                      </p>
                      <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
                        If you didn't request a password reset, please ignore this email. Your password will remain unchanged and your account is secure.
                      </p>
                    </div>
                    
                    <!-- Expiry Info -->
                    <div style="margin-top: 24px; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>⏰ Important:</strong> This password reset link will expire in <strong>60 minutes</strong> for your security.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 12px; color: #64748b; font-size: 13px; line-height: 1.5;">
                      For security reasons, all active sessions will be logged out after you reset your password.
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      © ${new Date().getFullYear()} Chat App. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Bottom Spacing -->
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
                This email was sent by Chat App
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  const text = `
Reset Your Password

We received a request to reset your password.

To reset your password, please click the link below:
${link}

This password reset link will expire in 60 minutes for your security.

SECURITY NOTICE:
If you didn't request a password reset, please ignore this email. Your password will remain unchanged and your account is secure.

For security reasons, all active sessions will be logged out after you reset your password.

© ${new Date().getFullYear()} Chat App. All rights reserved.
  `.trim();

  return { subject, html, text };
}

