import type { CountryId } from '@/data/catalog';

/** Hand-drawn simplified flags so they render the same on every device (emoji flags don't on Windows). */
export function Flag({ country, className = 'h-6 w-9' }: { country: CountryId; className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-ink/10`} aria-hidden="true">
      {country === 'india' && (
        <>
          <rect width="30" height="20" fill="#fff" />
          <rect width="30" height="6.67" fill="#FF9933" />
          <rect y="13.33" width="30" height="6.67" fill="#138808" />
          <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
          <circle cx="15" cy="10" r="0.5" fill="#000080" />
        </>
      )}
      {country === 'brazil' && (
        <>
          <rect width="30" height="20" fill="#009C3B" />
          <path d="M15 2.2 27.6 10 15 17.8 2.4 10z" fill="#FFDF00" />
          <circle cx="15" cy="10" r="4.6" fill="#002776" />
          <path d="M10.6 9c3-1 6.4-.6 8.9 1" stroke="#fff" strokeWidth="0.8" fill="none" />
        </>
      )}
      {country === 'usa' && (
        <>
          <rect width="30" height="20" fill="#fff" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} y={i * (20 / 6.5)} width="30" height={20 / 13} fill="#B22234" />
          ))}
          <rect width="12" height={(20 / 13) * 7} fill="#3C3B6E" />
          {Array.from({ length: 20 }, (_, i) => (
            <circle key={i} cx={1.4 + (i % 5) * 2.3} cy={1.3 + Math.floor(i / 5) * 2.4} r="0.45" fill="#fff" />
          ))}
        </>
      )}
      {country === 'uae' && (
        <>
          <rect width="30" height="6.67" fill="#00732F" />
          <rect y="6.67" width="30" height="6.67" fill="#fff" />
          <rect y="13.33" width="30" height="6.67" fill="#000" />
          <rect width="7.5" height="20" fill="#FF0000" />
        </>
      )}
    </svg>
  );
}
