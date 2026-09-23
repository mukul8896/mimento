'use client';

import Link from 'next/link';
import { useCallback, useMemo, useReducer, useState } from 'react';
import { STEP_TYPES, type DraftDocument, type StepType } from '@momentpath/contracts';
import { Badge, Button, cx, Input } from '@momentpath/design-system';
import type { MediaItem } from './media-upload';
import { PreviewPane } from './preview-pane';
import { PublishDialog } from './publish-dialog';
import {
  canAdd,
  canDuplicate,
  editorReducer,
  STEP_TYPE_HINT,
  STEP_TYPE_LABEL,
  stepSummary,
} from './reducer';
import { StepForm, type StepFormContext } from './step-forms';
import { ThemePanel } from './theme-panel';
import { useAutosave, type SaveStatus } from './use-autosave';

type MobileView = 'steps' | 'edit' | 'style' | 'preview';

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Not saved',
  conflict: 'Changed elsewhere',
};

export function Editor({ draft }: { draft: DraftDocument }) {
  const [state, dispatch] = useReducer(editorReducer, {
    title: draft.title,
    theme: draft.theme,
    settings: draft.settings,
    steps: draft.steps,
    selectedKey: draft.steps[0]?.key ?? null,
  });
  const [media, setMedia] = useState<MediaItem[]>(draft.media);
  const [secrets, setSecrets] = useState<Record<string, boolean>>(
    Object.fromEntries(draft.gifts.map((g) => [g.stepKey, g.hasSecret])),
  );
  const [view, setView] = useState<MobileView>('steps');
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const content = useMemo(
    () => ({
      title: state.title,
      theme: state.theme,
      settings: state.settings,
      steps: state.steps,
    }),
    [state.title, state.theme, state.settings, state.steps],
  );
  const { status, message, flush } = useAutosave(draft.experienceId, content, draft.revision);
  const selected = state.steps.find((s) => s.key === state.selectedKey) ?? null;

  const ctx: StepFormContext = {
    experienceId: draft.experienceId,
    media,
    addMedia: (item) => setMedia((m) => [...m.filter((x) => x.id !== item.id), item]),
    flush,
    hasGiftSecret: (key) => secrets[key] === true,
    setGiftSecretSaved: (key, saved) => setSecrets((s) => ({ ...s, [key]: saved })),
  };

  const select = useCallback((key: string) => {
    dispatch({ type: 'select', key });
    setView('edit');
  }, []);

  function add(stepType: StepType) {
    dispatch({ type: 'add', stepType, key: crypto.randomUUID() });
    setAdding(false);
    setView('edit');
  }

  const tabs: { id: MobileView; label: string }[] = [
    { id: 'steps', label: 'Steps' },
    { id: 'edit', label: 'Edit' },
    { id: 'style', label: 'Style' },
    { id: 'preview', label: 'Preview' },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6 lg:pb-8">
      <div className="sticky top-14 z-20 -mx-4 border-b border-ink-100 bg-ink-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/experiences/${draft.experienceId}`}
            className="text-sm text-ink-500 hover:underline"
            aria-label="Back to experience"
          >
            ←
          </Link>
          <Input
            aria-label="Experience title"
            value={state.title}
            maxLength={120}
            onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
            className="min-w-0 flex-1 font-semibold sm:max-w-md"
          />
          <span
            role="status"
            aria-live="polite"
            data-testid="save-status"
            data-status={status}
            className="text-xs text-ink-600"
          >
            {STATUS_TEXT[status]}
          </span>
          <Button
            onClick={() => setPublishing(true)}
            disabled={status === 'conflict'}
            className="ml-auto"
            data-testid="publish"
          >
            Publish
          </Button>
        </div>
        {status === 'error' || status === 'conflict' ? (
          <p role="alert" className="mt-2 text-sm text-danger-700">
            {message}{' '}
            {status === 'conflict' ? (
              <button type="button" className="underline" onClick={() => window.location.reload()}>
                Reload
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        {/* Steps */}
        <section
          aria-label="Steps"
          className={cx(view === 'steps' ? 'block' : 'hidden', 'lg:block')}
        >
          <ol className="space-y-2" data-testid="step-list">
            {state.steps.map((step, i) => (
              <li
                key={step.key}
                className={cx(
                  'rounded-2xl bg-white p-3 shadow-sm ring-1',
                  step.key === state.selectedKey ? 'ring-2 ring-brand-500' : 'ring-ink-100',
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => select(step.key)}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    {i + 1}. {STEP_TYPE_LABEL[step.type]}
                  </span>
                  <span className="block truncate text-sm font-medium">{stepSummary(step)}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Move step ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => dispatch({ type: 'move', key: step.key, direction: -1 })}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === state.steps.length - 1}
                    onClick={() => dispatch({ type: 'move', key: step.key, direction: 1 })}
                  >
                    ↓
                  </Button>
                  {canDuplicate(step) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        dispatch({ type: 'duplicate', key: step.key, newKey: crypto.randomUUID() })
                      }
                    >
                      Duplicate
                    </Button>
                  ) : null}
                  {confirmRemove === step.key ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          dispatch({ type: 'remove', key: step.key });
                          setConfirmRemove(null);
                        }}
                      >
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(step.key)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {state.steps.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-ink-600">
              No steps yet. Add your first one.
            </p>
          ) : null}
          {adding ? (
            <div className="mt-3 grid gap-2" role="group" aria-label="Choose a step type">
              {STEP_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!canAdd(state, t)}
                  onClick={() => add(t)}
                  className="rounded-xl bg-white p-3 text-left ring-1 ring-ink-200 hover:ring-brand-400 disabled:opacity-40"
                >
                  <span className="block text-sm font-medium">{STEP_TYPE_LABEL[t]}</span>
                  <span className="block text-xs text-ink-500">{STEP_TYPE_HINT[t]}</span>
                </button>
              ))}
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setAdding(true)}>
              + Add step
            </Button>
          )}
        </section>

        {/* Edit */}
        <section
          aria-label="Edit step"
          className={cx(view === 'edit' ? 'block' : 'hidden', 'lg:block')}
        >
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100 sm:p-6">
            {selected ? (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <Badge>{STEP_TYPE_LABEL[selected.type]}</Badge>
                  <span className="text-sm text-ink-500">
                    Step {state.steps.indexOf(selected) + 1}
                  </span>
                </div>
                <StepForm
                  key={selected.key}
                  step={selected}
                  ctx={ctx}
                  onChange={(config) => dispatch({ type: 'update', key: selected.key, config })}
                />
              </>
            ) : (
              <p className="text-sm text-ink-600">Select a step to edit it.</p>
            )}
          </div>
          <div className="mt-6 hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100 sm:p-6 lg:block">
            <ThemePanel
              theme={state.theme}
              settings={state.settings}
              onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
              onSettings={(settings) => dispatch({ type: 'setSettings', settings })}
            />
          </div>
        </section>

        {/* Style (mobile only; desktop shows it under the form) */}
        <section
          aria-label="Style"
          className={cx(view === 'style' ? 'block' : 'hidden', 'lg:hidden')}
        >
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100">
            <ThemePanel
              theme={state.theme}
              settings={state.settings}
              onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
              onSettings={(settings) => dispatch({ type: 'setSettings', settings })}
            />
          </div>
        </section>

        {/* Preview */}
        <section
          aria-label="Preview"
          className={cx(
            view === 'preview' ? 'block' : 'hidden',
            'lg:sticky lg:top-32 lg:block lg:self-start',
          )}
        >
          <PreviewPane
            title={state.title}
            theme={state.theme}
            settings={state.settings}
            steps={state.steps}
            media={media}
          />
        </section>
      </div>

      <nav
        aria-label="Editor sections"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={view === t.id}
            onClick={() => setView(t.id)}
            className={cx(
              'min-h-14 text-sm font-medium',
              view === t.id ? 'text-brand-700' : 'text-ink-500',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <PublishDialog
        experienceId={draft.experienceId}
        open={publishing}
        onOpenChange={setPublishing}
        flush={flush}
        onSelectStep={select}
        stepLabel={(key) => {
          const step = state.steps.find((s) => s.key === key);
          return step
            ? `Step ${state.steps.indexOf(step) + 1} (${STEP_TYPE_LABEL[step.type]})`
            : 'Step';
        }}
      />
    </div>
  );
}
