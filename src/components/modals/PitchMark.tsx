import React from 'react';
import { PITCH_SYM } from '../../data/constants';
import { PITCH_ICON } from './PitchIcon';

type Props = {
  code: string;
  size?: number;
};

export function PitchMark({ code, size = 16 }: Props) {
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