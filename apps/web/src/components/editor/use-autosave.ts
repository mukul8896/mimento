'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftStep, ExperienceSettings, Theme } from '@momentpath/contracts';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export interface DraftContent {
  title: string;
  theme: Theme;
  settings: ExperienceSettings;
  steps: DraftStep[];
}

const DEBOUNCE_MS = 800;

/**
 * Debounced autosave with optimistic concurrency. Only one save is in flight; edits made while
 * saving trigger another save afterwards. A 409 stops autosave and asks the user to reload.
 */
export function useAutosave(experienceId: string, content: DraftContent, initialRevision: number) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [message, setMessage] = useState<string | null>(null);
  const revision = useRef(initialRevision);
  const latest = useRef(content);
  const savedJson = useRef(JSON.stringify(content));
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  const save = useCallback(async (): Promise<boolean> => {
    if (stopped.current) return false;
    if (inFlight.current) {
      await inFlight.current;
    }
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJson.current) {
      setStatus('saved');
      return true;
    }
    setStatus('saving');
    const run = (async () => {
      try {
        const res = unwrap(
          await browserApi().PUT('/api/v1/experiences/{id}/draft', {
            params: { path: { id: experienceId } },
            body: { revision: revision.current, ...snapshot },
          }),
        );
        revision.current = res.revision;
        savedJson.current = json;
        setMessage(null);
        setStatus(JSON.stringify(latest.current) === json ? 'saved' : 'pending');
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.problem.code === 'REVISION_CONFLICT') {
          stopped.current = true;
          setStatus('conflict');
          setMessage(err.problem.title);
        } else {
          setStatus('error');
          setMessage(
            err instanceof ApiError
              ? (err.problem.issues?.[0]?.message ?? err.problem.title)
              : 'Could not save. Check your connection.',
          );
        }
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [experienceId]);

  useEffect(() => {
    latest.current = content;
    if (stopped.current) return;
    if (JSON.stringify(content) === savedJson.current) {
      // An edit was undone before it was saved: nothing is pending any more.
      if (!inFlight.current) setStatus((s) => (s === 'pending' ? 'saved' : s));
      return;
    }
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedJson.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  /** Saves immediately (used before publishing or editing gift details). */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return save();
  }, [save]);

  return { status, message, flush };
}
