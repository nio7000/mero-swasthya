import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import SMTP_EMAIL, SMTP_PASSWORD

# In-memory OTP store: { email: otp_code }
_otp_store: dict[str, str] = {}


def _send_email(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Mero Swasthya <{SMTP_EMAIL}>"
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to, msg.as_string())


def generate_otp(email: str) -> str:
    """Generate a 6-digit OTP, store it, and return it."""
    otp = "".join(random.choices(string.digits, k=6))
    _otp_store[email] = otp
    return otp


def verify_otp(email: str, otp: str) -> bool:
    """Return True and clear OTP if valid, False otherwise."""
    if _otp_store.get(email) == otp:
        del _otp_store[email]
        return True
    return False


def generate_temp_password() -> str:
    """Generate a random 8-char temporary password."""
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=8))


def send_otp_email(to: str, otp: str, full_name: str):
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Mero Swasthya — Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:'IBM Plex Sans','Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;padding:48px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

      <!-- TOPBAR -->
      <tr>
        <td style="background:#154360;padding:0 36px;height:56px;border-radius:8px 8px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;">
                <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                  Mero <em style="font-style:italic;color:#AED6F1;">Swasthya</em>
                </span>
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#AED6F1;">AI Patient Care</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- DIVIDER LINE -->
      <tr><td style="background:#2E86C1;height:3px;"></td></tr>

      <!-- BODY -->
      <tr>
        <td style="background:#ffffff;padding:40px 36px 36px;border-radius:0 0 8px 8px;border:1.5px solid #CDD5DF;border-top:none;">

          <!-- Label -->
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2E86C1;">Email Verification</p>

          <!-- Greeting -->
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#154360;line-height:1.3;">Hello, {full_name}</h1>

          <!-- Body text -->
          <p style="margin:0 0 32px;font-size:15px;color:#6B7280;line-height:1.7;">
            You requested to register with <strong style="color:#374151;">Mero Swasthya</strong>. Enter the code below to verify your email address and complete your account setup.
          </p>

          <!-- OTP Block -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
            <tr>
              <td style="background:#F4F6F9;border:1.5px solid #CDD5DF;border-radius:6px;padding:28px 20px;text-align:center;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6B7280;">Your Verification Code</p>
                <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:16px;color:#154360;font-family:'Courier New',Courier,monospace;">{otp}</p>
              </td>
            </tr>
          </table>

          <!-- Expiry note -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-left:3px solid #CDD5DF;padding:10px 14px;">
                <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
                  This code expires in <strong style="color:#374151;">10 minutes</strong>. Do not share it with anyone.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#A9B4C2;line-height:1.8;">
            Mero Swasthya &mdash; NiO's Hospital, Birtamode-5, Jhapa, Nepal<br>
            If you did not request this, you can safely ignore this email.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""
    _send_email(to, "Mero Swasthya — Your Verification Code", html)


def send_temp_password_email(to: str, full_name: str, temp_password: str):
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Mero Swasthya — Account Ready</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:'IBM Plex Sans','Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;padding:48px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

      <!-- TOPBAR -->
      <tr>
        <td style="background:#154360;padding:0 36px;height:56px;border-radius:8px 8px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;">
                <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                  Mero <em style="font-style:italic;color:#AED6F1;">Swasthya</em>
                </span>
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#AED6F1;">AI Patient Care</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- DIVIDER LINE -->
      <tr><td style="background:#2E86C1;height:3px;"></td></tr>

      <!-- BODY -->
      <tr>
        <td style="background:#ffffff;padding:40px 36px 36px;border-radius:0 0 8px 8px;border:1.5px solid #CDD5DF;border-top:none;">

          <!-- Label -->
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2E86C1;">Account Access</p>

          <!-- Greeting -->
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#154360;line-height:1.3;">Hello, {full_name}</h1>

          <!-- Body text -->
          <p style="margin:0 0 32px;font-size:15px;color:#6B7280;line-height:1.7;">
            Your <strong style="color:#374151;">Mero Swasthya</strong> account has been set up. Use the temporary password below to sign in — you will be asked to set a new secure password immediately after.
          </p>

          <!-- Password Block -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="background:#F4F6F9;border:1.5px solid #CDD5DF;border-radius:6px;padding:28px 20px;text-align:center;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6B7280;">Temporary Password</p>
                <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:4px;color:#154360;font-family:'Courier New',Courier,monospace;">{temp_password}</p>
              </td>
            </tr>
          </table>

          <!-- Steps -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="background:#F4F6F9;border:1.5px solid #CDD5DF;border-radius:6px;padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;">How to get started</p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:5px 0;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:24px;vertical-align:top;padding-top:1px;">
                            <span style="display:inline-block;width:20px;height:20px;background:#154360;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;">1</span>
                          </td>
                          <td style="padding-left:10px;font-size:14px;color:#374151;line-height:1.6;">Open the Mero Swasthya login page</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:24px;vertical-align:top;padding-top:1px;">
                            <span style="display:inline-block;width:20px;height:20px;background:#154360;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;">2</span>
                          </td>
                          <td style="padding-left:10px;font-size:14px;color:#374151;line-height:1.6;">Sign in with your email and the temporary password above</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:24px;vertical-align:top;padding-top:1px;">
                            <span style="display:inline-block;width:20px;height:20px;background:#154360;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;">3</span>
                          </td>
                          <td style="padding-left:10px;font-size:14px;color:#374151;line-height:1.6;">Set a new strong password when prompted</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Warning -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-left:3px solid #C0392B;padding:10px 14px;background:#FDF2F2;border-radius:0 4px 4px 0;">
                <p style="margin:0;font-size:13px;color:#922B21;line-height:1.6;">
                  Do not share this password. Change it immediately after signing in.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#A9B4C2;line-height:1.8;">
            Mero Swasthya &mdash; NiO's Hospital, Birtamode-5, Jhapa, Nepal<br>
            If you did not expect this email, please contact your administrator.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""
    _send_email(to, "Mero Swasthya — Your Account is Ready", html)
