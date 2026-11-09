import React from 'react';

export interface EzityLogoProps {
  size?: number;
  decorative?: boolean;
  className?: string;
}

/** Official brand mark for Ezity AI companion identity. */
export function EzityLogo({ size = 40, decorative = true, className = '' }: EzityLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="assets/ezity-logo.png"
        alt={decorative ? '' : 'Ezity AI'}
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export default EzityLogo;
