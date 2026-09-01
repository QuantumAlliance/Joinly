import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera } from 'lucide-react';
import {
  useChangePasswordMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUpdateMyProfilePhotoMutation,
  useUploadFileMutation,
} from '../app/api/apiSlice';
import { updateUser } from '../app/authSlice';
import type { RootState } from '../app/store';
import Avatar from '../components/Avatar';
import Card from '../components/Card';
import { useTopbar } from '../layouts/topbar';

/**
 * Profile — no Figma frame exists for this screen; it follows the system set by
 * the other frames. The signed-in admin can swap their photo, edit their name
 * and change their password.
 *
 * The name and photo come from GET /users/me rather than the copy cached in
 * localStorage at login, which went stale the moment anything changed.
 */
const FIELD =
  'h-11 w-full rounded-field border border-line bg-card px-4 text-base text-body outline-none placeholder:text-muted focus:border-brand';
const BUTTON =
  'h-11 rounded-full bg-action px-6 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-60';

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown, fallback: string) =>
  (err as { data?: { message?: string } })?.data?.message ?? fallback;

export default function Profile() {
  useTopbar({ title: 'Profile' });

  const dispatch = useDispatch();
  const cachedAdmin = useSelector((state: RootState) => state.auth.user);
  const { data: profile, isError, refetch } = useGetMyProfileQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [updateMyProfilePhoto, { isLoading: isSavingPhoto }] = useUpdateMyProfilePhotoMutation();
  const [updateMyProfile, { isLoading: isSavingName }] = useUpdateMyProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();

  const [photoFeedback, setPhotoFeedback] = useState<Feedback>(null);
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Prefer the live record; fall back to the login cache until it arrives.
  const admin = profile?.data ?? cachedAdmin;

  useEffect(() => {
    if (!profile?.data) return;
    setFirstName(profile.data.firstName);
    setLastName(profile.data.lastName);
    // Keep the sidebar avatar and name in step with what the API says.
    dispatch(
      updateUser({
        firstName: profile.data.firstName,
        lastName: profile.data.lastName,
        profilePhoto: profile.data.profilePhoto,
      }),
    );
  }, [profile, dispatch]);

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Account</p>
          <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">My Profile</h2>
        </div>
        <Card className="max-w-2xl">
          <p className="text-base font-medium text-ink-strong">Your profile could not be loaded.</p>
          <p className="mt-1 text-sm text-muted">The API did not answer. Check that it is running, then try again.</p>
          <button type="button" onClick={() => refetch()} className={`${BUTTON} mt-4`}>
            Try again
          </button>
        </Card>
      </div>
    );
  }

  if (!admin) return null;
  const name = `${admin.firstName} ${admin.lastName}`.trim();
  const isBusy = isUploading || isSavingPhoto;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await uploadFile(formData).unwrap();
      const photoUrl = uploadRes.data.url;
      await updateMyProfilePhoto({ profilePhoto: photoUrl }).unwrap();
      dispatch(updateUser({ profilePhoto: photoUrl }));
      setPhotoFeedback({ tone: 'ok', text: 'Profile picture updated.' });
      setTimeout(() => setPhotoFeedback(null), 3000);
    } catch (err) {
      setPhotoFeedback({ tone: 'error', text: errorText(err, 'Failed to update profile picture') });
    } finally {
      e.target.value = '';
    }
  };

  const handleNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNameFeedback(null);
    if (!firstName.trim() || !lastName.trim()) {
      setNameFeedback({ tone: 'error', text: 'First and last name are both required.' });
      return;
    }
    try {
      const res = await updateMyProfile({ firstName: firstName.trim(), lastName: lastName.trim() }).unwrap();
      dispatch(updateUser({ firstName: res.data.firstName, lastName: res.data.lastName }));
      setNameFeedback({ tone: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setNameFeedback({ tone: 'error', text: errorText(err, 'Could not update your profile.') });
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ tone: 'error', text: 'The new passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ tone: 'error', text: 'Use at least 6 characters for the new password.' });
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword }).unwrap();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ tone: 'ok', text: 'Password changed.' });
    } catch (err) {
      setPasswordFeedback({ tone: 'error', text: errorText(err, 'Could not change your password.') });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Account</p>
        <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">My Profile</h2>
      </div>

      <Card className="max-w-2xl">
        {photoFeedback && (
          <div
            className={`mb-4 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
              photoFeedback.tone === 'ok' ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'
            }`}
          >
            {photoFeedback.text}
          </div>
        )}

        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar src={admin.profilePhoto} firstName={admin.firstName} lastName={admin.lastName} size={96} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              title="Change photo"
              className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-action text-white ring-4 ring-card hover:bg-action-hover disabled:opacity-60"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-strong">{name}</h2>
            <p className="text-sm text-muted">{admin.email}</p>
            <p className="mt-1 text-xs font-medium tracking-[0.06em] text-label uppercase">{admin.role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="mt-6 h-11 rounded-field border border-line px-5 text-sm font-medium text-body hover:bg-head-bg disabled:opacity-60"
        >
          {isBusy ? 'Uploading…' : 'Change Profile Picture'}
        </button>
      </Card>

      <Card className="max-w-2xl">
        <h3 className="text-xl font-bold text-ink-strong">Edit Profile</h3>
        <form onSubmit={handleNameSubmit} className="mt-6 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-ink-strong">
                First Name
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-ink-strong">
                Last Name
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </div>
          </div>
          {nameFeedback && (
            <p className={`text-sm ${nameFeedback.tone === 'ok' ? 'text-action' : 'text-danger'}`}>
              {nameFeedback.text}
            </p>
          )}
          <button type="submit" disabled={isSavingName} className={BUTTON}>
            {isSavingName ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </Card>

      <Card className="max-w-2xl">
        <h3 className="text-xl font-bold text-ink-strong">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-ink-strong">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={`${FIELD} mt-2`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-ink-strong">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-strong">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </div>
          </div>
          {passwordFeedback && (
            <p className={`text-sm ${passwordFeedback.tone === 'ok' ? 'text-action' : 'text-danger'}`}>
              {passwordFeedback.text}
            </p>
          )}
          <button type="submit" disabled={isChangingPassword} className={BUTTON}>
            {isChangingPassword ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </Card>
    </div>
  );
}
