import type { ReactNode } from 'react';

/**
 * The panel treatment used on every screen: white, 20px radius, 1px #E4E8E5
 * border and the soft green drop shadow measured off the frames
 * (`0 4px 20px rgba(46,125,79,.05)`).
 */
export default function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-card shadow-card ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </section>
  );
}
