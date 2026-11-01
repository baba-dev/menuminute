/** Small circular gauge (inspired by Magic UI's "Animated Circular Progress Bar"). Decorative:
 * the adjacent text always states the numbers. */
export function ProgressRing({
  done,
  total,
  size = 30,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <svg
      className="kk-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="kk-ring-track"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        className="kk-ring-value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
