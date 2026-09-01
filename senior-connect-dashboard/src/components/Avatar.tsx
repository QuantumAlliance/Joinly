/**
 * Photo avatar with an initials fallback.
 *
 * The Figma frames use both: photos in the Users table and on detail screens,
 * initials-on-mint circles in the dashboard's Recent Users table. Passing no
 * `src` (or a src that fails to load) renders the initials treatment.
 */
interface AvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  /** Pixel diameter — 46 in the Users table, 36 in Recent Users. */
  size?: number;
  /** 2px ring, as drawn around the Users table avatars. */
  ring?: boolean;
  /** Background utility for the initials treatment; defaults to mint. */
  tintClass?: string;
  className?: string;
}

import { useEffect, useState } from 'react';

export default function Avatar({
  src,
  firstName = '',
  lastName = '',
  size = 36,
  ring = false,
  tintClass = 'bg-[#d9e6da]',
  className = '',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt even if the previous one 404'd.
  useEffect(() => setFailed(false), [src]);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={{ ...box, fontSize: Math.round(size * 0.34) }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-ink ${tintClass} ${className}`}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${firstName} ${lastName}`.trim() || 'Avatar'}
      style={box}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-track' : ''} ${className}`}
    />
  );
}
