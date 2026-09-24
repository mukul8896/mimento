'use client';

import { PhoneDemo } from '@/components/player/phone-demo';
import { DEMO_EXPERIENCE, DEMO_GIFT } from './demo-experience';

export function TryIt() {
  return <PhoneDemo experience={DEMO_EXPERIENCE} giftMessage={DEMO_GIFT} label="Try a surprise" />;
}
