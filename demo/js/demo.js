// Demo page only. The modal itself is dist/js/modal.js, loaded before this file.
const { formatDuration } = sleepyHead;

const timeout = document.querySelector('#timeout');
const owlPicker = document.querySelector('#owl');
const countdown = document.querySelector('#countdown');
let owl;

// Restart with the chosen settings. The modal's HTML stays on the page.
function start() {
  owl?.destroy();
  owl = sleepyHead({ timeout: Number(timeout.value), owl: owlPicker.value });
}

timeout.addEventListener('change', start);
owlPicker.addEventListener('change', start);
start();

document.querySelector('#nap-now').addEventListener('click', () => owl.open());

setInterval(() => {
  countdown.value = owl.dialog.open
    ? 'now (zzz…)'
    : formatDuration(Math.ceil(owl.remaining / 1000) * 1000);
}, 250);
