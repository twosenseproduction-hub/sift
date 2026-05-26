import { useCallback, useMemo, useState } from "react";
import {
  buildDailySiftShareUrl,
  dailySiftShareTitle,
  type DailySiftSharePayload,
} from "@/lib/daily-sift-share";
import type { SharePromptDialogProps } from "@/components/share-prompt-dialog";

type ShareDialogState = {
  open: boolean;
  payload: DailySiftSharePayload | null;
};

/**
 * Image-first Daily Sift share: opens SharePromptDialog (9:16 card) instead of
 * link-only navigator.share.
 */
export function useDailySiftShare() {
  const [state, setState] = useState<ShareDialogState>({
    open: false,
    payload: null,
  });

  const openShare = useCallback((payload: DailySiftSharePayload) => {
    setState({ open: true, payload });
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    setState((prev) => ({
      open,
      payload: open ? prev.payload : null,
    }));
  }, []);

  const shareDialogProps = useMemo((): SharePromptDialogProps | null => {
    if (!state.payload) return null;
    const { promptId, themeName, promptText } = state.payload;
    return {
      open: state.open,
      onOpenChange,
      eyebrow: dailySiftShareTitle(themeName),
      line: promptText,
      shareUrl: buildDailySiftShareUrl(promptId),
    };
  }, [state.open, state.payload, onOpenChange]);

  return { openShare, shareDialogProps };
};
