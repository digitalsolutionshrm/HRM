import type { DataSource } from 'typeorm';

import { UserRole } from '../auth/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { bootstrapDatabase, DEFAULT_USERS } from './database-bootstrap';

describe('bootstrapDatabase', () => {
  const defaultAdminEmail = DEFAULT_USERS.find(
    (account) => account.role === UserRole.ADMIN,
  )!.email;

  function createDataSource(adminUsers: User[], userWithDefaultEmail?: User) {
    const userRepository = {
      count: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockResolvedValue(adminUsers),
      findOne: jest.fn().mockResolvedValue(userWithDefaultEmail ?? null),
      save: jest.fn().mockImplementation(async (user) => user),
      create: jest.fn(),
    };
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ database: 'hrm_test' }])
        .mockResolvedValueOnce([{ exists: true }]),
      getRepository: jest.fn().mockReturnValue(userRepository),
      synchronize: jest.fn(),
    } as unknown as DataSource;

    return { dataSource, userRepository };
  }

  it('updates the sole existing admin email without changing its password', async () => {
    const admin = {
      id: 1,
      email: 'old-admin@example.com',
      password: 'existing-password-hash',
      role: UserRole.ADMIN,
    } as User;
    const { dataSource, userRepository } = createDataSource([admin]);

    await bootstrapDatabase(dataSource);

    expect(admin.email).toBe(defaultAdminEmail);
    expect(admin.password).toBe('existing-password-hash');
    expect(userRepository.save).toHaveBeenCalledWith(admin);
  });

  it('fails instead of taking an email already owned by a non-admin', async () => {
    const admin = {
      id: 1,
      email: 'old-admin@example.com',
      role: UserRole.ADMIN,
    } as User;
    const anotherUser = {
      id: 2,
      email: defaultAdminEmail,
      role: UserRole.EMPLOYEE,
    } as User;
    const { dataSource, userRepository } = createDataSource(
      [admin],
      anotherUser,
    );

    await expect(bootstrapDatabase(dataSource)).rejects.toThrow(
      `Cannot update admin email: ${defaultAdminEmail} belongs to a non-admin user.`,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
