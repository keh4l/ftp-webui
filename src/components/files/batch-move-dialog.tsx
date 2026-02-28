import { MoveRight } from "lucide-react";

import { PathInputDialog } from "./path-input-dialog";

type BatchMoveDialogProps = {
  paths: string[];
  initialDestination: string;
  isOpen: boolean;
  onConfirmAction: (destinationDir: string) => void;
  onCancelAction: () => void;
};

export function BatchMoveDialog({
  paths,
  initialDestination,
  isOpen,
  onConfirmAction,
  onCancelAction,
}: BatchMoveDialogProps) {
  return (
    <PathInputDialog
      title="确认批量移动"
      description="请输入目标目录路径后确认移动。"
      inputLabel="目标目录路径："
      initialPath={initialDestination}
      placeholder="例如 /var/www"
      confirmText="确认移动"
      icon={<MoveRight className="h-5 w-5 text-accent" aria-hidden="true" />}
      paths={paths}
      isOpen={isOpen}
      onConfirmAction={onConfirmAction}
      onCancelAction={onCancelAction}
      dialogTestId="batch-move-dialog"
      countTestId="batch-move-count"
      inputTestId="batch-move-input"
      confirmButtonTestId="batch-move-confirm-btn"
      cancelButtonTestId="batch-move-cancel-btn"
    />
  );
}
