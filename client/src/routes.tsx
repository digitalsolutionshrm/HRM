import React from 'react';
import {
  MdHome,
  MdPerson,
  MdPerson2,
  MdQuiz,
  MdPunchClock,
  MdTimeToLeave,
  MdReport,
  MdPayment,
  MdNotifications,
  MdAdminPanelSettings,
  MdReceiptLong,
  MdSchedule,
  MdWork,
} from 'react-icons/md';
import { IRoute } from 'types/navigation';
const adminRoutes: IRoute[] = [
  {
    name: 'Main Dashboard',
    layout: '/admin',
    path: 'default',
    icon: <MdHome className="h-6 w-6" />,
  },
  {
    name: 'Profile',
    layout: '/admin',
    path: 'profile',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'Users',
    layout: '/admin',
    path: 'users',
    icon: <MdPerson2 className="h-6 w-6" />,
  },
  {
    name: 'Employees',
    layout: '/admin',
    path: 'employees',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'Managers',
    layout: '/admin',
    path: 'managers',
    icon: <MdPerson2 className="h-6 w-6" />,
  },
  {
    name: 'Departments',
    layout: '/admin',
    path: 'departments',
    icon: <MdQuiz className="h-6 w-6" />,
  },
  {
    name: 'Employee Roles',
    layout: '/admin',
    path: 'roles',
    icon: <MdWork className="h-6 w-6" />,
  },
  {
    name: 'Attendance',
    layout: '/admin',
    path: 'attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'Leaves',
    layout: '/admin',
    path: 'leaves',
    icon: <MdTimeToLeave className="h-6 w-6" />,
  },
  {
    name: 'DSR',
    layout: '/admin',
    path: 'dsr',
    icon: <MdReport className="h-6 w-6" />,
  },
  {
    name: 'Payroll',
    layout: '/admin',
    path: 'payroll',
    icon: <MdPayment className="h-6 w-6" />,
  },
  {
    name: 'Notifications',
    layout: '/admin',
    path: 'notifications',
    icon: <MdNotifications className="h-6 w-6" />,
  },
  {
    name: 'Attendance Settings',
    layout: '/admin',
    path: 'attendance-settings',
    icon: <MdAdminPanelSettings className="h-6 w-6" />,
  },
  { name: 'Shifts', layout: '/admin', path: 'shifts', icon: <MdSchedule className="h-6 w-6" /> },
];
const hrRoutes: IRoute[] = [
  {
    name: 'Main Dashboard',
    layout: '/hr',
    path: 'default',
    icon: <MdHome className="h-6 w-6" />,
  },
  {
    name: 'Profile',
    layout: '/hr',
    path: 'profile',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'Employees',
    layout: '/hr',
    path: 'employees',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'Managers',
    layout: '/hr',
    path: 'managers',
    icon: <MdPerson2 className="h-6 w-6" />,
  },
  {
    name: 'Departments',
    layout: '/hr',
    path: 'departments',
    icon: <MdQuiz className="h-6 w-6" />,
  },
  {
    name: 'Employee Roles',
    layout: '/hr',
    path: 'roles',
    icon: <MdWork className="h-6 w-6" />,
  },
  {
    name: 'My Attendance',
    layout: '/hr',
    path: 'my-attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'Attendance',
    layout: '/hr',
    path: 'attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'Leaves',
    layout: '/hr',
    path: 'leaves',
    icon: <MdTimeToLeave className="h-6 w-6" />,
  },
  {
    name: 'DSR',
    layout: '/hr',
    path: 'dsr',
    icon: <MdReport className="h-6 w-6" />,
  },
  {
    name: 'Payroll',
    layout: '/hr',
    path: 'payroll',
    icon: <MdPayment className="h-6 w-6" />,
  },
  {
    name: 'My Payroll',
    layout: '/hr',
    path: 'payslips',
    icon: <MdReceiptLong className="h-6 w-6" />,
  },
  {
    name: 'Notifications',
    layout: '/hr',
    path: 'notifications',
    icon: <MdNotifications className="h-6 w-6" />,
  },
  {
    name: 'Attendance Settings',
    layout: '/hr',
    path: 'attendance-settings',
    icon: <MdAdminPanelSettings className="h-6 w-6" />,
  },
  { name: 'Shifts', layout: '/hr', path: 'shifts', icon: <MdSchedule className="h-6 w-6" /> },
];
const managerRoutes: IRoute[] = [
  {
    name: 'Main Dashboard',
    layout: '/manager',
    path: 'default',
    icon: <MdHome className="h-6 w-6" />,
  },
  {
    name: 'Profile',
    layout: '/manager',
    path: 'profile',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'Team',
    layout: '/manager',
    path: 'team',
    icon: <MdPerson2 className="h-6 w-6" />,
  },
  {
    name: 'My Attendance',
    layout: '/manager',
    path: 'my-attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'Attendance',
    layout: '/manager',
    path: 'attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'Leaves',
    layout: '/manager',
    path: 'leaves',
    icon: <MdTimeToLeave className="h-6 w-6" />,
  },
  {
    name: 'DSR',
    layout: '/manager',
    path: 'dsr',
    icon: <MdReport className="h-6 w-6" />,
  },
  {
    name: 'My Payroll',
    layout: '/manager',
    path: 'payslips',
    icon: <MdReceiptLong className="h-6 w-6" />,
  },
  {
    name: 'Notifications',
    layout: '/manager',
    path: 'notifications',
    icon: <MdNotifications className="h-6 w-6" />,
  },
];
const employeeRoutes: IRoute[] = [
  {
    name: 'Main Dashboard',
    layout: '/employee',
    path: 'default',
    icon: <MdHome className="h-6 w-6" />,
  },
  {
    name: 'My Profile',
    layout: '/employee',
    path: 'profile',
    icon: <MdPerson className="h-6 w-6" />,
  },
  {
    name: 'My Attendance',
    layout: '/employee',
    path: 'attendance',
    icon: <MdPunchClock className="h-6 w-6" />,
  },
  {
    name: 'My Leaves',
    layout: '/employee',
    path: 'leaves',
    icon: <MdTimeToLeave className="h-6 w-6" />,
  },
  {
    name: 'My DSR',
    layout: '/employee',
    path: 'dsr',
    icon: <MdReport className="h-6 w-6" />,
  },
  {
    name: 'My Payroll',
    layout: '/employee',
    path: 'payslips',
    icon: <MdReceiptLong className="h-6 w-6" />,
  },
  {
    name: 'Notifications',
    layout: '/employee',
    path: 'notifications',
    icon: <MdNotifications className="h-6 w-6" />,
  },
];
export const routesByRole = {
  admin: adminRoutes,
  hr: hrRoutes,
  manager: managerRoutes,
  employee: employeeRoutes,
};
export default adminRoutes;
