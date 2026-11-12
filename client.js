/**
 * Ctrl+Enter to send — browser half.
 *
 * The shipped composer keymap sends on plain Enter and breaks the line on
 * Shift+Enter (its Settings row only chooses Queue vs Steer delivery while the
 * agent is busy). The send/newline rows are fixed reservations, so this bundle
 * does not re-implement the composer: it remaps the two gestures in a capture
 * listener and replays the gesture the app already handles.
 *
 *   Enter        -> replay Shift+Enter  (Lexical INSERT_LINE_BREAK command)
 *   Ctrl+Enter   -> replay plain Enter  (the composer's own submit path,
 *                                         Cmd+Enter on macOS as well)
 *
 * Because the replay re-enters the shipped handler, draft validation, queue
 * delivery, undo history, attachment rules and menu arbitration all stay the
 * app's own. While a slash or reference menu is open, both gestures are left
 * untouched so Enter keeps confirming the highlighted item.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-ctrl-enter-send',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Runtime locale namespace owned by this bundle. */
    const NS = 'ctrl-enter-send'
    /** Remembers the switch position in the page's own storage. */
    const STORAGE_KEY = 'dsh.ctrl-enter-send.enabled'
    /** The composer's contenteditable root (Lexical ContentEditable). */
    const INPUT_SELECTOR = '[data-composer-input]'
    /** The resident composer card, which owns the composed menus. */
    const CARD_SELECTOR = '[data-composer-card]'
    /** A command or reference menu that is currently rendered open. */
    const MENU_SELECTOR = '[role="listbox"], [aria-haspopup="listbox"][aria-expanded="true"]'

    const DICTIONARIES = {
      en: {
        'row.title': 'Composer send key',
        'row.description':
          'Enter inserts a line break; Ctrl+Enter sends the message (Cmd+Enter on macOS). Enter still confirms an open command menu.',
        'row.switch': 'Ctrl+Enter to send',
      },
      zh: {
        'row.title': '发送快捷键',
        'row.description':
          '回车在消息框内换行，Ctrl+Enter 发送消息（macOS 上为 Cmd+Enter）；命令菜单展开时，回车仍用于确认选项。',
        'row.switch': 'Ctrl+Enter 发送',
      },
    }

    const CSS = [
      '.dsh-ctrl-enter-send-row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:16px;padding:16px 0;display:flex}',
      '.dsh-ctrl-enter-send-text{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}',
      '.dsh-ctrl-enter-send-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.dsh-ctrl-enter-send-desc{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:400;line-height:18px}',
      '.dsh-ctrl-enter-send-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border:0;border-radius:11px;cursor:pointer;background:var(--dsw-alias-state-idle-primary);transition:background-color .15s ease}',
      '.dsh-ctrl-enter-send-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsh-ctrl-enter-send-switch-on{background:var(--dsw-alias-brand-primary)}',
      '.dsh-ctrl-enter-send-knob{position:absolute;top:3px;left:3px;display:block;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s ease}',
      '.dsh-ctrl-enter-send-switch-on .dsh-ctrl-enter-send-knob{transform:translateX(18px)}',
      '@media (prefers-reduced-motion:reduce){.dsh-ctrl-enter-send-switch,.dsh-ctrl-enter-send-knob{transition:none}}',
    ].join('')

    /** Read the persisted switch position; the shipped behavior is the default. */
    function readEnabled() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        return stored === null ? true : stored === '1'
      } catch {
        return true
      }
    }

    /** Persist the switch position; storage failures leave the session working. */
    function writeEnabled(enabled) {
      try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
      } catch {
        /* Private mode or a blocked origin: the remap still runs for this page. */
      }
    }

    const state = { enabled: readEnabled(), listeners: new Set() }

    /** Tiny snapshot store shared by the key listener and the Settings row. */
    const store = {
      get() {
        return state.enabled
      },
      set(enabled) {
        const next = enabled === true
        if (next === state.enabled) return
        state.enabled = next
        writeEnabled(next)
        for (const listener of Array.from(state.listeners)) {
          try {
            listener()
          } catch (error) {
            console.error('[ctrl-enter-send] listener failed', error)
          }
        }
      },
      subscribe(listener) {
        state.listeners.add(listener)
        return () => {
          state.listeners.delete(listener)
        }
      },
    }

    /** The composer editable that owns a key event, or null for any other target. */
    function composerInputOf(target) {
      if (!(target instanceof Element)) return null
      return target.closest(INPUT_SELECTOR)
    }

    /** Whether a slash or reference menu is currently rendered inside the card. */
    function hasOpenMenu(input) {
      const card = input.closest(CARD_SELECTOR)
      return card !== null && card.querySelector(MENU_SELECTOR) !== null
    }

    let replaying = false

    /**
     * Re-dispatch an Enter keydown on the composer root with the modifiers the
     * shipped handler expects for the requested gesture.
     * @param source - the intercepted user gesture.
     * @param shiftKey - true replays Shift+Enter (line break), false replays
     *   plain Enter (send).
     */
    function replayEnter(source, shiftKey) {
      const target = source.target
      if (!(target instanceof Element)) return
      replaying = true
      try {
        target.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true,
            composed: true,
            shiftKey,
            repeat: source.repeat === true,
          }),
        )
      } finally {
        replaying = false
      }
    }

    /**
     * Capture-phase remap for the composer.
     * @param event - a window-level keydown.
     */
    function onKeyDown(event) {
      if (replaying) return
      if (event.key !== 'Enter') return
      if (event.isComposing === true || event.keyCode === 229) return
      if (event.altKey === true) return
      if (typeof event.getModifierState === 'function' && event.getModifierState('AltGraph')) return
      const input = composerInputOf(event.target)
      if (input === null || input.isContentEditable !== true) return
      const accelerated = event.ctrlKey === true || event.metaKey === true
      if (accelerated) {
        // Ctrl+Shift+Enter and the both-modifier chords keep the app's own meaning.
        if (event.shiftKey === true || (event.ctrlKey === true && event.metaKey === true)) return
      } else if (event.shiftKey === true) {
        // Shift+Enter already inserts a line break.
        return
      }
      // An open menu keeps the shipped Enter arbitration (confirm the highlighted item).
      if (hasOpenMenu(input)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      replayEnter(event, accelerated === false)
    }

    let detachKeys = null

    /** Install the capture listener once. */
    function attachKeys() {
      if (detachKeys !== null) return
      window.addEventListener('keydown', onKeyDown, true)
      detachKeys = () => window.removeEventListener('keydown', onKeyDown, true)
    }

    /** Remove the capture listener, leaving the shipped composer untouched. */
    function detachKeyListener() {
      if (detachKeys === null) return
      detachKeys()
      detachKeys = null
    }

    /** Follow the switch position. */
    function syncKeyListener() {
      if (store.get()) attachKeys()
      else detachKeyListener()
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'ctrl-enter-send: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = '@local/dsh-ctrl-enter-send'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => {
            tag.remove()
          }
        }, 'ctrl-enter-send: row styles')

        ctx.effect(() => {
          syncKeyListener()
          const unsubscribe = store.subscribe(syncKeyListener)
          return () => {
            unsubscribe()
            detachKeyListener()
          }
        }, 'ctrl-enter-send: composer key remap')

        /** General Settings row that owns the switch and re-reads the locale. */
        function SendKeyRow() {
          const [enabled, setEnabled] = React.useState(store.get())
          const [, forceLocale] = React.useState(0)
          React.useEffect(() => store.subscribe(() => setEnabled(store.get())), [])
          React.useEffect(() => ctx.locale.subscribe(() => forceLocale((value) => value + 1)), [])
          return h(
            'div',
            { className: 'dsh-ctrl-enter-send-row' },
            h(
              'div',
              { className: 'dsh-ctrl-enter-send-text' },
              h('div', { className: 'dsh-ctrl-enter-send-title' }, t('row.title')),
              h('div', { className: 'dsh-ctrl-enter-send-desc' }, t('row.description')),
            ),
            h(
              'button',
              {
                type: 'button',
                role: 'switch',
                'aria-checked': enabled,
                'aria-label': t('row.switch'),
                title: t('row.switch'),
                className:
                  'dsh-ctrl-enter-send-switch' + (enabled ? ' dsh-ctrl-enter-send-switch-on' : ''),
                onClick: () => store.set(!enabled),
              },
              h('span', { className: 'dsh-ctrl-enter-send-knob', 'aria-hidden': 'true' }),
            ),
          )
        }

        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            {
              name: 'settings.general.item',
              id: 'ctrl-enter-send',
              order: 21,
            },
            SendKeyRow,
          ),
        )
      },
    }
  },
})
