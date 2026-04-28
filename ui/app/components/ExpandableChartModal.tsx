import React from "react";
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";

interface ExpandableChartModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  maxHeight?: number;
}

export const ExpandableChartModal: React.FC<ExpandableChartModalProps> = ({
  open,
  onClose,
  title,
  children,
}) => {
  return (
    <Modal title={title || "Chart"} show={open} onDismiss={onClose} size="large">
      <Flex style={{ width: "100%", height: "min(80vh, 900px)" }} alignItems="center" justifyContent="center">
        {children}
      </Flex>
    </Modal>
  );
};

interface ExpandChartButtonProps {
  onClick: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const ExpandChartButton: React.FC<ExpandChartButtonProps> = ({ onClick, style }) => {
  return (
    <Text style={style}>
      <Button
        onClick={(e: React.MouseEvent<Element>) => { e.stopPropagation(); onClick(e as React.MouseEvent); }}
        variant="default"
        size="condensed"
        aria-label="Expand chart"
      >
        ⤢
      </Button>
    </Text>
  );
};
