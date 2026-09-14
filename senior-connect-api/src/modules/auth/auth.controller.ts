import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalUser } from '../../common/decorators/optional-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/api-response.interface';
import { AuthService } from './auth.service';
import { AUTH_ROUTES } from './auth.routes';
import {
  AdminLoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPhoneOtpDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
  VerifyPhoneOtpDto,
} from './dto';

@Controller(AUTH_ROUTES.ROOT)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Create Account.
   *
   * `@Ip()` on every code-issuing route: the OTP limiter meters per caller as
   * well as per identifier, and a per-identifier cap alone still lets one host
   * walk a list of addresses or numbers.
   */
  @Public()
  @Post(AUTH_ROUTES.REGISTER)
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  /** OTP verification — email or phone. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.VERIFY_OTP)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /** Didn't get the code? */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESEND_OTP)
  resendOtp(@Body() dto: ResendOtpDto, @Ip() ip: string) {
    return this.authService.resendOtp(dto, ip);
  }

  /** Welcome Back — Sign in with either identifier. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGIN)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Admin Login */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.ADMIN_LOGIN)
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  /**
   * Send an SMS code to a number.
   *
   * Public, but `@OptionalUser()`: with a token it links the number to that
   * account, without one it addresses the account that already owns it.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.PHONE_REQUEST_OTP)
  requestPhoneOtp(
    @Body() dto: RequestPhoneOtpDto,
    @Ip() ip: string,
    @OptionalUser() user: AuthenticatedUser | null,
  ) {
    return this.authService.requestPhoneOtp(dto, ip, user);
  }

  /** Redeem an SMS code — links the number, or signs the caller in. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.PHONE_VERIFY)
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto, @OptionalUser() user: AuthenticatedUser | null) {
    return this.authService.verifyPhoneOtp(dto, user);
  }

  /** Forget password? */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ip: string) {
    return this.authService.forgotPassword(dto, ip);
  }

  /** Reset Password */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESET_PASSWORD)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /** Change Password (authenticated) */
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.CHANGE_PASSWORD)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REFRESH_TOKEN)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGOUT)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }
}
