import { CheckmarkIcon, CopyIcon } from "@dynatrace/strato-icons";
import React, { useState } from "react";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong, Code } from "@dynatrace/strato-components/typography";

export const CopyBtn: React.FC<{ text: string; dk: boolean; label?: string; small?: boolean }> = ({ text, dk, label, small }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <Button
      onClick={handleCopy}
      size="condensed"
      color={copied ? "success" : "neutral"}
      aria-label={copied ? "Copied" : (label || "Copy query")}
    >
      <Button.Prefix>{copied ? <CheckmarkIcon /> : <CopyIcon />}</Button.Prefix>
      {small ? null : copied ? "Copied" : "Copy"}
    </Button>
  );
};
