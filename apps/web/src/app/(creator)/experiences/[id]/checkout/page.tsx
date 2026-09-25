import { CheckoutReturn } from '@/components/creator/checkout-return';
import { serverApi } from '@/lib/api/server';

export const metadata = { title: 'Payment' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Where Razorpay and Dodo send the creator back. The query string is only a hint about which
 * order to check; the API asks the provider itself before anything is unlocked.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const one = (key: string) => (typeof query[key] === 'string' ? query[key] : undefined);
  const order = one('order');
  // Dodo appends payment_id; Razorpay appends razorpay_payment_id, which the API does not need.
  const paymentId = one('payment_id');
  const api = await serverApi();
  const { data } = await api.GET('/api/v1/experiences/{id}', { params: { path: { id } } });
  const returnTo =
    data?.mode === 'TEMPLATE' ? `/experiences/${id}/personalize` : `/experiences/${id}/edit`;
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10 sm:px-6">
      <CheckoutReturn
        experienceId={id}
        orderId={order && UUID.test(order) ? order : null}
        paymentId={paymentId && PAYMENT_ID.test(paymentId) ? paymentId : null}
        returnTo={returnTo}
      />
    </main>
  );
}
