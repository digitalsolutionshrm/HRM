import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
  sessionId: string;
}