import { LaunchSplash } from '@/components/brand/LaunchSplash';

/** The v1 app keeps its own launch splash; v2 screens use components/v2/launch.tsx. */
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LaunchSplash />
      {children}
    </>
  );
}
