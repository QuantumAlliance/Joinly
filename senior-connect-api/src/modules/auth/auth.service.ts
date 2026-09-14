import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { FilterQuery, Model } from 'mongoose';
import { OtpChannel, OtpType, UserRole, UserStatus } from '../../common/enums';
import {
  AuthenticatedUser,
  JwtPayload,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { OtpDeliveryService } from '../../common/services/otp-delivery.service';
import { generateOtpCode, otpExpiryDate } from '../../common/utils/otp.util';
import { resolvePhone } from '../../common/utils/phone.util';
import { idOf } from '../../common/schema.helpers';
import { UserProfile } from '../users/interfaces/users.interface';
import { User, UserDocument } from '../users/schemas';
import {
  AuthResponse,
  AuthTokens,
  OtpSentResponse,
  PhoneVerifiedResponse,
  RegisterResponse,
} from './interfaces/auth.interface';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { Otp, OtpDocument } from './schemas';
import {
  AdminLoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  IdentifierDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPhoneOtpDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
  VerifyPhoneOtpDto,
} from './dto';

/** Whichever credential a request arrived with, already canonicalised. */
interface ResolvedIdentifier {
  channel: OtpChannel;
  /** The lowercased email or the E.164 number — what OTPs are keyed on. */
  value: string;
}

/** Human-readable purpose, as printed in the email and the SMS. */
const OTP_PURPOSE: Record<OtpType, string> = {
  [OtpType.VerifyEmail]: 'OTP verification',
  [OtpType.VerifyPhone]: 'Phone verification',
  [OtpType.PhoneLogin]: 'Sign in',
  [OtpType.ResetPassword]: 'Reset Password',
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    private readonly jwtService: JwtService,
    private readonly otpDelivery: OtpDeliveryService,
    private readonly rateLimiter: OtpRateLimiterService,
  ) {}

  /**
   * Figma "Create Account".
   *
   * Registration can start from either identifier. Supplying both is the
   * normal mobile path; each one is then verified by its own code.
   */
  async register(dto: RegisterDto, ip: string | null): Promise<ServiceResponse<RegisterResponse>> {
    const email = dto.email?.toLowerCase().trim() ?? null;
    const phoneE164 = resolvePhone(dto);

    // Only a *verified* identifier blocks re-registration. One that was
    // submitted but never verified can be re-submitted any number of times —
    // the details are refreshed and a fresh code goes out.
    const byEmail = email ? await this.userModel.findOne({ email }) : null;
    if (byEmail?.isEmailVerified) {
      throw new ConflictException('An account with this email already exists');
    }
    const byPhone = phoneE164 ? await this.userModel.findOne({ phoneE164 }) : null;
    if (byPhone?.isPhoneVerified) {
      throw new ConflictException('An account with this phone number already exists');
    }

    // Both identifiers given, each already sitting on a different unverified
    // account: which one is being registered is genuinely ambiguous, and
    // choosing silently would merge two strangers' half-finished signups.
    if (byEmail && byPhone && idOf(byEmail) !== idOf(byPhone)) {
      throw new ConflictException(
        'This email and phone number belong to different accounts. Verify one of them first.',
      );
    }

    const user = byEmail ?? byPhone ?? new this.userModel();

    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.password = await bcrypt.hash(dto.password, 10);
    if (email) {
      user.email = email;
      user.isEmailVerified = false;
    }
    if (phoneE164) {
      user.phoneCountryCode = dto.phoneCountryCode ?? user.phoneCountryCode ?? null;
      user.phoneNumber = dto.phoneNumber ?? user.phoneNumber ?? null;
      user.phoneE164 = phoneE164;
      user.isPhoneVerified = false;
    }
    // Re-recorded on every re-registration attempt, so the timestamp always
    // matches the submission the account was actually created from.
    user.acceptedTermsAt = new Date();
    user.dateOfBirth = dto.dateOfBirth ?? null;
    user.language = dto.language ?? user.language ?? 'English (United States)';
    user.status = UserStatus.Pending;
    await user.save();

    // A code per identifier supplied. Rate limits are per channel, so an
    // account registering with both is metered on each independently.
    const channels: OtpChannel[] = [];
    if (email) {
      await this.issueOtp({ channel: OtpChannel.Email, value: email }, OtpType.VerifyEmail, ip);
      channels.push(OtpChannel.Email);
    }
    if (phoneE164) {
      await this.issueOtp({ channel: OtpChannel.Sms, value: phoneE164 }, OtpType.VerifyPhone, ip);
      channels.push(OtpChannel.Sms);
    }

    return {
      message: this.sentMessage(channels[0]),
      data: { email, phoneE164, channel: channels[0], channels, otpSent: true },
    };
  }

  /** Figma "OTP verification" — redeem a code sent to either identifier. */
  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<ServiceResponse<AuthResponse | { verified: boolean }>> {
    const identifier = this.resolveIdentifier(dto);
    const type = dto.type ?? this.defaultVerifyType(identifier.channel);
    await this.consumeOtp(identifier.value, [type], dto.otpCode);

    // A reset code proves nothing beyond "you can read this inbox"; the
    // password change itself is still gated on the same code.
    if (type === OtpType.ResetPassword) {
      return { message: 'OTP verified successfully', data: { verified: true } };
    }

    const user = await this.findByIdentifier(identifier, true);
    this.markVerified(user, identifier.channel);
    if (user.status === UserStatus.Pending) user.status = UserStatus.Active;
    const tokens = await this.issueTokens(user);
    await user.save();

    return {
      message: 'Account verified successfully',
      data: { ...tokens, user: this.toProfile(user) },
    };
  }

  /** "Didn't get the code?" */
  async resendOtp(dto: ResendOtpDto, ip: string | null): Promise<ServiceResponse<OtpSentResponse>> {
    const identifier = this.resolveIdentifier(dto);
    await this.findByIdentifier(identifier);
    const type = dto.type ?? this.defaultVerifyType(identifier.channel);
    await this.issueOtp(identifier, type, ip);
    return { message: this.sentMessage(identifier.channel), data: this.otpSent(identifier) };
  }

  /**
   * Figma "Welcome Back" — mobile sign in.
   *
   * Accepts either identifier. Each is gated on its own verification flag:
   * signing in by phone requires a verified phone, not a verified email.
   */
  async login(dto: LoginDto): Promise<ServiceResponse<AuthResponse>> {
    const identifier = this.resolveIdentifier(dto);
    const user = await this.validateCredentials(identifier, dto.password);
    const tokens = await this.issueTokens(user);
    await user.save();
    return {
      message: 'Signed in successfully',
      data: { ...tokens, user: this.toProfile(user) },
    };
  }

  /** Figma "Admin Login" — the dashboard signs in by email only. */
  async adminLogin(dto: AdminLoginDto): Promise<ServiceResponse<AuthResponse>> {
    const identifier: ResolvedIdentifier = {
      channel: OtpChannel.Email,
      value: dto.email.toLowerCase().trim(),
    };
    const user = await this.validateCredentials(identifier, dto.password);
    if (user.role !== UserRole.Admin) {
      throw new ForbiddenException('This account does not have admin access');
    }
    const tokens = await this.issueTokens(user, dto.rememberMe ? '90d' : undefined);
    await user.save();
    return {
      message: 'Admin signed in successfully',
      data: { ...tokens, user: this.toProfile(user) },
    };
  }

  /**
   * `POST /auth/phone/request-otp`.
   *
   * Two callers. Signed in: linking a number to the account in hand. Signed
   * out: verifying or signing in with a number already on an account.
   *
   * An unknown number is refused rather than quietly accepted. Sending to any
   * number a stranger names is an SMS-bombing endpoint aimed at third parties
   * and billed to this project's Twilio balance.
   */
  async requestPhoneOtp(
    dto: RequestPhoneOtpDto,
    ip: string | null,
    currentUser: AuthenticatedUser | null,
  ): Promise<ServiceResponse<OtpSentResponse>> {
    const phoneE164 = resolvePhone(dto) as string; // The DTO guarantees it resolves.
    const owner = await this.userModel.findOne({ phoneE164 });

    if (currentUser) {
      // Linking: the number must be free, or already this account's own.
      if (owner && idOf(owner) !== currentUser.userId && owner.isPhoneVerified) {
        throw new ConflictException('This phone number is already in use by another account');
      }
    } else if (!owner) {
      throw new BadRequestException('No account found with this phone number');
    }

    const type = owner?.isPhoneVerified ? OtpType.PhoneLogin : OtpType.VerifyPhone;
    await this.issueOtp({ channel: OtpChannel.Sms, value: phoneE164 }, type, ip);

    return {
      message: "We've sent a verification code to your phone.",
      data: { email: null, phoneE164, channel: OtpChannel.Sms, otpSent: true },
    };
  }

  /**
   * `POST /auth/phone/verify`.
   *
   * Redeems a phone code. Signed in, it links the number to that account.
   * Signed out, verifying the number *is* the sign-in, so tokens come back.
   */
  async verifyPhoneOtp(
    dto: VerifyPhoneOtpDto,
    currentUser: AuthenticatedUser | null,
  ): Promise<ServiceResponse<PhoneVerifiedResponse>> {
    const phoneE164 = resolvePhone(dto) as string;
    // The client need not know whether this number is being verified for the
    // first time or used to sign in; either code redeems here.
    await this.consumeOtp(phoneE164, [OtpType.VerifyPhone, OtpType.PhoneLogin], dto.otpCode);

    const owner = await this.userModel.findOne({ phoneE164 });

    if (currentUser) {
      const user = await this.userModel.findById(currentUser.userId);
      if (!user) throw new UnauthorizedException('User not found');

      if (owner && idOf(owner) !== idOf(user)) {
        if (owner.isPhoneVerified) {
          throw new ConflictException('This phone number is already in use by another account');
        }
        // That other account only ever claimed the number, never proved it.
        // Proof beats a claim, so release it there and link it here.
        owner.phoneE164 = null;
        owner.isPhoneVerified = false;
        await owner.save();
      }

      user.phoneCountryCode = dto.phoneCountryCode ?? user.phoneCountryCode ?? null;
      user.phoneNumber = dto.phoneNumber ?? user.phoneNumber ?? null;
      user.phoneE164 = phoneE164;
      user.isPhoneVerified = true;
      if (user.status === UserStatus.Pending) user.status = UserStatus.Active;
      await user.save();

      return {
        message: 'Phone number verified successfully',
        data: {
          phoneE164,
          isPhoneVerified: true,
          linked: true,
          tokens: null,
          user: this.toProfile(user),
        },
      };
    }

    if (!owner) throw new BadRequestException('No account found with this phone number');

    this.assertUsable(owner);
    owner.isPhoneVerified = true;
    if (owner.status === UserStatus.Pending) owner.status = UserStatus.Active;
    const tokens = await this.issueTokens(owner);
    await owner.save();

    return {
      message: 'Phone number verified successfully',
      data: {
        phoneE164,
        isPhoneVerified: true,
        linked: false,
        tokens,
        user: this.toProfile(owner),
      },
    };
  }

  /** Figma "Forget password?" — the code goes to whichever identifier was given. */
  async forgotPassword(
    dto: ForgotPasswordDto,
    ip: string | null,
  ): Promise<ServiceResponse<OtpSentResponse>> {
    const identifier = this.resolveIdentifier(dto);
    await this.findByIdentifier(identifier);
    await this.issueOtp(identifier, OtpType.ResetPassword, ip);
    return { message: this.sentMessage(identifier.channel), data: this.otpSent(identifier) };
  }

  /** Figma "Reset Password" */
  async resetPassword(dto: ResetPasswordDto): Promise<ServiceResponse<null>> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('newPassword and confirmPassword do not match');
    }
    const identifier = this.resolveIdentifier(dto);
    await this.consumeOtp(identifier.value, [OtpType.ResetPassword], dto.otpCode);
    const user = await this.findByIdentifier(identifier, true);
    user.password = await bcrypt.hash(dto.newPassword, 10);
    // Every existing session dies with the old password.
    user.refreshToken = null;
    await user.save();
    return { message: 'Your password has been changed successfully', data: null };
  }

  /** Figma "Change Password" */
  async changePassword(
    currentUser: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<ServiceResponse<null>> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('newPassword and confirmPassword do not match');
    }
    const user = await this.userModel.findById(currentUser.userId).select('+password');
    if (!user) throw new UnauthorizedException('User not found');
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Current Password is incorrect');
    }
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    return { message: 'Your password has been changed successfully', data: null };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<ServiceResponse<AuthTokens>> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.userModel.findById(payload.sub).select('+refreshToken');
    if (!user || !user.refreshToken || !(await bcrypt.compare(dto.refreshToken, user.refreshToken))) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }
    const tokens = await this.issueTokens(user);
    await user.save();
    return { message: 'Token refreshed successfully', data: tokens };
  }

  async logout(currentUser: AuthenticatedUser): Promise<ServiceResponse<null>> {
    await this.userModel.updateOne({ _id: currentUser.userId }, { $set: { refreshToken: null } });
    return { message: 'Logged out successfully', data: null };
  }

  // ---------- identifier helpers ----------

  /**
   * Canonicalise whichever credential the request carried. The DTOs already
   * guarantee exactly one is present and that a phone normalises, so reaching
   * the throw means a caller bypassed validation.
   */
  private resolveIdentifier(dto: IdentifierDto): ResolvedIdentifier {
    if (dto.email) {
      return { channel: OtpChannel.Email, value: dto.email.toLowerCase().trim() };
    }
    const phoneE164 = resolvePhone(dto);
    if (phoneE164) return { channel: OtpChannel.Sms, value: phoneE164 };
    throw new BadRequestException('Provide an email address or a phone number');
  }

  /** The verification type belonging to a channel. */
  private defaultVerifyType(channel: OtpChannel): OtpType {
    return channel === OtpChannel.Email ? OtpType.VerifyEmail : OtpType.VerifyPhone;
  }

  private identifierFilter(identifier: ResolvedIdentifier): FilterQuery<UserDocument> {
    return identifier.channel === OtpChannel.Email
      ? { email: identifier.value }
      : { phoneE164: identifier.value };
  }

  private async findByIdentifier(
    identifier: ResolvedIdentifier,
    selectPassword = false,
  ): Promise<UserDocument> {
    const query = this.userModel.findOne(this.identifierFilter(identifier));
    if (selectPassword) query.select('+password');
    const user = await query;
    if (!user) {
      throw new BadRequestException(
        identifier.channel === OtpChannel.Email
          ? 'No account found with this email'
          : 'No account found with this phone number',
      );
    }
    return user;
  }

  private markVerified(user: UserDocument, channel: OtpChannel): void {
    if (channel === OtpChannel.Email) user.isEmailVerified = true;
    else user.isPhoneVerified = true;
  }

  private sentMessage(channel: OtpChannel): string {
    return channel === OtpChannel.Email
      ? "We've sent a verification code to your email."
      : "We've sent a verification code to your phone.";
  }

  private otpSent(identifier: ResolvedIdentifier): OtpSentResponse {
    const isEmail = identifier.channel === OtpChannel.Email;
    return {
      email: isEmail ? identifier.value : null,
      phoneE164: isEmail ? null : identifier.value,
      channel: identifier.channel,
      otpSent: true,
    };
  }

  // ---------- credential helpers ----------

  private async validateCredentials(
    identifier: ResolvedIdentifier,
    password: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findOne(this.identifierFilter(identifier)).select('+password');
    // One message covers both halves, so the response cannot be used to work
    // out which addresses and numbers have accounts.
    const invalid =
      identifier.channel === OtpChannel.Email
        ? 'Invalid email or password'
        : 'Invalid phone number or password';
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(invalid);
    }
    this.assertUsable(user);

    // Gated on the identifier actually used: a verified email must not make an
    // unverified number a usable login, or proving the number means nothing.
    const verified =
      identifier.channel === OtpChannel.Email ? user.isEmailVerified : user.isPhoneVerified;
    if (!verified && user.role !== UserRole.Admin) {
      throw new ForbiddenException(
        identifier.channel === OtpChannel.Email
          ? 'Please verify your email first'
          : 'Please verify your phone number first',
      );
    }
    return user;
  }

  private assertUsable(user: UserDocument): void {
    if (user.status === UserStatus.Blocked || user.status === UserStatus.Suspended) {
      throw new ForbiddenException(`Your account is ${user.status.toLowerCase()}`);
    }
  }

  // ---------- OTP helpers ----------

  /**
   * Meter, generate, send, record.
   *
   * The limiter runs before anything is generated — the point is not to spend
   * — and the ledger is written only after a successful send, so a provider
   * outage does not burn the user's daily budget.
   */
  private async issueOtp(
    identifier: ResolvedIdentifier,
    type: OtpType,
    ip: string | null,
  ): Promise<void> {
    await this.rateLimiter.assertWithinLimits(identifier.value, identifier.channel, ip);

    const otpCode = generateOtpCode();
    await this.otpModel.create({
      identifier: identifier.value,
      channel: identifier.channel,
      otpCode,
      type,
      expiresAt: otpExpiryDate(),
    });
    await this.otpDelivery.send(identifier.channel, identifier.value, otpCode, OTP_PURPOSE[type]);
    await this.rateLimiter.record(identifier.value, identifier.channel, ip);
  }

  /**
   * Claim the code in the same operation that finds it, so a replayed request
   * cannot consume the same OTP twice.
   *
   * `types` is a list because the phone endpoints accept either a first-time
   * verification code or a sign-in code, without the client having to know
   * which state the account is in.
   */
  private async consumeOtp(identifier: string, types: OtpType[], otpCode: string): Promise<void> {
    const otp = await this.otpModel.findOneAndUpdate(
      {
        identifier,
        otpCode,
        type: { $in: types },
        isUsed: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { isUsed: true } },
      { sort: { createdAt: -1 } },
    );
    if (!otp) throw new BadRequestException('Invalid or expired verification code');
  }

  private async issueTokens(user: UserDocument, refreshExpiry?: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: idOf(user), email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret',
      expiresIn: (refreshExpiry ||
        process.env.JWT_REFRESH_EXPIRES_IN ||
        '30d') as JwtSignOptions['expiresIn'],
    });
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    return { accessToken, refreshToken };
  }

  private toProfile(user: UserDocument): UserProfile {
    return {
      id: idOf(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneCountryCode: user.phoneCountryCode,
      phoneNumber: user.phoneNumber,
      phoneE164: user.phoneE164,
      dateOfBirth: user.dateOfBirth,
      language: user.language,
      profilePhoto: user.profilePhoto,
      country: user.country,
      region: user.region,
      city: user.city,
      latitude: user.latitude,
      longitude: user.longitude,
      role: user.role,
      status: user.status,
      dateFormat: user.dateFormat,
      notificationSounds: user.notificationSounds,
      allowNotifications: user.allowNotifications,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      memberSince: user.createdAt,
    };
  }
}
