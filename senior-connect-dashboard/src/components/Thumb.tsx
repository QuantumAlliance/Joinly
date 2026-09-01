import { useEffect, useState } from 'react';

/**
 * Photo thumbnail that degrades to a flat tile rather than a broken-image
 * glyph, so a dead asset URL never punches a hole in a table row or card.
 */
export default function Thumb({
  src,
  alt = '',
  className = '',
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <span aria-hidden className={`block bg-track ${className}`} />;

  return (
    <img src={src} alt={alt} onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
