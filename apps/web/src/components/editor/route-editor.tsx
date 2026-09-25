'use client';

import {
  answerChoices,
  END,
  flowIssues,
  MAX_ROUTE_RULES,
  type DraftStep,
  type RouteCondition,
  type RouteRule,
  type RouteTarget,
  type StepRouting,
} from '@momentpath/contracts';
import { Button, Field, Input, Select } from '@momentpath/design-system';
import { STEP_TYPE_LABEL, stepSummary } from './reducer';

type OtherCondition = Exclude<RouteCondition, { kind: 'ANSWER' }>;
type OtherKind = OtherCondition['kind'];

const NEXT = '';
const CONDITION_LABEL: Record<OtherKind, string> = {
  SCORE_AT_LEAST: 'Quiz score is at least',
  DATE_ON_OR_AFTER: 'Date is on or after',
  COMPLETED: 'They completed',
};

export function stepName(steps: readonly DraftStep[], key: string): string {
  const i = steps.findIndex((s) => s.key === key);
  const step = steps[i];
  return step ? `Step ${i + 1}: ${stepSummary(step)}` : 'A deleted step';
}

function describeTarget(steps: readonly DraftStep[], target: RouteTarget | null): string {
  if (target === null) return 'the next step';
  if (target === END) return 'the end';
  return stepName(steps, target);
}

function TargetSelect({
  label,
  value,
  onChange,
  steps,
  self,
  nextLabel = 'Continue to the next step',
  field,
}: {
  /** Accessible name when the select is not inside a labelled Field. */
  label?: string;
  /** Props from a surrounding Field (its label points at this id). */
  field?: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };
  value: RouteTarget | null;
  onChange: (target: RouteTarget | null) => void;
  steps: readonly DraftStep[];
  self: string;
  nextLabel?: string;
}) {
  return (
    <Select
      {...field}
      aria-label={field ? undefined : label}
      value={value ?? NEXT}
      onChange={(e) => onChange(e.target.value === NEXT ? null : (e.target.value as RouteTarget))}
    >
      <option value={NEXT}>{nextLabel}</option>
      {steps.map((s, i) =>
        s.key === self ? null : (
          <option key={s.key} value={s.key}>
            Go to step {i + 1}: {stepSummary(s)} ({STEP_TYPE_LABEL[s.type]})
          </option>
        ),
      )}
      <option value={END}>End the experience here</option>
    </Select>
  );
}

function defaultCondition(
  kind: OtherKind,
  steps: readonly DraftStep[],
  self: string,
): OtherCondition {
  if (kind === 'SCORE_AT_LEAST') return { kind, value: 1 };
  if (kind === 'DATE_ON_OR_AFTER') return { kind, date: new Date().toISOString().slice(0, 10) };
  return { kind, stepKey: steps.find((s) => s.key !== self)?.key ?? self };
}

/**
 * "What happens next" for one step. Question steps get a row per answer; every step gets a
 * fallback, and optional extra conditions (quiz score, date, another step completed). The
 * rules are stored exactly as the server evaluates them (contracts/flow.ts).
 */
