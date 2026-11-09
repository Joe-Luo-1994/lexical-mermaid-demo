# Editor Evidence design decisions

Audience: engineers investigating an editor operation, including first-time users without the original author present. The core path is **choose evidence → compare conditions → inspect an event → hand off a falsifiable experiment**.

## References and adopted decisions

Reviewed on 2026-11-10:
- [UI UX Pro Max skill source](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md): accessibility, progressive disclosure, predictable navigation, semantic color and readable typography.
- [Impeccable workflow](https://impeccable.style/docs/impeccable/): preserve product context, clarify hierarchy, inspect the actual browser result.

These are source-informed, manually selected product rules. No skill search/generator was executed, and no claim of generated recommendations is made. No third-party skill code, fonts, CDN, animation framework or runtime dependency is required. The references above are mutable upstream URLs; this file is the reviewed, versioned local decision record.

## Visual and interaction contract

- Warm neutral canvas, forest-green primary action, white reading surfaces. Color supplements text; it does not establish whether evidence is valid.
- UI body target 15px, important explanations 14px, secondary evidence labels at least 12px. System fonts; no remote font request. IDs and numbers must wrap or scroll within their own container.
- Primary entry routes: run a public experiment or import a supported recording. Custom settings are disclosed explicitly. The guide can be reopened without deleting evidence.
- Observed request differences precede timing summaries. Keep two-rAF, queueing, noise and company-scope limitations near results. Do not add improvement badges or percentage claims.
- Evidence links move focus to the inspector. Returning restores the originating evidence control. Tabs support arrows and Home/End, with a labelled panel and one tab stop.
- Touch controls target 44px on narrow screens. Desktop evidence buttons have at least a 40px height. Visible focus, skip link, reduced motion and page reflow are required. A detailed accessibility audit is still separate from these checks.
- Handoff explains single recording vs experiment bundle, local file placement, report/event identity and model-provider boundaries. Copying never sends a message.
- Do not automatically persist company evidence in browser storage. All recordings remain in page memory; clearly remind users to export. Future persistence requires an explicit save/delete workflow.

## Maintenance and verification

Read this file before UI changes. Preserve locked dependencies, schema and measurement boundaries. Use `npm run test:ux` after a production build for focused navigation, keyboard, export and responsive checks. `npm test` includes this check and the existing evidence/experiment regressions.

Screenshots and raw test output go under ignored `results/ux/`. Browser checks establish behavior, not human usability improvement. A fresh user's ability to find an extra request and hand it off without coaching remains the next product validation.
