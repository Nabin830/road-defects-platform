export function Placeholder({ label, className = '', style }: { label: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`ph ${className}`} style={style} role="img" aria-label={`Image placeholder: ${label}`}>
      <span>{label}</span>
    </div>
  );
}
