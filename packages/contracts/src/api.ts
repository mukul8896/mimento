import { z } from 'zod';
import { TIERS } from './tiers';
import { AnswerSchema } from './answers';
import { GiftSecretSchema, RevealedGiftSchema } from './gifts';
import { DraftStepSchema, MAX_STEPS, StepKeySchema } from './steps';
import { ThemeSchema } from './theme';

/**
 * Request and response bodies for /api/v1. The API turns these into validated DTOs and an
 * OpenAPI document; the web app consumes the generated client, not these types directly,
 * except for step/theme/answer schemas that the editor and player render.
 */

const IsoDateTime = z.iso.datetime({ offset: true });
const Uuid = z.uuid();

export const ExperienceStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'DISABLED',
  'EXPIRED',
  'DELETED',
]);
export type ExperienceStatus = z.infer<typeof ExperienceStatusSchema>;
export const ModerationStateSchema = z.enum(['ACTIVE', 'TAKEN_DOWN']);
export const ResponseVisibilitySchema = z.enum(['FULL', 'AGGREGATE_ONLY']);

export const ExperienceSettingsSchema = z.strictObject({
  responseVisibility: ResponseVisibilitySchema,
});
export type ExperienceSettings = z.infer<typeof ExperienceSettingsSchema>;

export const ProblemIssueSchema = z.object({
  stepKey: z.string().max(2000).nullable(),
  field: z.string().max(2000).nullable(),
  message: z.string(),
});

export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string(),
  requestId: z.string(),
  issues: z.array(ProblemIssueSchema).optional(),
});

// ---------------------------------------------------------------------------------------
// Identity
/** Anonymous owner identity, minted instead of registering. Returned once, never again. */
export const OwnerTokenResponseSchema = z.object({ ownerToken: z.string() });

export const MeResponseSchema = z.object({
  id: Uuid,
  email: z.string().max(2000).nullable(),
  displayName: z.string().max(2000).nullable(),
  isAdmin: z.boolean(),
});

// ---------------------------------------------------------------------------------------
// Templates
export const TierSchema = z.enum(TIERS);

export const TemplateSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  stepCount: z.number().int(),
  tier: TierSchema,
});
export const TemplateListResponseSchema = z.object({ items: z.array(TemplateSummarySchema) });

// ---------------------------------------------------------------------------------------
// Experiences
export const CreateExperienceRequestSchema = z.strictObject({
  title: z.string().trim().max(120).optional(),
  templateKey: z.string().max(60).nullable().optional(),
});

export const ExperienceStatsSchema = z.object({
  started: z.number().int(),
  completed: z.number().int(),
});

export const ExperienceSummarySchema = z.object({
  id: Uuid,
  title: z.string(),
  status: ExperienceStatusSchema,
  moderationState: ModerationStateSchema,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  publishedAt: IsoDateTime.nullable(),
  expiresAt: IsoDateTime.nullable(),
  stats: ExperienceStatsSchema,
});
export type ExperienceSummary = z.infer<typeof ExperienceSummarySchema>;

export const ExperienceListQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'INACTIVE']).optional(),
});

export const ExperienceListResponseSchema = z.object({
  items: z.array(ExperienceSummarySchema),
  nextCursor: z.string().max(2000).nullable(),
});

/** What this surprise needs to be shared, and what it has. */
export const TierStateSchema = z.object({
  required: TierSchema,
  held: TierSchema,
  satisfied: z.boolean(),
});

export const ExperienceDetailSchema = ExperienceSummarySchema.extend({
  settings: ExperienceSettingsSchema,
  publishedVersion: z.number().int().nullable(),
  hasUnpublishedChanges: z.boolean(),
  takedownReason: z.string().max(2000).nullable(),
  tier: TierStateSchema,
});

/** Operator grant (stage 2). Purchases will use the same shape from the payment webhook. */
export const GrantEntitlementRequestSchema = z.strictObject({
  tier: TierSchema,
  note: z.string().trim().max(500).optional(),
});

export const DraftGiftStatusSchema = z.object({ stepKey: StepKeySchema, hasSecret: z.boolean() });

