# 0006 — Payments: Razorpay for India, Dodo Payments elsewhere, hosted checkout only

_Status: accepted (24 Sep 2026, owner-approved). Supersedes the "Stripe Checkout" plan for stage 3 in
INSTRUCTION.md and the master prompt's "Stripe for international sales"._

## Context

The owner wants to sell worldwide as an individual developer in India. Selling a digital product
abroad means collecting each buyer's local sales tax (EU/UK VAT, Australian GST, some US states), which
an individual cannot register for everywhere. Indian buyers expect UPI.

## Decision

- **Razorpay** (Payment Links) for Indian buyers: UPI, cards, net banking, wallets, priced in INR.
- **Dodo Payments** (checkout sessions) for everyone else. Dodo is the **merchant of record**: it
  is the legal seller, adds and remits local tax, and pays us out. Priced in USD by dashboard
  products.
- **Hosted checkout only.** The browser is sent to the provider's page and back. No provider script
  runs under our nonce CSP, and card/UPI details never reach our servers.
- **The server never trusts the browser.** Prices come from configuration; after the redirect the
  API asks the provider for the payment's state (Razorpay: fetch the link; Dodo: fetch the payment
  and check it belongs to our checkout session or carries our order id in metadata).
- **Webhooks are the backup**, verified before use (Razorpay: hex HMAC of the raw body; Dodo:
  Standard Webhooks with a 5-minute timestamp window). Delivery ids are stored in the same
  transaction as their effect, so retries are harmless. A reconciler polls unfinished Razorpay
  orders for when both the webhook and the buyer fail to come back.
- **Entitlements stay provider-independent** (ADR 0005 attached them to the experience). A paid
  order upgrades the experience's entitlement to the higher of what it held and what was bought;
  a conditional update on the order is the single point that grants, so a webhook and a return-page
  confirmation racing each other grant once.
- **Test and live differ only by configuration.** Keys, webhook secrets, `DODO_ENVIRONMENT` and Dodo
  product ids. Live Razorpay keys and live Dodo mode are refused outside `APP_ENV=production`.

## Consequences

- Upgrades pay the difference. Razorpay charges any amount; Dodo needs a separate upgrade product
  (`DODO_PRODUCT_PLUS_TO_PRO`), and is not offered for upgrades without one.
- Dodo's charged amount can differ from our list price (tax, currency conversion), so it is not
  compared exactly; the order link (session id or metadata) is the check instead. Razorpay amounts
  are compared exactly and a mismatch marks the order FAILED without granting.
- Dodo cannot be polled by our reference, only by payment id, so a Dodo buyer who closes the tab
  relies on the webhook. Unpaid orders close after 24 hours; a late payment still grants.
- Razorpay test mode allows only 30 payment links per business, so an unpaid checkout for the same
  purchase is reused for 20 minutes rather than creating another link.
- Payment rows are kept after an experience is deleted (`experienceId` set to null) because refunds
  and disputes need them. They hold no customer details.
- Adding a provider (e.g. Stripe, if the business later incorporates abroad) is a new adapter
  behind `PaymentGateway`, not a rewrite.
