# Security policy

Please report security issues privately to the repository owner rather than opening a public issue. Include the affected version, reproduction steps, and expected impact.

## Current dependency audit

The production dependency tree has no known moderate, high, or critical advisories as of August 20, 2026.

One low-severity advisory remains in `@ai-sdk/provider-utils@3.0.32`, inherited through the latest Cline SDK's optional Dify provider adapter: [GHSA-866g-f22w-33x8](https://github.com/advisories/GHSA-866g-f22w-33x8). The advisory lists `3.0.98` as patched, but no such v3 release is published. This application exposes only the Cline provider and does not select the Dify adapter. The vulnerable adapter's `undici` dependency is separately pinned to a patched release.

The override should be removed once Cline updates the adapter or a compatible patched v3 package is published. CI fails the audit for moderate or higher findings.
