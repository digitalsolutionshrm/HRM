'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InputField from 'components/fields/InputField';
import Default from 'components/auth/variants/DefaultAuthLayout';
import { FcGoogle } from 'react-icons/fc';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import Checkbox from 'components/checkbox';
import { useAuth } from '@/contexts/AuthContext';

import { login } from 'lib/auth';


function SignInDefault() {
  const router = useRouter();
  const { user, isAuthenticated, login: setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {

    if (!isAuthenticated || !user) {
      return;
    }

  switch (user.role) {
    case 'admin':
      router.replace('/admin/default');
      break;

    case 'hr':
      router.replace('/hr/default');
      break;

    case 'manager':
      router.replace('/manager/default');
      break;

    case 'employee':
      router.replace('/employee/default');
      break;

    default:
      break;
  }
}, [isAuthenticated, user, router]);

const handleLogin = async (
  event: FormEvent<HTMLFormElement>,
) => {
  event.preventDefault();

  setError('');

  if (!email.trim()) {
    setError('Please enter your email.');
    return;
  }

  if (!password) {
    setError('Please enter your password.');
    return;
  }

  try {

    setLoading(true);

    const loginData = await login(
      email.trim(),
      password,
    );

    if (!loginData.user) {
      throw new Error(
        'User information was not returned.',
      );
    }

    setAuth(
      loginData.accessToken,
      loginData.user,
    );

  } catch (err) {
    console.error(
      'Login error:',
      err,
    );

    setError(
      err instanceof Error
        ? err.message
        : 'Unable to login. Please try again.',
    );
  } finally {
    setLoading(false);
  }
};


  return (
    <Default
      maincard={
        <div className="mb-16 mt-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
          <div className="mt-[10vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">
            
            <h3 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">
              Sign In
            </h3>

            <p className="mb-9 ml-1 text-base text-gray-600">
              Enter your email and password to sign in!
            </p>

            {/* Google Login */}
            <button
              type="button"
              className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary hover:cursor-pointer dark:bg-navy-800 dark:text-white"
            >
              <div className="rounded-full text-xl">
                <FcGoogle />
              </div>

              <p className="text-sm font-medium text-navy-700 dark:text-white">
                Sign In with Google
              </p>
            </button>

            {/* Divider */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px w-full bg-gray-200 dark:!bg-navy-700" />

              <p className="text-base text-gray-600">
                or
              </p>

              <div className="h-px w-full bg-gray-200 dark:!bg-navy-700" />
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>

              {/* Email */}
              <InputField
                variant="auth"
                extra="mb-3"
                label="Email*"
                placeholder="mail@company.com"
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
              />

              {/* Password */}
              <div className="mb-3">
                <label
                  htmlFor="password"
                  className="ml-1.5 text-sm font-medium text-navy-700 dark:text-white"
                >
                  Password*
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white/0 p-3 pr-12 text-sm outline-none dark:!border-white/10 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-gray-500 hover:text-navy-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-300 dark:hover:text-white"
                  >
                    {showPassword ? (
                      <MdVisibilityOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <MdVisibility className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Remember + Forgot Password */}
              <div className="mb-4 flex items-center justify-between px-2">
                <div className="mt-2 flex items-center">
                  <Checkbox
                    checked={keepLoggedIn}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setKeepLoggedIn(e.target.checked)
                    }
                  />

                  <p className="ml-2 text-sm font-medium text-navy-700 dark:text-white">
                    Keep me logged in
                  </p>
                </div>

                <a
                  className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
                  href="/auth/forgot-password"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="linear w-full rounded-xl bg-brand-500 py-3 text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            

            {/* Signup */}
            <div className="mt-4">
              <span className="text-sm font-medium text-navy-700 dark:text-gray-500">
                Not registered yet?
              </span>

              <button
                type="button"
                onClick={() => router.push('/auth/sign-up')}
                className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
              >
                Create an account
              </button>
            </div>

          </div>
        </div>
      }
    />
  );
}

export default SignInDefault;
