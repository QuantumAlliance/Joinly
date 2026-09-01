/**
 * Settings — no Figma frame exists for this screen, so it is built from the
 * system established by the other frames (eyebrow + heading, one card, rows
 * separated by #E4E8E5 rules). Fields follow the Figma naming dictionary:
 * `language`, `dateFormat`, `notificationSounds`.
 *
 * The preference rows are backed by PATCH /users/me/app-preferences and the
 * support card by GET/PATCH /contact/admin/contact — this page used to be pure
 * local state, so every change was lost on reload.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  useGetContactInfoQuery,
  useGetMyProfileQuery,
  useUpdateAppPreferencesMutation,
  useUpdateContactInfoMutation,
} from '../app/api/apiSlice';
import Card from '../components/Card';
import { useTopbar } from '../layouts/topbar';

const SELECT =
  'h-11 rounded-field border border-line bg-card px-4 text-base text-body outline-none focus:border-brand';
const FIELD =
  'h-11 w-full rounded-field border border-line bg-card px-4 text-base text-body outline-none placeholder:text-muted focus:border-brand';
const BUTTON =
  'h-11 rounded-full bg-action px-6 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-60';

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown, fallback: string) =>
  (err as { data?: { message?: string } })?.data?.message ?? fallback;

export default function Settings() {
  useTopbar({ title: 'Settings' });

  const { data: profile, isLoading: loadingProfile, isError: profileError, refetch } = useGetMyProfileQuery();
  const { data: contact, isError: contactError } = useGetContactInfoQuery();
  const [updateAppPreferences, { isLoading: savingPrefs }] = useUpdateAppPreferencesMutation();
  const [updateContactInfo, { isLoading: savingContact }] = useUpdateContactInfoMutation();

  const [language, setLanguage] = useState('English (United States)');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [notificationSounds, setNotificationSounds] = useState(true);
  const [prefsFeedback, setPrefsFeedback] = useState<Feedback>(null);

  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [contactFeedback, setContactFeedback] = useState<Feedback>(null);

  // Hydrate from the API once it answers, so the controls show what is stored.
  useEffect(() => {
    if (!profile?.data) return;
    setLanguage(profile.data.language);
    setDateFormat(profile.data.dateFormat);
    setNotificationSounds(profile.data.notificationSounds);
  }, [profile]);

  useEffect(() => {
    if (!contact?.data) return;
    setSupportEmail(contact.data.email);
    setSupportPhone(contact.data.phoneNumber);
  }, [contact]);

  const savePreferences = async () => {
    setPrefsFeedback(null);
    try {
      await updateAppPreferences({ language, dateFormat, notificationSounds }).unwrap();
      setPrefsFeedback({ tone: 'ok', text: 'Preferences saved.' });
    } catch (err) {
      setPrefsFeedback({ tone: 'error', text: errorText(err, 'Could not save your preferences.') });
    }
  };

  const saveContact = async (event: FormEvent) => {
    event.preventDefault();
    setContactFeedback(null);
    try {
      await updateContactInfo({ email: supportEmail.trim(), phoneNumber: supportPhone.trim() }).unwrap();
      setContactFeedback({ tone: 'ok', text: 'Support details updated.' });
    } catch (err) {
      setContactFeedback({ tone: 'error', text: errorText(err, 'Could not update the support details.') });
    }
  };

  if (profileError) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Preferences</p>
          <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">App Preferences</h2>
        </div>
        <Card>
          <p className="text-base font-medium text-ink-strong">Your settings could not be loaded.</p>
          <p className="mt-1 text-sm text-muted">The API did not answer. Check that it is running, then try again.</p>
          <button type="button" onClick={() => refetch()} className={`${BUTTON} mt-4`}>
            Try again
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Preferences</p>
        <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">App Preferences</h2>
      </div>

      <Card>
        <p className="text-sm text-muted">Configure your workspace and regional display settings.</p>

        <div className="mt-6 divide-y divide-line">
          <div className="flex items-center justify-between gap-6 pb-5">
            <div>
              <p className="text-base font-medium text-ink-strong">Language</p>
              <p className="mt-0.5 text-sm text-muted">Display language for the admin panel</p>
            </div>
            <select
              aria-label="Language"
              value={language}
              disabled={loadingProfile}
              onChange={(event) => setLanguage(event.target.value)}
              className={SELECT}
            >
              <option>English (United States)</option>
              <option>English (United Kingdom)</option>
              <option>English</option>
              <option>Italiano</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-6 py-5">
            <div>
              <p className="text-base font-medium text-ink-strong">Date Format</p>
              <p className="mt-0.5 text-sm text-muted">How dates are displayed across the dashboard</p>
            </div>
            <select
              aria-label="Date format"
              value={dateFormat}
              disabled={loadingProfile}
              onChange={(event) => setDateFormat(event.target.value)}
              className={SELECT}
            >
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-6 py-5">
            <div>
              <p className="text-base font-medium text-ink-strong">Notification Sounds</p>
              <p className="mt-0.5 text-sm text-muted">Audible alerts for dispatch</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationSounds}
              aria-label="Notification sounds"
              onClick={() => setNotificationSounds((prev) => !prev)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                notificationSounds ? 'bg-action' : 'bg-field'
              }`}
            >
              <span
                className={`absolute top-1 left-0 size-4 rounded-full bg-white transition-transform ${
                  notificationSounds ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-6 pt-5">
            {prefsFeedback ? (
              <p className={`text-sm ${prefsFeedback.tone === 'ok' ? 'text-action' : 'text-danger'}`}>
                {prefsFeedback.text}
              </p>
            ) : (
              <span />
            )}
            <button type="button" onClick={savePreferences} disabled={savingPrefs || loadingProfile} className={BUTTON}>
              {savingPrefs ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold text-ink-strong">Support Contact</h3>
        <p className="mt-1 text-sm text-muted">
          The email and phone number members see on the app&rsquo;s Contact Us screen.
        </p>

        {contactError && (
          <p className="mt-4 text-sm text-danger">The support details could not be loaded.</p>
        )}

        <form onSubmit={saveContact} className="mt-6 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supportEmail" className="block text-sm font-medium text-ink-strong">
                Email
              </label>
              <input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
                placeholder="support@seniorconnect.io"
                className={`${FIELD} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="supportPhone" className="block text-sm font-medium text-ink-strong">
                Phone number
              </label>
              <input
                id="supportPhone"
                value={supportPhone}
                onChange={(event) => setSupportPhone(event.target.value)}
                placeholder="+41 21 555 01 20"
                className={`${FIELD} mt-2`}
              />
            </div>
          </div>

          {contactFeedback && (
            <p className={`text-sm ${contactFeedback.tone === 'ok' ? 'text-action' : 'text-danger'}`}>
              {contactFeedback.text}
            </p>
          )}

          <button type="submit" disabled={savingContact} className={BUTTON}>
            {savingContact ? 'Saving…' : 'Save Support Details'}
          </button>
        </form>
      </Card>
    </div>
  );
}
