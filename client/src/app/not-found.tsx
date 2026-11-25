'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
// import {error} from '@/public/img/others/error.png';


export default function NotFound() {
const { user, isLoading } = useAuth();

const dashboardUrl =
user?.role === 'admin'
? '/admin'
: user?.role === 'hr'
? '/hr'
: user?.role === 'manager'
? '/manager'
: user?.role === 'employee'
? '/employee'
: '/auth/login';

if (isLoading) {
return ( <div className="flex min-h-screen items-center justify-center bg-white dark:bg-navy-900"> <p className="text-gray-600 dark:text-white">
Loading... </p> </div>
);
}

return ( <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-navy-900"> <div className="w-full max-w-xl text-center"> <div className="mb-6">
   <h1 className="text-[120px] font-bold leading-none text-navy-700 dark:text-white">
<img
  src="/img/others/error.png"
  alt="Page not found"
  className="mx-auto w-full max-w-md"
/>
</h1> </div>

    <h2 className="mb-3 text-3xl font-bold text-navy-700 dark:text-white">
      Page Not Found
    </h2>

    <p className="mb-8 text-base text-gray-600 dark:text-gray-300">
      Sorry, the page you are looking for does not exist
      or may have been moved.
    </p>

    <Link
      href={dashboardUrl}
      className="inline-flex rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600"
    >
      {user ? 'Back to Dashboard' : 'Go to Login'}
    </Link>
  </div>
</div>


);
}
