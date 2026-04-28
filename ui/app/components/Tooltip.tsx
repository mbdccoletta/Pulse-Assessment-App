import React from "react";
import { Tooltip as StratoTooltip } from "@dynatrace/strato-components-preview/overlays";
import { Text } from "@dynatrace/strato-components/typography";

interface Props {
  text: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom";
  maxWidth?: number;
  containerStyle?: React.CSSProperties;
}

export const Tooltip: React.FC<Props> = ({ text, children, position = "top", containerStyle }) => {
  const placement = position === "bottom" ? "bottom" : "top";

  const content = containerStyle ? (
    <Text style={{ display: "inline-flex", ...containerStyle }}>{children}</Text>
  ) : children;

  return (
    <StratoTooltip text={text} placement={placement}>
      {content}
    </StratoTooltip>
  );
};
