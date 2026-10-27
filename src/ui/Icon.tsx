import type { ReactNode } from "react";

const shapes = {
  settings: (
    <>
      <path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-1.5v-3L20 9l-2-3-2 .5-2-1-.5-2H9Z" />
      <circle cx="11.5" cy="12" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-5L4 14v6Z" />
    </>
  ),
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4Z" />
      <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4Z" />
      <path d="m16 9 6 6m0-6-6 6" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="14" r="8" />
      <path d="M9 2h6M12 2v4m6 1 2-2M12 10v4l3 2" />
    </>
  ),
  tabata: (
    <>
      <circle cx="12" cy="14" r="8" />
      <path d="M9 2h6M12 2v4m6 1 2-2M12 6v3m8 5h-3m-5 8v-3m-8-5h3m5-3v3l3 2" />
    </>
  ),
  hourglass: (
    <>
      <path d="M5 2h14M5 22h14M6 2v4c0 3 6 6 6 6s6 3 6 6v4M18 2v4c0 3-6 6-6 6s-6 3-6 6v4" />
      <path d="M9 18h6" />
    </>
  ),
  repeat: (
    <>
      <path d="M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6M4 17a9 9 0 0 0 15 2l3-3m0 6v-6h-6" />
    </>
  ),
  clock: (
    <>
      <path d="M20 7a9 9 0 1 0 1 9M20 2v5h-5" />
      <path d="M12 6v6l4 2M12 21v-1m-9-8h1" />
    </>
  ),
  pause: (
    <>
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8V4Z" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="1" />,
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof shapes;

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
