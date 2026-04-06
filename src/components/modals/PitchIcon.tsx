import React from 'react';

export const PITCH_ICON: Record<string, JSX.Element> = {
  // 헛스윙 (원 + 사선)
  SW: (
    <svg viewBox="0 0 20 20" fill="none">
      <ellipse
        cx="10"
        cy="10"
        rx="5.8"
        ry="7.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* 관통 핵심: 원 밖까지 길게 */}
      <path
        d="M4 16 L16 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),

  PC1: (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M6 8 L10 13 L14 8"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
),

  // 피치클락 포수 위반 (V)
PC2: (
  <svg viewBox="0 0 20 20" fill="none">
    {/* 눈 (위로 올림) */}
    <path
      d="M6.5 4.8 L7.3 6.2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M12.7 4.8 L13.5 6.2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* 입 (아래로 내림) */}
    <path
      d="M5.2 11 L10 16 L14.8 11"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
),
    
  // 피치클락 타자 위반 (원 + 체크)
  PC3: (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 10.5 L9 13 L14 7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};