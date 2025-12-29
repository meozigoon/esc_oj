import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";

export default function BenefitPage() {
    const [open, setOpen] = useState(false);
    const loggedRef = useRef(false);

    useEffect(() => {
        if (loggedRef.current) {
            return;
        }
        loggedRef.current = true;
        apiFetch("/api/access-logs", { method: "POST" })
            .catch(() => undefined)
            .finally(() => setOpen(true));
    }, []);

    const handleClose = () => {
        setOpen(false);
        window.close();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>알림</DialogTitle>
            <DialogContent>
                <Typography>감사합니다.</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} variant="contained">
                    확인
                </Button>
            </DialogActions>
        </Dialog>
    );
}
