import { t } from '@/core/copy';
import { ButtonLink } from '@/components/v2/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-16 text-center">
      <h1 className="font-sans text-[28px] font-bold normal-case">{t('system.notFoundTitle')}</h1>
      <p className="text-[17px]">{t('system.notFoundBody')}</p>
      <div className="flex justify-center pt-2">
        <ButtonLink href="/explore">{t('actions.browse')}</ButtonLink>
      </div>
    </div>
  );
}
