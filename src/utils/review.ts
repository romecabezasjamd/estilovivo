import { InAppReview } from '@capacitor-community/in-app-review';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const REVIEW_PROMPT_KEY = 'ev_last_review_prompt';
const MIN_DAYS_BETWEEN_PROMPTS = 90;
const MIN_SESSIONS_BEFORE_PROMPT = 5;

let sessionCount = 0;

export function trackSession() {
  sessionCount++;
}

export async function requestReview() {
  if (!isNative) return;

  if (sessionCount < MIN_SESSIONS_BEFORE_PROMPT) return;

  const lastPrompt = localStorage.getItem(REVIEW_PROMPT_KEY);
  if (lastPrompt) {
    const daysSinceLastPrompt = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < MIN_DAYS_BETWEEN_PROMPTS) return;
  }

  try {
    await InAppReview.requestReview();
    localStorage.setItem(REVIEW_PROMPT_KEY, Date.now().toString());
    sessionCount = 0;
  } catch (e) {
    console.warn('In-app review request failed:', e);
  }
}
