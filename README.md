# Ctrl+Enter to send (DSH plugin)

A Harness profile bundle that flips the composer's send gesture: **Enter inserts a
line break, Ctrl+Enter sends the message**.

| Gesture | Result |
| --- | --- |
| `Enter` | Inserts a line break in the message box |
| `Ctrl+Enter` / `Cmd+Enter` | Sends the message (same delivery path as the Send button) |
| `Shift+Enter` | Line break (unchanged) |
| `Enter` while a `/` or `@` menu is open | Confirms the highlighted item (unchanged) |
| `Alt+Enter`, `Ctrl+Shift+Enter`, `Ctrl+Cmd+Enter` | Left to the app (ignored, unchanged) |
| IME composition `Enter` | Left to the IME (unchanged) |

## Install

Install the bundle from the repository root into the current DSH profile:

```text
plugin_manager install_bundle
  target: github:lone-wolf-akela/dsh-ctrl-enter-send
```

Equivalently, in the profile's `package.json` add the dependency
`"@local/dsh-ctrl-enter-send": "github:lone-wolf-akela/dsh-ctrl-enter-send"` and
`@local/dsh-ctrl-enter-send` to `dsh.profile.bundles`. The plugin then shows up
in Settings → Plugins and can be disabled there.

## Where the switch is

Settings → General → **Composer send key** (directly below the shipped
"Composer Enter" row). Turn it off to restore the original Enter-to-send
behavior; the position is remembered in the page's local storage. Disabling the
plugin removes the row and the remap entirely.

## How it works

The composer's own keymap (Lexical) treats `Enter` as submit, `Shift+Enter` as
line break, and `Ctrl/Cmd+Enter` as the "complementary" submit; its Shortcut
rows are fixed reservations, so a plugin cannot rebind them. This bundle instead:

1. Listens for `keydown` in the capture phase on `window`, and only acts when the
   event target is the composer editable (`[data-composer-input]`) and no
   command/reference menu is rendered open inside the composer card.
2. Calls `preventDefault()` + `stopImmediatePropagation()` on the original gesture.
3. Re-dispatches the gesture the app already handles on the same element:
   `Shift+Enter` for a line break, plain `Enter` for send.

Because the replay re-enters the shipped handler, draft/attachment validation,
queue vs steer delivery, undo history, the Enter-repeat guard, and menu
arbitration all stay the app's own code. Nothing of the composer is replaced or
restyled.

## Bundle layout

```
package.json        bundle manifest (dsh.bundle.patch + dsh.client)
cordis.patch.yml    inserts row id "ctrl-enter-send"
index.js            Host half (no-op; the browser half owns the feature)
client.js           key remap + General Settings row
locale/en.json      plugin inventory title/description (English)
locale/zh.json      plugin inventory title/description (Chinese)
icon.svg            original icon (keycap with a return arrow and a Ctrl caret)
LICENSE             MIT
```

Runtime copy is registered through the client locale service (namespace
`ctrl-enter-send`), so the row follows the active language.

## Verification

- `plugin_manager install_bundle` → `application: "applied"`, no warnings.
- Host row `include:ctrl-enter-send` is present (no Config schema, as intended).
- Live client slot `settings.general.item` lists occupant `ctrl-enter-send`
  (registrant of this bundle, order 21, active), which proves the browser half
  applied and registered its row.

Not verifiable in the development environment: actual keystrokes and the
rendered row (no browser control there; the connected page can only be
inspected, not driven). The remap targets shipped, inspected behavior:
`[data-composer-input]` is the Lexical contenteditable, `[data-composer-card]`
owns the menus, Lexical's `Shift+Enter` path dispatches
`INSERT_LINE_BREAK_COMMAND`, and plain `Enter` runs the composer's submit
handler.

## Known limits

- Settings → Shortcuts still lists `Enter` for the fixed "Send" row: those rows
  are reserved by the shipped conversation plugin and cannot be relabeled.
  There is no visible "Enter to send" tooltip on the Send button, so this only
  affects the shortcut reference list.
- The switch position is stored per page origin. If the app changes origin
  between launches, the row falls back to its default (on).

## License

MIT — see [LICENSE](LICENSE).
