// Activation glyphs: tiny shapes, drawn rather than typed so they read the
// same on every platform.
const SHAPES: ((c: string) => React.ReactNode)[] = [
  (c) => <circle cx="9" cy="9" r="5.5" fill={c} />,
  (c) => <rect x="3.5" y="3.5" width="11" height="11" fill={c} />,
  (c) => <path d="M9 2.5 L15.5 15 H2.5 Z" fill={c} />,
  (c) => <path d="M9 1.5 L16 9 L9 16.5 L2 9 Z" fill={c} />,
  (c) => <path d="M7 2.5 H11 V7 H15.5 V11 H11 V15.5 H7 V11 H2.5 V7 H7 Z" fill={c} />,
  (c) => <circle cx="9" cy="9" r="5" fill="none" stroke={c} strokeWidth="2.6" />,
  (c) => <path d="M3 13 A6 6 0 0 1 15 13 Z" fill={c} />,
  (c) => (
    <path
      d="M9 1.8 L11 7 L16.4 7.2 L12.2 10.6 L13.6 15.8 L9 12.8 L4.4 15.8 L5.8 10.6 L1.6 7.2 L7 7 Z"
      fill={c}
    />
  ),
];

export function Glyph({
  id,
  color = 'currentColor',
  size = 18,
}: {
  id: number;
  color?: string;
  size?: number;
}) {
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      {SHAPES[id % SHAPES.length]!(color)}
    </svg>
  );
}

const NAMES = ['dot', 'block', 'peak', 'diamond', 'cross', 'ring', 'dome', 'star'];
export const glyphName = (id: number) => NAMES[id % NAMES.length]!;
