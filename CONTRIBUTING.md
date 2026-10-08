# Contributing

Keep changes small and explain the concrete problem, resulting behavior and validation.
Discuss major design or architecture changes before implementation. Use Conventional
Commits and keep repository hooks enabled.

For panel changes, run `gjs -m tests/profiles.js`, inspect the live GNOME panel and
check keyboard operation, disabled controls and cleanup when the extension is disabled.
State the tested Ubuntu/GNOME version, display session and laptop model.

For desktop changes, build the workspace with the locked dependencies and run the
relevant upstream checks. The original upstream contribution guide is preserved in
`vendor/asusctl/CONTRIBUTING.md`. Changes intended for that project must follow its
current process, including discussion of significant work with its maintainers.

Review and understand every submitted change. Issue reports should be concise and
based on observed behavior. Preserve third-party license and copyright notices.