export const DraftDocumentSchema = z.object({
  experienceId: Uuid,
  revision: z.number().int(),
  title: z.string(),
  theme: ThemeSchema,
  settings: ExperienceSettingsSchema,
  steps: z.array(DraftStepSchema),
  gifts: z.array(DraftGiftStatusSchema),
  media: z.array(
    z.object({
      id: Uuid,
      url: z.string(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    }),
  ),
  updatedAt: IsoDateTime,
});
export type DraftDocument = z.infer<typeof DraftDocumentSchema>;

export const UpdateDraftRequestSchema = z.strictObject({
  revision: z.number().int().min(1),
  title: z.string().max(120),
  theme: ThemeSchema,
  settings: ExperienceSettingsSchema,
  steps: z.array(DraftStepSchema).max(MAX_STEPS),
});
export type UpdateDraftRequest = z.infer<typeof UpdateDraftRequestSchema>;

export const UpdateDraftResponseSchema = z.object({
  revision: z.number().int(),
  updatedAt: IsoDateTime,
});

export const PublishCheckResponseSchema = z.object({
  ok: z.boolean(),
  issues: z.array(ProblemIssueSchema),
});

/** The share token is fetched separately so it is never persisted in idempotency records. */
export const PublishResponseSchema = z.object({
  versionNumber: z.number().int(),
  publishedAt: IsoDateTime,
});

export const ShareLinkResponseSchema = z.object({ shareToken: z.string() });

/** Recovery credential for one experience, shown to the creator so they can get back to it. */
export const ManageLinkResponseSchema = z.object({ manageToken: z.string() });

export const SetExpiryRequestSchema = z.strictObject({
  expiresAt: IsoDateTime.nullable(),
});

export const GiftSecretRequestSchema = z.strictObject({ secret: GiftSecretSchema });
export const GiftSecretResponseSchema = z.object({ secret: GiftSecretSchema.nullable() });

// ---------------------------------------------------------------------------------------
// Media
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 6000;

export const CreateUploadRequestSchema = z.strictObject({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_IMAGE_BYTES),
});

export const CreateUploadResponseSchema = z.object({
  mediaId: Uuid,
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: IsoDateTime,
  }),
});

export const MediaAssetSchema = z.object({
  id: Uuid,
  status: z.enum(['PENDING_UPLOAD', 'READY', 'REJECTED']),
  mimeType: z.string(),
  sizeBytes: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  url: z.string().max(8000).nullable(),
});

// ---------------------------------------------------------------------------------------
// Results
export const ResultsResponseSchema = z.object({
  responseVisibility: ResponseVisibilitySchema,
  started: z.number().int(),
  completed: z.number().int(),
  closedEarly: z.number().int(),
  steps: z.array(
    z.object({
      stepKey: StepKeySchema,
      type: z.string(),
      label: z.string(),
      tallies: z.array(z.object({ value: z.string(), label: z.string(), count: z.number().int() })),
    }),
  ),
  responses: z
    .array(
      z.object({
        label: z.string(),
        startedOn: z.string(),
        completed: z.boolean(),
        answers: z.array(z.object({ stepKey: StepKeySchema, answer: AnswerSchema })),
      }),
    )
    .nullable(),
});

