'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Employee = { id: number; firstName?: string; lastName?: string; employeeCode?: string };
type FaceApi = typeof import('@vladmandic/face-api');

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

async function responseJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Face attendance request failed.');
  return body?.data ?? body;
}

export default function FaceAttendanceTools({ employees, canManage, autoStart = false, onSuccess }: { employees: Employee[]; canManage: boolean; autoStart?: boolean; onSuccess?: () => void | Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceApiRef = useRef<FaceApi | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [consent, setConsent] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (canManage) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await responseJson(await apiFetch('/employees/profile'));
        if (!cancelled && profile?.id) setEmployeeId(String(profile.id));
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your employee profile.'); }
    })();
    return () => { cancelled = true; };
  }, [canManage]);

  useEffect(() => { if (autoStart && !canManage && employeeId && !cameraOn) void startCamera(); }, [autoStart, canManage, employeeId]);

  async function startCamera() {
    setError(''); setMessage(''); setWorking(true);
    try {
      if (!employeeId) throw new Error(canManage ? 'Select an employee first.' : 'Your employee profile could not be loaded.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost and browser permission.');
      const faceApi = faceApiRef.current ?? (await import('@vladmandic/face-api'));
      faceApiRef.current = faceApi;
      await Promise.all([
        faceApi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceApi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
      setMessage('Camera ready. Keep one face centered with good lighting.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start camera.'); }
    finally { setWorking(false); }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function captureDescriptor() {
    if (!videoRef.current || !faceApiRef.current) throw new Error('Start the camera first.');
    const faceApi = faceApiRef.current;
    const result = await faceApi.detectSingleFace(videoRef.current, new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
      .withFaceLandmarks().withFaceDescriptor();
    if (!result) throw new Error('No clear face detected. Adjust lighting and try again.');
    return Array.from(result.descriptor);
  }

  async function enroll() {
    setError(''); setMessage(''); setWorking(true);
    try {
      if (!consent) throw new Error('Employee consent must be confirmed before enrollment.');
      const descriptor = await captureDescriptor();
      const response = await apiFetch(`/employees/${employeeId}/face-enrollment`, { method: 'POST', body: JSON.stringify({ descriptor, consent }) });
      await responseJson(response);
      setMessage('Face enrollment saved. The biometric template is encrypted on the server.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Face enrollment failed.'); }
    finally { setWorking(false); }
  }

  async function markAttendance() {
    setError(''); setMessage(''); setWorking(true);
    try {
      const descriptor = await captureDescriptor();
      const response = await apiFetch('/attendance/face-check-in', { method: 'POST', body: JSON.stringify({ employeeId: Number(employeeId), descriptor }) });
      const result = await responseJson(response);
      setMessage(result?.message || 'Face attendance marked successfully.');
      await onSuccess?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Face attendance failed.'); }
    finally { setWorking(false); }
  }

  return <section className="my-6 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-5 shadow-sm ">
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white ">Face-scan attendance</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">HR/Admin enrollment and server-side template comparison. Camera frames are processed in the browser and are not uploaded.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        {canManage ? <>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 ">Employee to enroll</label>
          <select className="w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 p-2.5 text-sm " value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode || `EMP-${employee.id}`} — {employee.firstName || ''} {employee.lastName || ''}</option>)}
          </select>
          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-300 ">
            <input className="mt-1" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I confirm the employee has been informed and has explicitly consented to biometric face attendance and secure template storage.
          </label>
        </> : <div className="rounded-lg bg-slate-100 dark:bg-navy-700 p-3 text-sm ">Face scan will verify your own enrolled face. HR must enroll your face first.</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={working || !employeeId || cameraOn} onClick={startCamera} className="rounded-lg bg-[#ff6b00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e66000] disabled:opacity-50">{working ? 'Please wait…' : 'Start camera'}</button>
          {canManage && <button type="button" disabled={working || !cameraOn || !consent} onClick={enroll} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">Enroll face</button>}
          <button type="button" disabled={working || !cameraOn} onClick={markAttendance} className="rounded-lg border border-[#ff6b00] px-4 py-2 text-sm font-semibold text-[#ff6b00] transition hover:bg-orange-50 disabled:opacity-50 ">Scan & mark attendance</button>
          {cameraOn && <button type="button" onClick={stopCamera} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 dark:border-navy-600 dark:bg-navy-800 dark:text-red-300">Stop camera</button>}
        </div>
        {message && <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-400/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-400/10 p-3 text-sm text-red-800 dark:text-red-200">{error}</p>}
      </div>
      <div className="overflow-hidden rounded-xl bg-slate-950">
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
        {!cameraOn && <p className="p-3 text-center text-xs text-slate-300 dark:text-gray-300">Camera preview appears here after you start the camera.</p>}
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">Fallback: use the QR scanner or existing manual attendance if camera/model matching fails. Face matching alone is not proof of liveness; use only after a consent, bias, and spoofing assessment.</p>
  </section>;
}
