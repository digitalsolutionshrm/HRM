/* eslint-disable */
'use client';
import { HiX } from 'react-icons/hi';
import Links from './components/Links';
import Link from 'next/link';
import Image from 'next/image';
import logoutImage from '@/components/image/Logout.svg';

// import SidebarCard from 'components/sidebar/components/SidebarCard';
import { IRoute } from 'types/navigation';
import authImg from '/public/img/auth/HRM-Logo.png';
// import { color } from '@chakra-ui/system';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { routesByRole } from '@/routes';

function SidebarHorizon(props: { routes: IRoute[]; [x: string]: any }) {
  const router = useRouter();
  const { user, logout } = useAuth();

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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace('/auth/login');
    }
  };

  const { open, setOpen } = props;
  const routesbyrole = user?.role
  ? routesByRole[user.role] ?? []
  : [];

  // console.log('routesByRole[user.role] ',routesByRole[user.role], user.role, routesbyrole);
  return (
    <div
      className={`sm:none duration-175 linear fixed !z-50 flex h-screen w-[260px] max-w-[85vw] flex-col overflow-hidden bg-white pb-6 shadow-2xl shadow-white/5 transition-all dark:!bg-navy-800 dark:text-white md:!z-50 lg:!z-50 xl:!z-0 ${
        open ? 'translate-x-0' : '-translate-x-96 xl:translate-x-0'
      }`}
    >
      <span
        className="absolute right-3 top-3 block cursor-pointer rounded-md p-1 text-lg hover:bg-gray-100 dark:hover:bg-navy-700 xl:hidden"
        onClick={() => setOpen(false)}
      >
        <HiX />
      </span>

      <div className={`mx-6 mt-10 flex shrink-0 items-center sm:mx-8 md:mx-10`}>
        <div className="ml-1 mt-1 h-auto w-full font-poppins text-[26px] font-bold uppercase text-navy-700 dark:text-white">
          <Link
            href={dashboardUrl}
            className="ml-1 mt-1 block h-auto w-full"
            aria-label="Go to dashboard"
          >
            <img
              src={authImg.src}
              alt="HRM Logo header sidebar"
              className="h-auto max-h-[70px] w-auto max-w-full object-contain"
            />
          </Link>
        </div>
      </div>

      <div className="mx-4 mb-5 mt-8 h-px shrink-0 bg-gray-300 dark:bg-white/30 sm:mx-6 sm:mb-7 sm:mt-10" />

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="mb-2 pt-1">
          <Links routes={routesbyrole} />
        </ul>
      </div>


      <div className="flex shrink-0 justify-center border-t border-gray-200 px-4 pt-4 dark:border-white/10">
       {/* <SidebarCard></SidebarCard> */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 font-bold"
          //  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-navy-700"
        >
          <Image src={logoutImage} alt="Logout" width={24} height={24} />

          <span className="logout-icon">Logout</span>
        </button>
       
      </div>

      {/* Nav item end */}
    </div>
  );
}

export default SidebarHorizon;
