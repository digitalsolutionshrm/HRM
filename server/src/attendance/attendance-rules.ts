import { BadRequestException } from '@nestjs/common';
import { AttendanceStatus } from './entities/attendance.entity';

const OFFICE_TIME_ZONE = 'Asia/Kolkata';

export function resolveArrivalStatus(
  checkInAt: Date,
  shiftStart: string,
  graceMinutes: number,
): AttendanceStatus {
  const [startHour, startMinute] = shiftStart.split(':').map(Number);
  if (
    !Number.isInteger(startHour) ||
    startHour < 0 ||
    startHour > 23 ||
    !Number.isInteger(startMinute) ||
    startMinute < 0 ||
    startMinute > 59
  ) {
    throw new BadRequestException('Configured shift start time is invalid.');
  }

  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(checkInAt);
  const localHour = Number(localTime.find((part) => part.type === 'hour')?.value);
  const localMinute = Number(localTime.find((part) => part.type === 'minute')?.value);
  let minutesLate = localHour * 60 + localMinute - (startHour * 60 + startMinute);

  if (minutesLate < -12 * 60) minutesLate += 24 * 60;
  if (minutesLate >= 120) return AttendanceStatus.HALF_DAY;
  if (minutesLate > graceMinutes) return AttendanceStatus.SHORT_LEAVE;
  return AttendanceStatus.PRESENT;
}
