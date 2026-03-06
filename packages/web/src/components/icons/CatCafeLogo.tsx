/** Cat Café Logo V2 — 海豚环抱三猫（简洁线条版） */
export function CatCafeLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 海豚主体轮廓 */}
      <path d="M300 90C340 70 360 110 350 160C340 210 290 260 220 290Q200 298 180 290C110 260 60 210 50 160C40 110 60 70 100 60C140 50 180 45 200 45C220 45 260 50 300 60Q320 70 300 90" />
      {/* 海豚尾鳍 */}
      <path d="M350 160Q375 140 385 110M350 160Q380 175 390 210" />
      {/* 海豚眼睛 */}
      <circle cx="295" cy="95" r="5" fill="currentColor" stroke="none" />
      {/* 左猫 */}
      <path d="M110 310L120 275L130 305L140 275L150 310Q155 335 150 350L110 350Q105 335 110 310" />
      <path d="M105 350Q85 365 75 350" />
      {/* 中猫 */}
      <path d="M175 305L185 265L197 300L210 265L220 305Q230 335 225 355L170 355Q165 335 175 305" />
      {/* 右猫 */}
      <path d="M245 310L255 275L265 305L275 275L285 310Q290 335 285 350L245 350Q240 335 245 310" />
      <path d="M290 350Q310 365 320 350" />
    </svg>
  );
}
