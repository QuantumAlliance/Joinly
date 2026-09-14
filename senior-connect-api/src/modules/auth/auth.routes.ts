export const AUTH_ROUTES = {
  ROOT: 'auth',
  REGISTER: 'register',
  VERIFY_OTP: 'verify-otp',
  RESEND_OTP: 'resend-otp',
  LOGIN: 'login',
  FORGOT_PASSWORD: 'forgot-password',
  RESET_PASSWORD: 'reset-password',
  CHANGE_PASSWORD: 'change-password',
  REFRESH_TOKEN: 'refresh-token',
  LOGOUT: 'logout',
  ADMIN_LOGIN: 'admin/login',
  /** Phase 2 — phone as a first-class login identifier. */
  PHONE_REQUEST_OTP: 'phone/request-otp',
  PHONE_VERIFY: 'phone/verify',
} as const;
