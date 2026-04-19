import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface LcapixWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  href?: string;
  className?: string;
  variant?: 'default' | 'inverted';
}

const SIZE_CLASS: Record<NonNullable<LcapixWordmarkProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
};

/**
 * <LcapixWordmark> — brand wordmark.
 * "LCAPIX" in Inter Tight 800, tight letter spacing, emerald primary color.
 * Optional subtitle in IBM Plex Mono uppercase tracked wide (e.g. "SUSTAINABILITY SUITE").
 * Pass `href` to wrap in a Next.js Link.
 */
export function LcapixWordmark({
  size = 'md',
  subtitle,
  href,
  className,
  variant = 'default',
}: LcapixWordmarkProps) {
  const textColor = variant === 'inverted' ? 'text-on-primary' : 'text-primary';
  const body = (
    <div className={cn('flex flex-col leading-none', className)}>
      <span className={cn('font-extrabold tracking-tighter', SIZE_CLASS[size], textColor)}>
        LCAPIX
      </span>
      {subtitle ? (
        <span className="mt-1 font-mono text-[10px] tracking-[0.12em] text-on-surface-variant uppercase">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
