import React from 'react';
import { PITCH_SYM } from '../../data/constants';
import { PITCH_ICON } from './PitchIcon';

type Props = {
  code: string;
  size?: number;
};

export function PitchMark({ code, size = 16 }: Props) {
  // FE{n} → △E{n}
  if (/^FE\d$/.test(code)) {
    const fielder = code.slice(2);
    return (
      <span
        style={{
          display: 'inline-flex',
          width: 'auto',
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.85,
          lineHeight: 1,
          flexShrink: 0,
          letterSpacing: 0,
        }}
      >
        △→E{fielder}
      </span>
    );
  }

  const icon = PITCH_ICON[code];

  if (icon) {
    return (
      <span
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {React.cloneElement(icon, {
          width: size,
          height: size,
        } as React.SVGProps<SVGSVGElement>)}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {PITCH_SYM[code] ?? ''}
    </span>
  );
}
