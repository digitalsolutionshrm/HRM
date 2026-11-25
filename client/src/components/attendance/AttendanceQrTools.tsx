'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { apiFetch } from '@/lib/api';

type Employee = {
  id: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
};
type Props = { employees: Employee[]; canManage: boolean; autoStart?: boolean; onSuccess?: () => void | Promise<void> };

// Hidden container required by html5-qrcode when decoding an uploaded image.
const fileScannerId = 'hrm-attendance-qr-file-reader';

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? 'Attendance QR request failed.';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return body?.data ?? body;
}

export default function AttendanceQrTools({ employees, canManage, autoStart = false, onSuccess }: Props) {
  const scannerId = 'hrm-attendance-qr-reader';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileScannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerStartingRef = useRef(false);
  const scannerRunningRef = useRef(false);
  const scanHandledRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);
  const disposedRef = useRef(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const stopScanner = useCallback(async (updateState = true) => {
    const scanner = scannerRef.current;
    if (scannerStartingRef.current) return '';
    let stopError = '';
    try {
      if (scanner && scannerRunningRef.current) {
        scannerRunningRef.current = false;
        await scanner.stop();
      }
    } catch (e) {
      stopError = e instanceof Error ? e.message : 'Could not stop the camera scanner.';
    } finally {
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          stopError ||= e instanceof Error ? e.message : 'Could not clear the camera scanner.';
        }
      }
      scannerRef.current = null;
      if (updateState) setScanning(false);
    }
    return stopError;
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      void stopScanner(false);
      try {
        fileScannerRef.current?.clear();
      } catch {
        // The container may already be unmounted.
      }
      fileScannerRef.current = null;
    };
  }, [stopScanner]);

  const generateQr = async () => {
    if (!selectedEmployee) return;
    setBusy(true); setError(''); setMessage(''); setQrImage('');
    try {
      const payload = await responseJson(
        await apiFetch(`/employees/${selectedEmployee}/attendance-qr`),
      );
      const QRCode = (await import('qrcode')).default;
      const image = await QRCode.toDataURL(
        JSON.stringify({ type: 'HRM_ATTENDANCE', qrToken: payload.qrToken }),
        { width: 280, margin: 2, errorCorrectionLevel: 'H' },
      );
      setQrImage(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate QR code.');
    } finally { setBusy(false); }
  };

  const submitQrPayload = useCallback(
    async (decodedText: string) => {
      let parsed: { type?: string; qrToken?: string };
      try {
        parsed = JSON.parse(decodedText);
      } catch {
        setError('This is not a valid HRM attendance QR code.');
        return;
      }
      if (parsed?.type !== 'HRM_ATTENDANCE' || !parsed?.qrToken) {
        setError('This is not an HRM attendance QR code.');
        return;
      }

      setBusy(true);
      try {
        const result = await responseJson(
          await apiFetch('/attendance/qr-check-in', {
            method: 'POST',
            body: JSON.stringify({ qrToken: parsed.qrToken }),
          }),
        );
        setMessage(`${result.message}${result.employee ? ` — ${result.employee.firstName} ${result.employee.lastName}` : ''}`);
        await onSuccess?.();
      } catch (e) {
        setError(errorMessage(e, 'QR scan failed.'));
      } finally {
        setBusy(false);
      }
    },
    [onSuccess],
  );

  const handleQrFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later.
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose a QR code image (PNG, JPG, …).');
      }
      const stopError = await stopScanner();
      if (stopError) throw new Error(stopError);
      const { Html5Qrcode: ImageQrReader } = await import('html5-qrcode');
      if (!fileScannerRef.current) {
        fileScannerRef.current = new ImageQrReader(fileScannerId);
      }
      let decodedText: string;
      try {
        decodedText = await fileScannerRef.current.scanFile(file, false);
      } catch {
        throw new Error('Could not read a QR code from that image. Try a clearer, uncropped photo.');
      }
      await submitQrPayload(decodedText);
    } catch (e) {
      setError(errorMessage(e, 'Could not read a QR code from that image. Try a clearer, uncropped photo.'));
    } finally {
      try {
        fileScannerRef.current?.clear();
      } catch {
        // Ignore cleanup failures.
      }
      setBusy(false);
    }
  };

  const startScan = useCallback(async () => {
    if (scannerRef.current || scannerStartingRef.current) return;
    setError(''); setMessage('');
    scanHandledRef.current = false;
    scannerStartingRef.current = true;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText: string) => {
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          await submitQrPayload(decodedText);
          const stopError = await stopScanner();
          if (stopError) setError(stopError);
        },
        () => undefined,
      );
      scannerStartingRef.current = false;
      scannerRunningRef.current = true;
      if (disposedRef.current) {
        await stopScanner(false);
        return;
      }
      setScanning(true);
    } catch (e) {
      scannerStartingRef.current = false;
      if (scannerRef.current) {
        const stopError = await stopScanner();
        if (stopError) setError(stopError);
      }
      setError(e instanceof Error ? e.message : 'Camera could not start. Allow camera access.');
    }
  }, [stopScanner, submitQrPayload]);

  useEffect(() => {
    if (autoStart && !canManage && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void startScan();
    }
  }, [autoStart, canManage, startScan]);

  const stopScan = async () => {
    const stopError = await stopScanner();
    if (stopError) setError(stopError);
  };

  return (
    <section className="grid gap-5 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-5 shadow-sm lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white ">QR attendance</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Scan an employee's private HRM QR code to mark today's check-in.</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-navy-600 p-3 ">
          <div className="mb-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-navy-700 dark:bg-navy-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200" role="status" aria-live="polite">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${scanning ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
              {scanning ? 'Camera is on · Point it at an employee QR code' : 'Camera is off'}
            </p>
            {scanning ? (
              <button type="button" onClick={stopScan}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                Stop camera
              </button>
            ) : (
              <button type="button" onClick={startScan} disabled={busy}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#ff6b00] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#e66000] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Please wait…' : 'Start camera scanner'}
              </button>
            )}
          </div>
          <div id={scannerId} className="min-h-10 w-full overflow-hidden" />
          {scanning && <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">Keep this control visible while scanning. You can stop the camera at any time.</p>}
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 px-3 py-3">
            <p className="text-sm font-medium text-slate-700 dark:text-gray-200">No camera on this device? Upload a QR photo</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Take a photo of the employee's QR code with any phone, then upload the image here to mark attendance.</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrFile} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#ff6b00] px-4 py-2 text-sm font-bold text-[#ff6b00] transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-navy-800">
              {busy ? 'Please wait…' : 'Upload QR image'}
            </button>
          </div>
          {/* html5-qrcode needs a real container to decode an uploaded image. */}
          <div id={fileScannerId} className="hidden" aria-hidden="true" />
        </div>
      </div>
      {canManage && (
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white ">Generate / print employee QR</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Only HR/Admin can view an employee's private QR credential.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select value={selectedEmployee} onChange={e => { setSelectedEmployee(e.target.value); setQrImage(''); }}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2 text-sm ">
              <option value="">Select employee</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employeeCode || `Employee #${emp.id}`} — {emp.firstName} {emp.lastName}</option>)}
            </select>
            <button type="button" onClick={generateQr} disabled={!selectedEmployee || busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Generate QR</button>
          </div>
          {qrImage && (
            <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200 dark:border-navy-700 p-4 ">
              {/* QR is generated locally from the server-issued random token. */}
              <img src={qrImage} alt="Employee attendance QR code" width={240} height={240} />
              <p className="mt-2 text-sm font-semibold">Keep this QR private</p>
              <button type="button" onClick={() => window.print()} className="mt-3 rounded-lg border px-4 py-2 text-sm">Print QR</button>
            </div>
          )}
        </div>
      )}
      {message && <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-400/10 p-3 text-sm text-emerald-800 dark:text-emerald-200 lg:col-span-2">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-400/10 p-3 text-sm text-red-700 dark:text-red-300 lg:col-span-2">{error}</p>}
      <p className="text-xs text-slate-500 dark:text-gray-400 lg:col-span-2">The camera scanner requires HTTPS in production (or localhost during development) and camera permission. If your device has no camera, upload a photo of the QR code instead. A scanned QR is a bearer credential; do not post or share it publicly.</p>
    </section>
  );
}
