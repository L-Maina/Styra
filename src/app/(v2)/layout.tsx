import { Aurora } from '@/components/v2/aurora';
import { LaunchSplash, launchGuard } from '@/components/v2/launch';
import { Shell } from '@/components/v2/shell';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { unreadTotal } from '@/server/services/messages';

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const unread = user ? await unreadTotal(getDb(), user).catch(() => 0) : 0;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: launchGuard }} />
      <LaunchSplash />
      <Aurora />
      <Shell user={user ? { name: user.name, role: user.role, unread } : null}>{children}</Shell>
    </>
  );
}
