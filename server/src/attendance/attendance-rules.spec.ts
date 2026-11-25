import { AttendanceStatus } from './entities/attendance.entity';
import { resolveArrivalStatus } from './attendance-rules';

describe('resolveArrivalStatus', () => {
  const checkInAt = (hour: number, minute: number) =>
    new Date(Date.UTC(2026, 10, 18, 3, 30 + (hour - 9) * 60 + minute));

  it('keeps check-ins through the configured grace period present', () => {
    expect(resolveArrivalStatus(checkInAt(9, 30), '09:00:00', 30)).toBe(
      AttendanceStatus.PRESENT,
    );
  });

  it('marks check-ins after grace and before two hours as short leave', () => {
    expect(resolveArrivalStatus(checkInAt(9, 31), '09:00:00', 30)).toBe(
      AttendanceStatus.SHORT_LEAVE,
    );
    expect(resolveArrivalStatus(checkInAt(10, 59), '09:00:00', 30)).toBe(
      AttendanceStatus.SHORT_LEAVE,
    );
  });

  it('marks check-ins two hours or more after shift start as half day', () => {
    expect(resolveArrivalStatus(checkInAt(11, 0), '09:00:00', 30)).toBe(
      AttendanceStatus.HALF_DAY,
    );
  });

  it('keeps early check-ins present', () => {
    expect(resolveArrivalStatus(checkInAt(8, 59), '09:00:00', 30)).toBe(
      AttendanceStatus.PRESENT,
    );
  });
});
