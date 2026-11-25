import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const compareMock = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

describe('UsersService.changeOwnPassword', () => {
  let service: UsersService;
  let user: User;
  let save: jest.Mock;

  beforeEach(() => {
    user = {
      id: 7,
      role: UserRole.ADMIN,
      status: true,
      password: 'stored-hash',
    } as User;
    const getOne = jest.fn().mockResolvedValue(user);
    save = jest.fn().mockImplementation(async (value: User) => value);
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save,
    } as unknown as Repository<User>;

    service = new UsersService(repository);
  });

  beforeEach(() => {
    compareMock.mockReset();
    hashMock.mockReset();
  });

  it('checks the old password and saves a hash of the new password', async () => {
    compareMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    hashMock.mockResolvedValue('new-hash');

    await expect(
      service.changeOwnPassword(7, 'OldPass1!', 'NewPass2@'),
    ).resolves.toEqual({ message: 'Password changed successfully.' });

    expect(user.password).toBe('new-hash');
    expect(save).toHaveBeenCalledWith(user);
  });

  it('rejects an incorrect old password without saving', async () => {
    compareMock.mockResolvedValue(false);

    await expect(
      service.changeOwnPassword(7, 'wrong-password', 'NewPass2@'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects password changes for non-admin accounts', async () => {
    user.role = UserRole.HR;

    await expect(
      service.changeOwnPassword(7, 'OldPass1!', 'NewPass2@'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(save).not.toHaveBeenCalled();
  });
});
