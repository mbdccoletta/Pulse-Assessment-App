// ui/app/components/EstateTargetModal.tsx
//
// The estate the project plans to monitor (data/estateTarget.ts): three numbers, saved for the whole environment.
// Labels and numbers only; what the target does is in the field hints.

import React, { useEffect, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { FormField, Label, NumberInput } from "@dynatrace/strato-components/forms";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Text } from "@dynatrace/strato-components/typography";
import { useTr } from "../i18n/lang";
import { saveEstateTarget, type EstateTarget } from "../data/estateTarget";

interface Props {
  open: boolean;
  target: EstateTarget;
  onClose: () => void;
  /** Called after a save, with the stored target: the host re-runs the assessment. */
  onSaved: (target: EstateTarget) => void;
}

export const EstateTargetModal: React.FC<Props> = ({ open, target, onClose, onSaved }) => {
  const tr = useTr();
  const [draft, setDraft] = useState<EstateTarget>(target);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (open) { setDraft(target); setFailed(false); } }, [open, target]);

  const save = async (next: EstateTarget) => {
    setBusy(true);
    setFailed(false);
    try {
      await saveEstateTarget(next);
      onSaved(next);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof EstateTarget, label: string) => (
    <FormField>
      <Label>{label}</Label>
      <NumberInput
        min={0}
        value={draft[key] ?? null}
        onChange={(v) => setDraft(d => ({ ...d, [key]: v == null || v <= 0 ? undefined : Math.floor(v) }))}
        placeholder="—"
      />
    </FormField>
  );

  return (
    <Modal show={open} onDismiss={() => { if (!busy) onClose(); }} title={tr("Estate target", "Meta do ambiente", "Meta del entorno")} size="small">
      <Flex flexDirection="column" gap={12}>
        <Text textStyle="small">
          {tr(
            "What the project plans to monitor. Each number set adds a foundation criterion: monitored ÷ planned.",
            "O que o projeto prevê monitorar. Cada número preenchido adiciona um critério de fundação: monitorado ÷ previsto.",
            "Lo que el proyecto prevé monitorear. Cada número completado agrega un criterio de base: monitoreado ÷ previsto.",
          )}
        </Text>
        {field("hosts", tr("Hosts", "Hosts", "Hosts"))}
        {field("applications", tr("Web and mobile applications", "Aplicações web e mobile", "Aplicaciones web y móviles"))}
        {field("clusters", tr("Kubernetes clusters", "Clusters Kubernetes", "Clusters de Kubernetes"))}
        {failed && <Text textStyle="small">{tr("The target could not be saved.", "Não foi possível salvar a meta.", "No se pudo guardar la meta.")}</Text>}
        <Flex justifyContent="space-between" gap={8}>
          <Button onClick={() => void save({})} disabled={busy}>{tr("Clear", "Limpar", "Borrar")}</Button>
          <Flex gap={8}>
            <Button onClick={onClose} disabled={busy}>{tr("Cancel", "Cancelar", "Cancelar")}</Button>
            <Button onClick={() => void save(draft)} loading={busy} variant="emphasized" color="primary">
              {tr("Save and run", "Salvar e rodar", "Guardar y ejecutar")}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};