// ---------------------------------------------------------------------------------------
// Public recipient API
export const PublicMediaSchema = z.object({
  id: Uuid,
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

export const PublicExperienceSchema = z.object({
  title: z.string(),
  theme: ThemeSchema,
  versionNumber: z.number().int(),
  responsesVisibleToCreator: z.boolean(),
  steps: z.array(DraftStepSchema),
  media: z.array(PublicMediaSchema),
});
export type PublicExperience = z.infer<typeof PublicExperienceSchema>;

export const PublicExperienceMetaSchema = z.object({
  title: z.string(),
  theme: ThemeSchema,
});

export const SessionProgressSchema = z.object({
  completedStepKeys: z.array(StepKeySchema),
  nextStepKey: StepKeySchema.nullable(),
  completed: z.boolean(),
  giftRevealed: z.boolean(),
});
export type SessionProgress = z.infer<typeof SessionProgressSchema>;

export const SessionStateResponseSchema = z.object({
  sessionToken: z.string(),
  experience: PublicExperienceSchema,
  progress: SessionProgressSchema,
});

export const SubmitAnswerRequestSchema = z.strictObject({
  stepKey: StepKeySchema,
  answer: AnswerSchema,
});

export const SubmitAnswerResponseSchema = z.object({
  progress: SessionProgressSchema,
  correct: z.boolean().nullable(),
});

export const RevealGiftRequestSchema = z.strictObject({ stepKey: StepKeySchema });
export const RevealGiftResponseSchema = z.object({
  gift: RevealedGiftSchema,
  progress: SessionProgressSchema,
});

export const REPORT_CATEGORIES = [
  'HARASSMENT',
  'SEXUAL_CONTENT',
  'HATE',
  'SCAM_OR_FRAUD',
  'VIOLENCE',
  'COPYRIGHT',
  'OTHER',
] as const;
export const ReportAbuseRequestSchema = z.strictObject({
  category: z.enum(REPORT_CATEGORIES),
  details: z.string().trim().max(1000).default(''),
});
export const AcceptedResponseSchema = z.object({ accepted: z.literal(true) });

// ---------------------------------------------------------------------------------------
// Administration
export const AdminListQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminReportSchema = z.object({
  id: Uuid,
  experienceId: Uuid.nullable(),
  experienceTitle: z.string().max(2000).nullable(),
  category: z.enum(REPORT_CATEGORIES),
  details: z.string(),
  status: z.enum(['OPEN', 'ACTIONED', 'DISMISSED']),
  resolutionNote: z.string().max(2000).nullable(),
  createdAt: IsoDateTime,
  resolvedAt: IsoDateTime.nullable(),
});
export const AdminReportListResponseSchema = z.object({
  items: z.array(AdminReportSchema),
  nextCursor: z.string().max(2000).nullable(),
});
export const ResolveReportRequestSchema = z.strictObject({
  resolution: z.enum(['ACTIONED', 'DISMISSED']),
  note: z.string().trim().max(500).default(''),
});

export const AdminExperienceSchema = z.object({
  id: Uuid,
  title: z.string(),
  ownerId: Uuid,
  status: ExperienceStatusSchema,
  moderationState: ModerationStateSchema,
  openReports: z.number().int(),
  createdAt: IsoDateTime,
  publishedAt: IsoDateTime.nullable(),
});
export const AdminExperienceListResponseSchema = z.object({
  items: z.array(AdminExperienceSchema),
  nextCursor: z.string().max(2000).nullable(),
});
export const TakedownRequestSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) });

export const AuditLogEntrySchema = z.object({
  id: Uuid,
  actorType: z.enum(['USER', 'ADMIN', 'RECIPIENT', 'SYSTEM']),
  actorId: Uuid.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().max(2000).nullable(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  requestId: z.string().max(2000).nullable(),
  createdAt: IsoDateTime,
});
export const AuditLogListResponseSchema = z.object({
  items: z.array(AuditLogEntrySchema),
  nextCursor: z.string().max(2000).nullable(),
});

export { Uuid as UuidSchema };

// ---------------------------------------------------------------------------------------
// Payments (Phase 2a). Hosted checkout: the browser is sent to the provider's page and comes
// back to the manage page, which asks the API to confirm with the provider.
export const PaymentProviderSchema = z.enum(['RAZORPAY', 'DODO']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;
export const PaymentOrderStatusSchema = z.enum(['CREATED', 'PAID', 'FAILED', 'EXPIRED']);

export const CheckoutOfferSchema = z.object({
  provider: PaymentProviderSchema,
  tier: TierSchema,
  /** Minor units (paise, cents). Dodo may add local tax on its own page. */
  amountMinor: z.number().int(),
  currency: z.string().length(3),
});
export type CheckoutOffer = z.infer<typeof CheckoutOfferSchema>;

export const CheckoutOptionsResponseSchema = z.object({
  billingEnabled: z.boolean(),
  tier: TierStateSchema,
  offers: z.array(CheckoutOfferSchema),
});

export const CreateCheckoutRequestSchema = z.strictObject({
  provider: PaymentProviderSchema,
});

export const CheckoutResponseSchema = z.object({
  orderId: Uuid,
  checkoutUrl: z.url().max(2000),
});

export const ConfirmCheckoutRequestSchema = z.strictObject({
  /** Dodo appends payment_id to the return URL; Razorpay needs nothing. */
  paymentId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,100}$/)
    .optional(),
});

export const ConfirmCheckoutResponseSchema = z.object({
  orderId: Uuid,
  status: PaymentOrderStatusSchema,
  tier: TierStateSchema,
});

/** Public price list. A currency is null when no provider can charge it right now. */
export const PricingResponseSchema = z.object({
  billingEnabled: z.boolean(),
  plans: z.array(
    z.object({
      tier: z.enum(['PLUS', 'PRO']),
      inrMinor: z.number().int().nullable(),
      usdMinor: z.number().int().nullable(),
    }),
  ),
});
