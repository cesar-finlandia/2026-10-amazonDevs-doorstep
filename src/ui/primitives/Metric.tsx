// src/ui/primitives/Metric.tsx (DP-UI §3.3, §5.6 §6.4).
// Requirement IDs: FR-19
function abbreviate(n: number): { text: string; exact: string } {
  if (n >= 1000000) {
    const v = Math.round((n / 1000000) * 100) / 100;
    return { text: `${v}M`, exact: String(n) };
  }
  if (n > 9999) {
    const v = Math.round((n / 1000) * 10) / 10;
    return { text: `${v}k`, exact: String(n) };
  }
  return { text: String(n), exact: String(n) };
}

export function Metric(props: {
  label: string;
  value: number | string | null;
  unit?: string;
  support?: string;
  size: "md" | "lg" | "xl";
  tone?: "default" | "accent" | "warning" | "danger" | "success";
  loading?: boolean;
  max?: number;
  title?: string;
}): React.JSX.Element {
  const sizeClass = props.size === "xl" ? "metric__value--xl" : props.size === "md" ? "metric__value--md" : "metric__value--lg";
  let text = "—";
  let exact: string | undefined;
  if (props.loading) {
    text = "";
  } else if (typeof props.value === "number") {
    if (props.max !== undefined && props.value > props.max) {
      text = `${props.max}+`;
      exact = String(props.value);
    } else {
      const a = abbreviate(props.value);
      text = a.text;
      exact = a.exact !== a.text ? a.exact : undefined;
    }
  } else if (typeof props.value === "string") {
    text = props.value;
  }
  const tone = props.tone ?? "default";
  return (
    <div className="metric">
      <span className="eyebrow">{props.label}</span>
      <span>
        <span
          className={`metric__value${sizeClass ? ` ${sizeClass}` : ""}`}
          data-metric=""
          {...(tone !== "default" ? { "data-tone": tone } : {})}
          {...(props.loading ? { "aria-busy": "true" } : {})}
          {...(exact ?? props.title ? { title: exact ?? props.title } : {})}
        >
          {props.loading ? (
            <>
              <span className="work-indicator__tick" aria-hidden="true" />
              <span className="work-indicator__tick" aria-hidden="true" />
              <span className="work-indicator__tick" aria-hidden="true" />
            </>
          ) : (
            text
          )}
        </span>
        {props.unit ? <span className="metric__unit">{props.unit}</span> : null}
      </span>
      {props.support ? <span className="support">{props.support}</span> : null}
    </div>
  );
}
