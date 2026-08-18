import { useState } from "react";
import { Button, Dialog, Input, Textarea } from "@chakra-ui/react";

/**
 * Generic destructive-action confirm.
 * props: open, title, body (node), confirmText, confirmWord (if set, user must type it),
 *        askReason (bool), onConfirm(reason) -> Promise, onClose
 * Mount it fresh per target (conditional render or `key`) so the typed/reason state resets.
 */
const ConfirmDialog = ({ open, title, body, confirmText = "Delete", confirmWord, askReason = true, danger = true, onConfirm, onClose }) => {
    const [typed, setTyped] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const ok = !confirmWord || typed.trim() === confirmWord;

    const go = async () => {
        setBusy(true);
        try {
            await onConfirm(reason);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={(e) => !busy && !e.open && onClose()} role="alertdialog">
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content p={6} borderRadius="xl" maxW="520px">
                    <Dialog.CloseTrigger />
                    <Dialog.Header mb={3}>
                        <Dialog.Title fontSize="lg" fontWeight="bold" color={danger ? "#b42323" : undefined}>
                            {title}
                        </Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Body>
                        <div style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{body}</div>
                        {confirmWord && (
                            <div className="field" style={{ marginTop: 14 }}>
                                <label>
                                    Type <b>{confirmWord}</b> to confirm
                                </label>
                                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
                            </div>
                        )}
                        {askReason && (
                            <div className="field" style={{ marginTop: 12 }}>
                                <label>Reason (optional, kept in the log)</label>
                                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate entry" />
                            </div>
                        )}
                    </Dialog.Body>
                    <Dialog.Footer mt={4} gap={2}>
                        <Button variant="outline" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button colorPalette={danger ? "red" : "blue"} onClick={go} loading={busy} disabled={!ok}>
                            {confirmText}
                        </Button>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
};

export default ConfirmDialog;
