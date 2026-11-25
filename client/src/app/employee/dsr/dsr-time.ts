export interface DsrDuration {
  hours: number;
  minutes: number;
}

export function splitDsrDuration(value: number | string): DsrDuration {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
  const hours = Math.floor(safeValue);
  const minutes = Math.round((safeValue - hours) * 100);
  return minutes >= 60
    ? { hours: hours + Math.floor(minutes / 60), minutes: minutes % 60 }
    : { hours, minutes };
}

export function joinDsrDuration(hours: number, minutes: number): number {
  return Number(`${hours}.${String(minutes).padStart(2, '0')}`);
}

export function dsrDurationToMinutes(value: number | string): number {
  const { hours, minutes } = splitDsrDuration(value);
  return hours * 60 + minutes;
}

export function formatDsrDuration(value: number | string): string {
  const { hours, minutes } = splitDsrDuration(value);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
