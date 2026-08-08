import React from "react";
import { useDemoMode } from "../../app/DemoModeContext";

type SensitiveProps = {
  /** Element to render as — defaults to "span" for inline text, use "div" for block content. */
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Native title tooltip. Stripped while blurred — filter: blur() only affects paint,
   *  not attributes, so a hover would otherwise leak the real value as a tooltip. */
  title?: string;
  /** Keep content legible while focused — for fields that pre-fill with real saved data
   *  but the admin may need to actively edit during a demo (e.g. a notes textarea). */
  unblurOnFocus?: boolean;
  /** Escape hatch to force this instance to never blur, regardless of demo mode. */
  disabled?: boolean;
  [key: string]: any;
};

/** Wraps confidential admin data (customer PII, financial figures, secrets, internal notes)
 *  so it renders blurred whenever Demo Mode is on. Visual-only — not a security boundary. */
export function Sensitive({
  as,
  children,
  className,
  style,
  title,
  unblurOnFocus,
  disabled,
  ...rest
}: SensitiveProps) {
  const { demoMode } = useDemoMode();
  const [focused, setFocused] = React.useState(false);
  const Tag = (as ?? "span") as React.ElementType;

  if (!demoMode || disabled) {
    return (
      <Tag className={className} style={style} title={title} {...rest}>
        {children}
      </Tag>
    );
  }

  const blurred = !(unblurOnFocus && focused);

  return (
    <Tag
      className={[className, "bb-sensitive", blurred && "bb-sensitive--on"].filter(Boolean).join(" ")}
      style={style}
      title={blurred ? undefined : title}
      onFocusCapture={unblurOnFocus ? () => setFocused(true) : undefined}
      onBlurCapture={unblurOnFocus ? () => setFocused(false) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Sensitive;
