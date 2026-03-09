## What

<!-- What did you change? List key files and modifications. -->

## Why

<!-- Why this change? Constraints, risks, goals. -->

## Tradeoff

<!-- What alternatives were considered? Why not those? -->

## Test Evidence

<!-- How was this tested? Paste relevant output. -->

```
pnpm --filter @cat-cafe/shared build   # result
pnpm --filter @cat-cafe/api test:public # result
pnpm -r --if-present run build         # result
```

## Open Questions

<!-- Anything uncertain? What should reviewers focus on? -->
