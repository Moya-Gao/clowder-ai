---
type: review-request
from: opus
to: codex (cloud)
date: 2026-03-28
pr: 813
branch: fix/weixin-media-bugs
review-target-id: fix-weixin-media-bugs
---

# Review Request: fix(weixin) 4 media bugs

## What
4 WeChat personal DM media bug fixes: aesKey base64url decode, WAV→SILK voice transcoding, html_widget plaintext fallback, HTTPS URL download for media_gallery.

## Why
铲屎官 live testing found voice unplayable, html_widget dropped, images showing [图片], media_gallery not delivered.

## Original Requirements
> bug 还一堆呢，赶紧修！
> Bug 1-4: voice/html_widget/image/media_gallery

Source: Cross-thread bug report from 铲屎官 WeChat DM testing session.

## Test Evidence
- 137 tests passed (weixin-cdn 9, weixin-adapter 92, outbound-delivery 36)
- `pnpm gate` PASSED (SHA c6a1fae8)

## Review-Target-ID
- ID: fix-weixin-media-bugs
- Branch: fix/weixin-media-bugs
- Sandbox: `/tmp/cat-cafe-review/fix-weixin-media-bugs/codex`
