/**
 * Sleepy Head Modal v1.0.1
 * https://github.com/SimonHayter/Sleepy-Head-Modal
 *
 * Shows a friendly modal dialog after a visitor has been inactive for a while.
 * No dependencies. Built on the native <dialog> element.
 *
 * @author Simon Hayter
 * @license MIT
 */

export const VERSION = '1.0.1';

/** Owls bundled in dist/img. Pick one with the `owl` option. */
export const OWLS = ['brown', 'blue', 'mint', 'pink', 'sunset'];

const owlImage = (name) => new URL(`../img/${name}-owl.svg`, import.meta.url).href;

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'];

const DEFAULTS = {
  /** Milliseconds of inactivity before the modal opens. */
  timeout: 20_000,
  /** An existing <dialog> (element or selector). If none is found, one is built for you. */
  dialog: '[data-sleepy-head]',
  /** Text used when the dialog is built for you. `{duration}` shows the time away, counting up while open. */
  title: 'Shh… the owl’s napping',
  message: [
    'Nothing’s stirred for {duration}, so I took that as my cue for forty winks.',
    'Nudge me when you’re back. I’m a light sleeper, honest.',
  ],
  wakeLabel: 'I’m back!',
  closeLabel: 'Close',
  /** Which bundled owl to show: 'brown', 'blue', 'mint', 'pink' or 'sunset'. */
  owl: 'brown',
  /** Or the URL of your own image (overrides `owl`). */
  image: null,
  /** Called when the modal opens / closes. */
  onSleep: null,
  onWake: null,
};

let instanceCount = 0;

/**
 * Formats milliseconds as a readable duration, e.g. "20 seconds" or "2 minutes".
 * @param {number} ms
 * @param {string} [locale]
 */
export function formatDuration(ms, locale = document.documentElement.lang || undefined) {
  const total = Math.round(ms / 1000);
  const unit = (value, name) =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'long' }).format(value);

  const parts = [];
  if (total >= 60) parts.push(unit(Math.floor(total / 60), 'minute'));
  if (total % 60 || total < 60) parts.push(unit(total % 60, 'second'));

  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);
}

