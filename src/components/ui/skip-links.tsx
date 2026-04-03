'use client';

export function SkipLinks() {
  const links = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#main-nav', label: 'Skip to navigation' },
  ];

  return (
    <nav aria-label="Skip links" className="absolute">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
