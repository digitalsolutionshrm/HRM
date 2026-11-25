'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InputField from 'components/fields/InputField';
import Default from 'components/auth/variants/DefaultAuthLayout';

import { register } from 'lib/auth';
import { useAuth } from '@/contexts/AuthContext';


function SignUpDefault() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    if (user.role === 'admin' || user.role === 'hr') {
      return;
    }

    if (user.role === 'manager') {
      router.replace('/manager/default');
      return;
    }

    if (user.role === 'employee') {
      router.replace('/employee/default');
    }
  }, [isAuthenticated, user, router]);
  

  const handleSignup = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    // Name validation
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    // Email validation
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    // Password validation
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 8) {
      setError(
        'Password must be at least 8 characters long.',
      );
      return;
    }

    // Confirm password
    if (!confirmPassword) {
      setError('Please confirm your password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const signupData = await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      console.log('Signup response:', signupData);

      setSuccess(
        'Account created successfully. Redirecting to login...',
      );

      setTimeout(() => {
        router.replace('/auth/login');
      }, 1500);
    } catch (err) {
      console.error('Signup error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create account. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Checking account permissions...</p>
      </div>
    );
  }

  if (
    !isAuthenticated ||
    !user ||
    (user.role !== 'admin' && user.role !== 'hr')
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-2xl font-bold text-navy-700">
            Account creation is restricted
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Ask an HR or Admin user to create your employee account.
          </p>
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }
  return (
    <Default
      maincard={
        <div className="mb-16 mt-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
          <div className="mt-[8vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">

            {/* Heading */}
            <h3 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">
              Create Employee Account
            </h3>

            {/* <p className="mb-9 ml-1 text-base text-gray-600">
              Create your account to get started!
            </p> */}

            {/* Google Signup */}
            {/* <button
              type="button"
              className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary hover:cursor-pointer dark:bg-navy-800 dark:text-white"
            >
              <div className="rounded-full text-xl">
                <FcGoogle />
              </div>

              <p className="text-sm font-medium text-navy-700 dark:text-white">
                Sign Up with Google
              </p>
            </button> */}

            {/* Divider */}
            {/* <div className="mb-6 flex items-center gap-3">
              <div className="h-px w-full bg-gray-200 dark:!bg-navy-700" />

              <p className="text-base text-gray-600">
                or
              </p>

              <div className="h-px w-full bg-gray-200 dark:!bg-navy-700" />
            </div> */}

            {/* Signup Form */}
            <form onSubmit={handleSignup}>

              {/* Name */}
              <InputField
                variant="auth"
                extra="mb-3"
                label="Full Name*"
                placeholder="John Doe"
                id="name"
                type="text"
                value={name}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => setName(e.target.value)}
              />

              {/* Email */}
              <InputField
                variant="auth"
                extra="mb-3"
                label="Email*"
                placeholder="mail@company.com"
                id="email"
                type="email"
                value={email}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => setEmail(e.target.value)}
              />

              {/* Password */}
              <InputField
                variant="auth"
                extra="mb-3"
                label="Password*"
                placeholder="Minimum 8 characters"
                id="password"
                type="password"
                value={password}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => setPassword(e.target.value)}
              />

              {/* Confirm Password */}
              <InputField
                variant="auth"
                extra="mb-3"
                label="Confirm Password*"
                placeholder="Re-enter your password"
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>,
                ) =>
                  setConfirmPassword(e.target.value)
                }
              />

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
                  {success}
                </div>
              )}

              {/* Signup Button */}
              <button
                type="submit"
                disabled={loading}
                className="linear w-full rounded-xl bg-brand-500 py-3 text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200"
              >
                {loading
                  ? 'Creating Account...'
                  : 'Create Employee Account'}
              </button>
            </form>

            {/* Login */}
            <div className="mt-4 text-center">
              <span className="text-sm font-medium text-navy-700 dark:text-gray-500">
                Already have an account?
              </span>

              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      }
    />
  );
}

export default SignUpDefault;
