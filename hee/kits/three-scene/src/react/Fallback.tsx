// Requirement IDs: HEE-KIT-01
export interface FallbackProps {
  custom?: React.ReactNode;
}

export function Fallback({ custom }: FallbackProps): React.JSX.Element {
  if (custom) return <>{custom}</>;
  return (
    <div role="img" aria-label="3D view unavailable">
      3D view unavailable: this browser has no WebGL.
    </div>
  );
}
