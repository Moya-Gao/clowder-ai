/** Shared 401 error with hint for cats to use text-based @mention instead. */
export const EXPIRED_CREDENTIALS_ERROR = {
  error: 'Invalid or expired callback credentials',
  hint: '如果只是想 @队友，直接在你的回复文本里另起一行、行首写 @猫名 即可（免费、永不过期）。Callback token 有生命周期限制（~10分钟），仅用于异步中途汇报。',
};
