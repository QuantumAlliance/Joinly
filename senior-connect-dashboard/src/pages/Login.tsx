/**
 * Admin Login — `Dashboard figma design/App Admin Panel.svg`.
 *
 * Centred card on the #F5F7F6 page fill with a square logo placeholder above
 * the heading. The CTA and the Forgot Password link carry the brand gradient.
 * "Remember Me" is a plain label in the frame, so it has no checkbox.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import { useAdminLoginMutation } from '../app/api/apiSlice';
import { setCredentials } from '../app/authSlice';
import type { RootState } from '../app/store';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  const [email, setEmail] = useState('admin@contenthub.io');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminLogin, { isLoading }] = useAdminLoginMutation();

  if (accessToken) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await adminLogin({ email, password, rememberMe }).unwrap();
      dispatch(setCredentials(result.data));
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-[418px]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl bg-card px-10 py-9 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <div className="flex flex-col items-center">
            {/* The frame draws an empty placeholder here; swap in the Arooby
                mark when there is one. */}
            <div aria-hidden className="size-[52px] rounded-lg bg-[#f5f5f5]" />
            <h1 className="mt-4 text-[22px] font-bold text-[#111827]">Admin Login</h1>
            <p className="mt-1 text-sm text-muted">Sign in to Arooby</p>
          </div>

          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#111827]">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-line bg-card px-4 text-sm text-body outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#111827]">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-lg border border-line bg-card pr-11 pl-4 text-sm text-body outline-none placeholder:text-muted focus:border-brand"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-pressed={rememberMe}
                onClick={() => setRememberMe((prev) => !prev)}
                className={`text-sm ${rememberMe ? 'font-medium text-brand' : 'text-body'}`}
              >
                Remember Me
              </button>
              <Link to="/forgot-password" className="text-sm text-brand">
                Forgot Password?
              </Link>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="bg-brand-gradient h-11 w-full rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Login'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-muted">· Admin Panel v2.1</p>
      </div>
    </div>
  );
}
