import React from 'react';

/** Gota minimalista con pulso suave (solo transform/opacity — WebView friendly). */
const CycleDayMarker: React.FC = () => (
  <span
    className="cycle-day-marker absolute bottom-0.5 right-0.5 flex items-center justify-center pointer-events-none"
    aria-hidden
  >
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="cycle-drop-icon"
    >
      <path
        d="M6 1C4.5 1 3.2 2.4 3.2 4.1c0 1.2.5 2.1 1.1 3.1.4.7.9 1.5 1.2 2.4.2.5.3 1 .5 1.4.2-.4.3-.9.5-1.4.3-.9.8-1.7 1.2-2.4.6-1 1.1-1.9 1.1-3.1C8.8 2.4 7.5 1 6 1z"
        fill="#c084a8"
        fillOpacity="0.9"
      />
      <ellipse cx="4.8" cy="3.2" rx="0.9" ry="1.1" fill="white" fillOpacity="0.45" />
    </svg>
  </span>
);

export default CycleDayMarker;
