import Card from 'components/card';

interface EmployeeGeneralProps {
  employee: {
    employeeCode?: string;
    designation?: string;
    department?: { name?: string };
    user?: { email?: string };
    phoneCountryCode?: string;
    phone?: string;
    joiningDate?: string;
    status?: boolean;
    personalDetails?: {
      dateOfBirth?: string | null;
      gender?: string;
      maritalStatus?: string;
      nationality?: string;
      bloodGroup?: string;
      personalEmail?: string;
      alternatePhone?: string;
    };
    addresses?: Array<{
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      isPrimary?: boolean;
    }>;
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
}

export default function EmployeeGeneral({ employee }: EmployeeGeneralProps) {
  const details = employee.personalDetails;
  const address =
    employee.addresses?.find((item) => item.isPrimary) ??
    employee.addresses?.[0];

  const phone = [employee.phoneCountryCode, employee.phone]
    .filter(Boolean)
    .join(' ');

  const currentAddress = [
    address?.addressLine1,
    address?.addressLine2,
    address?.city,
    address?.state,
    address?.postalCode,
    address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  const items = [
    ['Employee Code', employee.employeeCode],
    ['Department', employee.department?.name],
    ['Position', employee.designation],
    ['Work Email', employee.user?.email],
    ['Phone', phone],
    ['Joining Date', formatDate(employee.joiningDate)],
    ['Date of Birth', formatDate(details?.dateOfBirth)],
    ['Gender', details?.gender],
    ['Marital Status', details?.maritalStatus],
    ['Nationality', details?.nationality],
    ['Blood Group', details?.bloodGroup],
    ['Personal Email', details?.personalEmail],
    ['Alternate Phone', details?.alternatePhone],
    ['Current Address', currentAddress],
    [
      'Employment Status',
      employee.status === undefined
        ? undefined
        : employee.status
          ? 'Active'
          : 'Inactive',
    ],
  ];

  return (
    <Card extra="h-full w-full p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy-700 dark:text-white">
          General Information
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Employee and personal information from your profile.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl bg-gray-50 px-4 py-3 dark:bg-navy-700/50"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-navy-700 dark:text-white">
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}