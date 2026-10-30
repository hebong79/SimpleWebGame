import type { Direction } from './engine.js';
export function swipeDirection(dx: number, dy: number): Direction | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx), Math.abs(dy)) < 24 || Math.abs(dx) === Math.abs(dy)) return null;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
}
const KEYS: Record<string, Direction | undefined> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
export interface InputOptions { enabled: () => boolean; move: (direction: Direction) => void; pause: () => void }
export function bindInput(board: HTMLElement, options: InputOptions): { reset: () => void; destroy: () => void } {
  const controller = new AbortController();
  const signal = controller.signal;
  const held = new Set<string>();
  const pointers = new Set<number>();
  let gesture: { id: number; x: number; y: number } | null = null;
  let rejected = false;
  const reset = (): void => {
    gesture = null; rejected = false; held.clear();
    for (const id of pointers) { try { if (board.hasPointerCapture(id)) board.releasePointerCapture(id); } catch { /* Already released. */ } }
    pointers.clear();
  };
  board.addEventListener('keydown', event => {
    if (event.target !== board || document.activeElement !== board) return;
    if (event.key === 'Escape' && options.enabled()) { event.preventDefault(); options.pause(); return; }
    const direction = KEYS[event.key];
    if (!direction || !options.enabled()) return;
    event.preventDefault();
    if (event.repeat || held.has(event.key)) return;
    held.add(event.key); options.move(direction);
  }, { signal });
  window.addEventListener('keyup', event => held.delete(event.key), { signal });
  // Capture page-wide pointers before the board handler, without blocking page interaction.
  window.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    if (pointers.size > 1 || (gesture && gesture.id !== event.pointerId)) { gesture = null; rejected = true; }
  }, { capture: true, signal });
  board.addEventListener('pointerdown', event => {
    if (!options.enabled()) return;
    if (rejected || pointers.size !== 1 || !event.isPrimary) { gesture = null; rejected = true; return; }
    if (event.pointerType === 'mouse' && event.button !== 0) { pointers.delete(event.pointerId); return; }
    board.focus({ preventScroll: true });
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { board.setPointerCapture(event.pointerId); } catch { gesture = null; }
  }, { signal });
  window.addEventListener('pointerup', event => {
    // Finish here, not in a later board listener: capture must not erase a valid swipe first.
    const current = gesture;
    const valid = current?.id === event.pointerId && !rejected && options.enabled();
    pointers.delete(event.pointerId); gesture = null;
    if (pointers.size === 0) rejected = false;
    if (valid && current) { const direction = swipeDirection(event.clientX - current.x, event.clientY - current.y); if (direction) options.move(direction); }
  }, { capture: true, signal });
  const cancel = (event: PointerEvent): void => { pointers.delete(event.pointerId); gesture = null; if (!pointers.size) rejected = false; };
  window.addEventListener('pointercancel', cancel, { capture: true, signal });
  board.addEventListener('lostpointercapture', cancel, { signal });
  board.addEventListener('contextmenu', event => event.preventDefault(), { signal });
  window.addEventListener('blur', reset, { signal });
  window.addEventListener('resize', reset, { signal });
  return { reset, destroy: () => { reset(); controller.abort(); } };
}
