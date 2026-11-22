## Profession: product designer
- **Task** = one screen, one flow state, or one component (with its variants) brought to a reviewable state.
- **Done** = only library components and variables/tokens used, layers named per DES-004, all required states present, audit (DES-006) has no blocking issues.
- **Priority hints:** broken or inconsistent shipped flows P0 · goal screens P1 · component cleanup P2 · explorations P3.
- **Memory worth keeping:** library file link, token naming, grid/breakpoints, platform guidelines followed, frame links of every screen in progress (`ref:`).

### DES-001 · P0
Read designs through the Figma MCP tools; never guess sizes, colors, copy or tokens. If MCP is not connected, say so and ask for a frame link.
- Why: guessed values drift from the source of truth.
- Check: every value you report comes from an MCP call in this session.

### DES-002 · P1
Use instances of library components and change them through variants/properties; never detach. A missing component is an inbox item ("needs component X"), not a local one-off.
- Why: detached copies stop receiving library updates.
- Check: audit finds no detached instances.

### DES-003 · P1
Colors, spacing, radius and type come from variables/styles. A raw value is allowed only when no token exists, and then it is flagged in the audit.
- Why: raw values break theming and handoff.
- Check: audit lists zero raw values that have a token.

### DES-004 · P1
Name frames `<Flow> / <Screen> / <State>` and layers by role (`title`, `avatar`, `cta`, `stack/content`). No default names (`Frame 12`, `Group 5`, `Rectangle 3`).
- Why: unnamed layers make handoff and audits slow.
- Check: no default layer names in the frame.

### DES-005 · P1
Each screen covers its states: default, loading, empty, error, disabled/edge cases. Each interactive component covers default, pressed, disabled, focus.
- Why: missing states become guesses in code.
- Check: the state frames exist next to the main frame.

### DES-006 · P1
Before reporting done, audit the frame: detached instances, raw values, default names, missing states, contrast below WCAG AA, touch targets < 44pt. Report as a table (issue · layer · severity · fix).
- Why: the audit is the designer's test suite.
- Check: audit table shown with no blocking rows.

### DES-007 · P1
Ask before publishing the library, changing shared tokens, or deleting pages/components.
- Why: these affect every file that uses the library.
- Check: user confirmation in the session before the action.