function buildDialog(settings) {
  const id = `sleepy-head-${++instanceCount}`;
  const dialog = document.createElement('dialog');

  dialog.className = 'sleepy-head';
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-message`);
  dialog.dataset.sleepyHead = '';
  dialog.dataset.sleepyHeadGenerated = '';

  dialog.innerHTML = `
    <div class="sleepy-head__panel">
      <header class="sleepy-head__header">
        <h2 class="sleepy-head__title" id="${id}-title"></h2>
        <form method="dialog">
          <button class="sleepy-head__close" type="submit" value="close">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        </form>
      </header>
      <div class="sleepy-head__body">
        <div class="sleepy-head__owl" aria-hidden="true">
          <img src="" alt="" width="110" height="122">
          <span class="sleepy-head__zzz"><span>z</span><span>z</span><span>z</span></span>
        </div>
        <div class="sleepy-head__message" id="${id}-message"></div>
      </div>
      <form class="sleepy-head__actions" method="dialog">
        <button class="sleepy-head__wake" type="submit" value="wake" autofocus></button>
      </form>
    </div>`;

  // User-supplied strings are set as text, never parsed as HTML.
  dialog.querySelector('.sleepy-head__title').textContent = settings.title;
  dialog.querySelector('.sleepy-head__close').setAttribute('aria-label', settings.closeLabel);
  dialog.querySelector('.sleepy-head__wake').textContent = settings.wakeLabel;

  const message = dialog.querySelector('.sleepy-head__message');
  for (const line of [].concat(settings.message)) {
    // `{duration}` becomes a live element that counts up while the modal is open.
    const [first, ...rest] = line.split('{duration}');
    const p = document.createElement('p');
    p.append(first);
    for (const text of rest) {
      const time = document.createElement('span');
      time.dataset.sleepyHeadDuration = '';
      p.append(time, text);
    }
    message.append(p);
  }

  document.body.append(dialog);
  return dialog;
}

/**
 * Starts watching for inactivity and opens the Sleepy Head modal when the visitor dozes off.
 *
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{ dialog: HTMLDialogElement, readonly remaining: number, open(): void, close(): void, reset(): void, destroy(): void }}
 */
export function sleepyHead(options = {}) {
  const settings = { ...DEFAULTS, ...options };

  const found = typeof settings.dialog === 'string'
    ? document.querySelector(settings.dialog)
    : settings.dialog;
  const generated = !(found instanceof HTMLDialogElement);
  const dialog = generated ? buildDialog(settings) : found;

  // An owl or image passed in options also applies to existing markup.
  const img = dialog.querySelector('.sleepy-head__owl img');
  if (img && (generated || options.owl || options.image)) {
    img.src = settings.image ?? owlImage(settings.owl);
  }

  // Every `data-sleepy-head-duration` element shows how long the visitor has been away.
  const durations = dialog.querySelectorAll('[data-sleepy-head-duration]');
  const showDuration = (ms) => {
    const text = formatDuration(ms);
    for (const el of durations) el.textContent = text;
  };
  showDuration(settings.timeout);

  // Native light dismiss (click outside / Esc) where supported.
  dialog.setAttribute('closedby', 'any');

  const controller = new AbortController();
  const { signal } = controller;
  let lastActivity = performance.now();
  let timer = 0;
  let ticker = 0;

  const schedule = (delay = settings.timeout) => {
    clearTimeout(timer);
    timer = setTimeout(check, delay);
  };

  // A single timer is re-armed lazily, so constant mouse movement costs almost nothing.
  function check() {
    if (dialog.open) return;
    const idle = performance.now() - lastActivity;
    if (idle >= settings.timeout) open();
    else schedule(settings.timeout - idle);
  }

  function open() {
    if (dialog.open) return;
    clearTimeout(timer);
    showDuration(settings.timeout);
    dialog.showModal();

    // Count up from the timeout, once a second. Measured from the opening time
    // so it stays accurate even when background tabs throttle the interval.
    const openedAt = performance.now();
    ticker = setInterval(() => {
      const seconds = Math.floor((performance.now() - openedAt) / 1000);
      showDuration(settings.timeout + seconds * 1000);
    }, 1000);

    dialog.dispatchEvent(new CustomEvent('sleepyhead:sleep'));
    settings.onSleep?.(dialog);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function reset() {
    lastActivity = performance.now();
    if (!dialog.open) schedule();
  }

  const markActive = () => {
    if (!dialog.open) lastActivity = performance.now();
  };

  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, markActive, { capture: true, passive: true, signal });
  }

  // Fallback light dismiss for browsers without `closedby`: a click on the
  // dialog element itself (not its panel) is a click on the backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  }, { signal });

  dialog.addEventListener('close', () => {
    clearInterval(ticker);
    reset();
    dialog.dispatchEvent(new CustomEvent('sleepyhead:wake', { detail: { reason: dialog.returnValue || 'dismiss' } }));
    dialog.returnValue = '';
    settings.onWake?.(dialog);
  }, { signal });

  schedule();

  return {
    dialog,
    /** Milliseconds until the modal opens (0 while it is open). */
    get remaining() {
      return dialog.open ? 0 : Math.max(0, settings.timeout - (performance.now() - lastActivity));
    },
    open,
    close,
    reset,
    destroy() {
      controller.abort();
      clearTimeout(timer);
      clearInterval(ticker);
      close();
      showDuration(settings.timeout);
      if ('sleepyHeadGenerated' in dialog.dataset) dialog.remove();
    },
  };
}

// Also available globally, so a plain <script type="module" src> tag works without `import`.
sleepyHead.formatDuration = formatDuration;
sleepyHead.OWLS = OWLS;
sleepyHead.version = VERSION;
globalThis.sleepyHead = sleepyHead;

export default sleepyHead;
