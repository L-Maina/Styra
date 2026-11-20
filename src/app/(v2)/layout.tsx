import { Aurora } from '@/components/v2/aurora';
import { LaunchSplash, launchGuard } from '@/components/v2/launch';
import { Shell } from '@/components/v2/shell';
import { currentUser } from '@/lib/v2/session';

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: launchGuard }} />
      <LaunchSplash />
      <Aurora />
      <Shell user={user ? { name: user.name, role: user.role } : null}>{children}</Shell>
    </>
  );
}
