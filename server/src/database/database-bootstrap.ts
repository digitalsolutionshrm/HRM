import * as bcrypt from 'bcrypt';
import type { DataSource, Repository } from 'typeorm';

import { UserRole } from '../auth/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

export const DEFAULT_USERS: Array<{
  name: string;
  email: string;
  password: string;
  role: UserRole;
}> = [
  {
    name: 'Admin',
    email: 'digitalsolutionsit01@gmail.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
  },
  {
    name: 'HR',
    email: 'hr@hrm.com',
    password: 'Hr@123',
    role: UserRole.HR,
  },
  {
    name: 'Manager',
    email: 'manager@hrm.com',
    password: 'Manager@123',
    role: UserRole.MANAGER,
  },
  {
    name: 'Employee',
    email: 'employee@hrm.com',
    password: 'Employee@123',
    role: UserRole.EMPLOYEE,
  },
];

/**
 * Prepares the database on boot: creates the schema when it is still missing and
 * seeds the default accounts so a freshly created database can be logged into.
 */
export async function bootstrapDatabase(
  dataSource: DataSource,
): Promise<void> {
  const [{ database }] = await dataSource.query<
    Array<{ database: string }>
  >('select current_database() as database');

  console.log(`[DatabaseBootstrap] Connected database: ${database}`);

  if (!(await hasSchema(dataSource))) {
    await dataSource.synchronize();
    console.log(
      '[DatabaseBootstrap] Empty database detected - schema created from entities.',
    );
  }

  const userRepository = dataSource.getRepository(User);

  if ((await userRepository.count()) === 0) {
    for (const account of DEFAULT_USERS) {
      await userRepository.save(
        userRepository.create({
          ...account,
          password: await bcrypt.hash(account.password, 10),
          status: true,
        }),
      );

      console.log(
        `[DatabaseBootstrap] Created default account: ${account.email} (${account.role})`,
      );
    }

    console.log(
      '[DatabaseBootstrap] Default accounts ready - change these passwords after the first login.',
    );
  }

  await synchronizeAdminEmail(userRepository);
}

async function hasSchema(dataSource: DataSource): Promise<boolean> {
  const rows = await dataSource.query<Array<{ exists: boolean }>>(
    "select to_regclass('public.users') is not null as exists",
  );

  return rows[0]?.exists === true;
}

async function synchronizeAdminEmail(
  userRepository: Repository<User>,
): Promise<void> {
  const defaultAdmin = DEFAULT_USERS.find(
    (account) => account.role === UserRole.ADMIN,
  );
  if (!defaultAdmin) {
    throw new Error('Default admin account is not configured.');
  }

  const adminUsers = await userRepository.find({
    where: { role: UserRole.ADMIN },
  });
  const existingAdminEmail = await userRepository.findOne({
    where: { email: defaultAdmin.email },
  });

  if (existingAdminEmail) {
    if (existingAdminEmail.role !== UserRole.ADMIN) {
      throw new Error(
        `Cannot update admin email: ${defaultAdmin.email} belongs to a non-admin user.`,
      );
    }
    return;
  }

  if (adminUsers.length === 0) {
    return;
  }
  if (adminUsers.length !== 1) {
    throw new Error(
      'Cannot update admin email automatically because multiple admin accounts exist.',
    );
  }

  adminUsers[0].email = defaultAdmin.email;
  await userRepository.save(adminUsers[0]);
  console.log(
    `[DatabaseBootstrap] Updated admin email to ${defaultAdmin.email}.`,
  );
}
