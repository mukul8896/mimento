import type { Schemas } from '@momentpath/api-client';
import { Card } from '@momentpath/design-system';

type ResultsData = Schemas['ResultsResponseDto_Output'];

export function Results({ results }: { results: ResultsData }) {
  const labelFor = (stepKey: string, value: string) =>
    results.steps.find((s) => s.stepKey === stepKey)?.tallies.find((t) => t.value === value);

  return (
    <Card>
      <h2 className="font-semibold">Results</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[
          ['Link opened', results.opens],
          ['Started', results.started],
          ['Completed', results.completed],
          ['Left early', results.closedEarly],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-ink-50 p-3">
            <dt className="text-xs text-ink-500">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-500">
        Opened in the last 30 days: {results.opensByDay.reduce((n, d) => n + d.opens, 0)} times.
        Opens count every visit, including yours.
      </p>
      <p className="mt-3 text-xs text-ink-500">
        Leaving early or closing the page never counts as an answer. Wish Revealer does not collect
        recipients’ IP addresses, locations or devices.
      </p>

      {results.started > 0 && results.reach.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium">How far people got</h3>
          <ul className="mt-2 space-y-1.5" data-testid="reach">
            {results.reach.map((step, i) => (
              <li key={step.stepKey} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {i + 1}. {step.label}
                  </span>
                  <span className="shrink-0 text-ink-600">
                    {step.reached} of {results.started}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ink-100" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-brand-500"
                    style={{ width: `${(step.reached / results.started) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-500">
            With branching, some steps are only on one path, so fewer people reach them.
          </p>
        </div>
      ) : null}

      {results.steps.length > 0 ? (
        <div className="mt-5 space-y-4">
          {results.steps.map((s) => {
            const total = s.tallies.reduce((n, t) => n + t.count, 0);
            return (
              <div key={s.stepKey}>
                <h3 className="text-sm font-medium">{s.label}</h3>
                {s.tallies.length === 0 ? (
                  <p className="text-sm text-ink-500">No answers yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {s.tallies.map((t) => (
                      <li key={t.value} className="text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{t.label}</span>
                          <span className="shrink-0 text-ink-600">{t.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-ink-100" aria-hidden="true">
                          <div
                            className="h-2 rounded-full bg-brand-500"
                            style={{ width: `${total ? (t.count / total) * 100 : 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-medium">Individual responses</h3>
        {results.responses === null ? (
          <p className="mt-1 text-sm text-ink-500">
            You chose to see totals only, so individual answers are hidden.
          </p>
        ) : results.responses.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">No responses yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {results.responses.map((r) => (
              <li key={r.label} className="py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-ink-500">
                    {r.startedOn} · {r.completed ? 'completed' : 'in progress'}
                  </span>
                </div>
                {r.answers.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-ink-700">
                    {r.answers.map((a) => {
                      const value =
                        a.answer.kind === 'CHOICE'
                          ? a.answer.value
                          : a.answer.kind === 'OPTION'
                            ? a.answer.optionId
                            : a.answer.kind === 'TEXT'
                              ? a.answer.value
                              : '';
                      const step = results.steps.find((s) => s.stepKey === a.stepKey);
                      return (
                        <li key={a.stepKey}>
                          <span className="text-ink-500">{step?.label ?? 'Question'}:</span>{' '}
                          {labelFor(a.stepKey, value)?.label ?? value}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