export function RouteEditor({
  step,
  steps,
  onChange,
}: {
  step: DraftStep;
  steps: readonly DraftStep[];
  onChange: (next: StepRouting | undefined) => void;
}) {
  if (step.type === 'GIFT_REVEAL') {
    return <p className="text-sm text-ink-600">The final surprise always ends the experience.</p>;
  }

  const routing: StepRouting = step.next ?? { rules: [], otherwise: null };
  const choices = answerChoices(step);
  const answerRules = routing.rules.filter(
    (r): r is RouteRule & { when: { kind: 'ANSWER' } } => r.when.kind === 'ANSWER',
  );
  const otherRules = routing.rules.filter((r) => r.when.kind !== 'ANSWER');
  const issues = flowIssues(steps).filter((i) => i.stepKey === step.key && i.field === 'next');

  const save = (rules: RouteRule[], otherwise: RouteTarget | null) =>
    onChange({ rules: rules.slice(0, MAX_ROUTE_RULES), otherwise });

  // Answer rules come first so an answer always wins over the extra conditions.
  const setAnswerTarget = (value: string, target: RouteTarget | null) => {
    const kept = answerRules.filter((r) => r.when.equals !== value);
    const answers =
      target === null
        ? kept
        : [...kept, { when: { kind: 'ANSWER' as const, equals: value }, goto: target }];
    const ordered = (choices ?? []).flatMap((c) =>
      answers.filter((r) => r.when.equals === c.value),
    );
    save([...ordered, ...otherRules], routing.otherwise);
  };
  const setOther = (index: number, rule: RouteRule | null) => {
    const others = [...otherRules];
    if (rule) others[index] = rule;
    else others.splice(index, 1);
    save([...answerRules, ...others], routing.otherwise);
  };

  return (
    <section aria-labelledby={`route-${step.key}`} className="space-y-4" data-testid="route-editor">
      <div>
        <h3 id={`route-${step.key}`} className="font-semibold">
          What happens next
        </h3>
        <p className="text-sm text-ink-600">
          Send people down different paths. Leave everything on “next step” for a simple sequence.
        </p>
      </div>

      {choices ? (
        <div className="space-y-3">
          {choices.map((choice) => {
            const rule = answerRules.find((r) => r.when.equals === choice.value);
            return (
              <Field key={choice.value} label={`If they answer “${choice.label}”`}>
                {(field) => (
                  <TargetSelect
                    field={field}
                    value={rule?.goto ?? null}
                    onChange={(t) => setAnswerTarget(choice.value, t)}
                    steps={steps}
                    self={step.key}
                    nextLabel="Follow the rule below"
                  />
                )}
              </Field>
            );
          })}
        </div>
      ) : null}

      {otherRules.map((rule, index) => {
        const when = rule.when as OtherCondition;
        return (
          <div key={index} className="space-y-2 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                aria-label="Condition"
                value={when.kind}
                onChange={(e) =>
                  setOther(index, {
                    ...rule,
                    when: defaultCondition(e.target.value as OtherKind, steps, step.key),
                  })
                }
              >
                {(Object.keys(CONDITION_LABEL) as OtherKind[]).map((k) => (
                  <option key={k} value={k}>
                    If {CONDITION_LABEL[k].toLowerCase()}
                  </option>
                ))}
              </Select>
              {when.kind === 'SCORE_AT_LEAST' ? (
                <Input
                  type="number"
                  min={0}
                  max={30}
                  aria-label="Correct answers"
                  value={when.value}
                  onChange={(e) =>
                    setOther(index, {
                      ...rule,
                      when: {
                        kind: when.kind,
                        value: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                      },
                    })
                  }
                />
              ) : when.kind === 'DATE_ON_OR_AFTER' ? (
                <Input
                  type="date"
                  aria-label="Date"
                  value={when.date}
                  onChange={(e) =>
                    e.target.value &&
                    setOther(index, { ...rule, when: { kind: when.kind, date: e.target.value } })
                  }
                />
              ) : (
                <Select
                  aria-label="Completed step"
                  value={when.stepKey}
                  onChange={(e) =>
                    setOther(index, { ...rule, when: { kind: when.kind, stepKey: e.target.value } })
                  }
                >
                  {steps.map((s) =>
                    s.key === step.key ? null : (
                      <option key={s.key} value={s.key}>
                        {stepName(steps, s.key)}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </div>
            <TargetSelect
              label="Then"
              value={rule.goto}
              onChange={(t) => setOther(index, t === null ? null : { ...rule, goto: t })}
              steps={steps}
              self={step.key}
              nextLabel="Remove this condition"
            />
          </div>
        );
      })}

      {routing.rules.length < MAX_ROUTE_RULES ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            save(
              [
                ...answerRules,
                ...otherRules,
                { when: defaultCondition('SCORE_AT_LEAST', steps, step.key), goto: END },
              ],
              routing.otherwise,
            )
          }
        >
          + Add a condition
        </Button>
      ) : null}

      <Field label={routing.rules.length > 0 ? 'Otherwise' : 'After this step'}>
        {(field) => (
          <TargetSelect
            field={field}
            value={routing.otherwise}
            onChange={(t) => save(routing.rules, t)}
            steps={steps}
            self={step.key}
          />
        )}
      </Field>

      {routing.rules.length > 0 || routing.otherwise !== null ? (
        <p className="text-xs text-ink-500">
          Otherwise people go to {describeTarget(steps, routing.otherwise)}. Branching is a PRO
          feature.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <ul className="space-y-1" role="alert">
          {issues.map((i, n) => (
            <li
              key={n}
              className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 ring-1 ring-amber-200"
            >
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
