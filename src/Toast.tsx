/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ComponentType,
  type FC,
  type MouseEvent,
  type SVGAttributes,
  useCallback,
  useEffect,
} from "react";
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Close as DialogClose,
  Title as DialogTitle,
} from "@radix-ui/react-dialog";
import classNames from "classnames";
import { Text } from "@vector-im/compound-web";

import styles from "./Toast.module.css";
import overlayStyles from "./Overlay.module.css";

interface Props {
  /**
   * The controlled open state of the toast.
   */
  open: boolean;
  /**
   * Callback for when the user dismisses the toast.
   */
  onDismiss: () => void;
  /**
   * A number of milliseconds after which the toast should be automatically
   * dismissed.
   */
  autoDismiss?: number;
  children: string;
  /**
   * A supporting icon to display within the toast.
   */
  Icon?: ComponentType<SVGAttributes<SVGElement>>;
  /**
   * Whether the toast should be modal, making it fill the screen (by portalling
   * it into the root of the document) and trap focus until dismissed.
   * @default true
   */
  modal?: boolean;
  /**
   * An optional action button rendered at the end of the toast (SelfMatrix
   * Discord-style shell), e.g. "View in spotlight". Clicking it does not
   * dismiss the toast on its own; combine with onDismiss in the handler if
   * the action should also close the toast.
   */
  action?: { label: string; onClick: () => void };
}

/**
 * A temporary message shown in an overlay in the center of the screen.
 */
export const Toast: FC<Props> = ({
  open,
  onDismiss,
  autoDismiss,
  children,
  Icon,
  modal = true,
  action,
}) => {
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onDismiss();
    },
    [onDismiss],
  );

  useEffect(() => {
    if (open && autoDismiss !== undefined) {
      const timeout = setTimeout(onDismiss, autoDismiss);
      return (): void => clearTimeout(timeout);
    }
  }, [open, autoDismiss, onDismiss]);

  // The action button lives inside the DialogClose that dismisses the toast
  // on click, so we stop the click from propagating to avoid dismissing the
  // toast as a side effect of running the action (the action's own handler
  // can still call onDismiss itself if that's the desired behaviour).
  const onActionClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      action?.onClick();
    },
    [action],
  );

  const content = (
    <>
      <DialogOverlay
        className={classNames(overlayStyles.bg, overlayStyles.animate)}
      />
      <DialogContent aria-describedby={undefined} asChild>
        <DialogClose
          className={classNames(
            overlayStyles.overlay,
            overlayStyles.animate,
            styles.toast,
          )}
        >
          <DialogTitle asChild>
            <Text as="h3" size="sm" weight="semibold">
              {children}
            </Text>
          </DialogTitle>
          {Icon && <Icon width={20} height={20} aria-hidden />}
          {action && (
            <button
              type="button"
              className={styles.action}
              onClick={onActionClick}
            >
              {action.label}
            </button>
          )}
        </DialogClose>
      </DialogContent>
    </>
  );

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange} modal={modal}>
      {modal ? <DialogPortal>{content}</DialogPortal> : content}
    </DialogRoot>
  );
};
