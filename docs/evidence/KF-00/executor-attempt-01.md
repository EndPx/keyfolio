# Executor attempt01

Date:2026-11-06. Codex review. Result:FAILED launch; C00 NOT_RUN. Runtime route selected: Orca agent dsh, terminal-mode fallback because no structured dsh session is supported by this runtime.

Observed: worker-start failed at agent_readiness with timeout. worker-read then showed the concrete failure: installed dsh-tui launcher0.17.0 tried to install its profile plugin, which does not declare compatibility with Harness0.2.1-rc.5. The plugin manager rejected installation. Task never ran; no worker-produced result exists. The terminal was released through the receipt's supported worker-release action, which confirmed closure and archive capture.

Recovery: verified registry release0.18.0 extends the compatibility declaration to this Harness runtime. Updated launcher, installed matching hook dependency0.2.1-rc.5 and installed TUI0.18.0 into its profile through the supported plugin manager. Composed profile now includes TUI/hooks. Dependency peer warnings and a nonfatal missing tool-ralph patch warning remain; successful task execution has not been established. No downgrade of desktop Harness, compatibility-risk exemption, other model or provider substitution. Retry waits for the known missing CLI credential prerequisite.

Separately, model routing is now configured to gater/deepseek-v4.1-flash-1017-v2, matching the user's screenshot and desktop config. GATER_API_KEY environment name is configured, but its value is absent in coordinator Process/User/Machine scopes; local credential-source clarification requested without collecting secrets in chat. This is not proof that the user's desktop connection fails.

Independent fixture oracle was computed locally by Codex: retain alpha revision2/value13, beta revision1/value11, gamma revision1/value19; count3, total43, duplicate_count1. Fixture SHA-2569d0f3c5c34f256e84ba42ea6640dddba6c43c142a4e43b5cfc5e550423b06837. This oracle is not a DeepSeek result or C00 pass.
