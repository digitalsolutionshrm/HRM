'use client';

import { useEffect, useState } from 'react';
import { MdClose } from 'react-icons/md';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationRealtime } from '@/contexts/NotificationRealtimeContext';

type Celebration = {
  id: number;
  title: string;
  message: string;
  relatedEntityType: string;
};

const CELEBRATION_TYPES = new Set([
  'payroll_bonus',
  'payroll_increment',
  'birthday_greeting',
  'work_anniversary_greeting',
]);

const FLOATERS = ['🎈', '🌸', '🎈', '🌼', '🎊', '🌺', '🎈', '🌷', '🎉', '🌸', '🎈', '🌼'];

export default function CelebrationOverlay() {
  const { user } = useAuth();
  const { notifications } = useNotificationRealtime();
  const [active, setActive] = useState<Celebration | null>(null);

  useEffect(() => {
    if (!user?.id || notifications.length === 0) return;
    const celebrations = notifications.filter((item) =>
      item.relatedEntityType && CELEBRATION_TYPES.has(item.relatedEntityType),
    );
    if (celebrations.length === 0) return;

    const unseen = celebrations.filter((item) => {
      try {
        return localStorage.getItem(`hrm-celebration:${user.id}:${item.id}`) !== 'shown';
      } catch {
        return true;
      }
    });
    if (unseen.length === 0) return;
    for (const item of unseen) {
      try {
        localStorage.setItem(`hrm-celebration:${user.id}:${item.id}`, 'shown');
      } catch {
        // Continue with the in-session celebration when storage is unavailable.
      }
    }

    const notification = unseen[0];
    setActive({
      id: notification.id,
      title: notification.relatedEntityType === 'birthday_greeting'
        ? 'Happy Birthday!'
        : notification.relatedEntityType === 'work_anniversary_greeting'
          ? 'Happy Work Anniversary!'
          : notification.relatedEntityType === 'payroll_bonus'
            ? 'Congratulations! You received a bonus.'
            : 'Congratulations on your increment!',
      message: notification.message,
      relatedEntityType: notification.relatedEntityType ?? '',
    });
  }, [notifications, user?.id]);

  if (!active) return null;
  const isBirthday = active.relatedEntityType === 'birthday_greeting';
  const isAnniversary = active.relatedEntityType === 'work_anniversary_greeting';

  return <div className="celebration-backdrop fixed inset-0 z-[250] flex items-center justify-center overflow-hidden px-5 py-8" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
    <div className="celebration-glow absolute inset-0" aria-hidden="true" />
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {FLOATERS.map((symbol, index) => <span key={`${symbol}-${index}`} className={`celebration-floater floater-${index % 6}`} style={{ left: `${4 + ((index * 17) % 92)}%`, animationDelay: `${(index % 5) * -1.4}s`, animationDuration: `${8 + (index % 4) * 2}s` }}>{symbol}</span>)}
      {Array.from({ length: 32 }).map((_, index) => <i key={index} className="celebration-confetti" style={{ left: `${(index * 29) % 100}%`, animationDelay: `${(index % 9) * -0.45}s`, backgroundColor: ['#f472b6', '#facc15', '#60a5fa', '#a78bfa', '#34d399'][index % 5] }} />)}
    </div>
    <section className="celebration-card relative z-10 w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/90 px-6 py-12 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/90 sm:px-12 sm:py-16">
      <button type="button" aria-label="Close celebration" onClick={() => setActive(null)} className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-gray-500 shadow hover:bg-white dark:bg-navy-700 dark:text-gray-200"><MdClose className="h-5 w-5" /></button>
      <div className="mb-5 text-6xl sm:text-7xl" aria-hidden="true">{isBirthday ? '🎂🎈' : isAnniversary ? '🎉💐' : active.relatedEntityType === 'payroll_bonus' ? '🎉💐' : '🌟🎊'}</div>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-600 dark:text-pink-300">{isBirthday ? 'A day made just for you' : isAnniversary ? 'Celebrating your journey' : 'A special moment'}</p>
      <h1 id="celebration-title" className="mt-3 text-3xl font-black text-navy-800 dark:text-white sm:text-5xl">{active.title}</h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-gray-700 dark:text-gray-200 sm:text-lg">{active.message}</p>
      <div className="mt-8 flex justify-center gap-3 text-3xl" aria-hidden="true"><span>🌷</span><span>🎈</span><span>💐</span><span>🎈</span><span>🌼</span></div>
      <button type="button" onClick={() => setActive(null)} className="mt-9 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.03]">Thank you!</button>
    </section>
    <style jsx>{`
      .celebration-backdrop { background: radial-gradient(circle at 50% 20%, #fdf2f8 0%, #ede9fe 48%, #dbeafe 100%); }
      .celebration-glow { background: radial-gradient(circle at center, rgba(255,255,255,.72), transparent 62%); }
      .celebration-floater { position: absolute; bottom: -4rem; font-size: clamp(1.7rem, 4vw, 3.5rem); animation-name: float-up; animation-timing-function: linear; animation-iteration-count: infinite; filter: drop-shadow(0 8px 10px rgba(30,41,59,.12)); }
      .floater-1, .floater-4 { font-size: clamp(1.4rem, 3vw, 2.5rem); }
      .celebration-confetti { position: absolute; top: -1rem; width: 8px; height: 14px; border-radius: 2px; opacity: .85; animation: confetti-fall 5s linear infinite; }
      .celebration-card { animation: card-pop .55s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes float-up { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(-115vh) rotate(28deg); } }
      @keyframes confetti-fall { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(115vh) rotate(700deg); } }
      @keyframes card-pop { from { opacity: 0; transform: scale(.88) translateY(18px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .celebration-floater, .celebration-confetti, .celebration-card { animation: none; } }
    `}</style>
  </div>;
}
