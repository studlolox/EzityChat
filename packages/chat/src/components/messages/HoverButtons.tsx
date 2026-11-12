import React, { useState, useMemo, useCallback, useContext, memo, useId } from 'react';
import { Copy, Check } from 'lucide';
import * as Ariakit from '@ariakit/react';
import { GitFork, GitCommit, GitBranchPlus, ListTree, Ellipsis } from 'lucide-react';
import {
  ForkOptions,
  getSpeechText,
  findMessageById,
  getTagsForRating,
  isUserInitiatedCompaction,
} from 'librechat-data-provider';
import {
  Button,
  EditIcon,
  OGDialog,
  Textarea,
  MorphIcon,
  useLocalize,
  ThumbUpIcon,
  ContinueIcon,
  DropdownPopup,
  OGDialogTitle,
  TooltipAnchor,
  ThumbDownIcon,
  RegenerateIcon,
  OGDialogContent,
  useToastContext,
} from '@librechat/client';
import type {
  TConversation,
  TMessage,
  TFeedback,
  TForkConvoRequest,
} from 'librechat-data-provider';
import type { NamedExoticComponent, ReactNode } from 'react';
import type { MenuItemProps } from '@librechat/client';
import { MessageAudioSlot, useMessagesHost } from '../../react/messages/host';
import useGenerationsByLatest from '../../react/messages/generations';
import { hasEditablePart } from '../../core/parts/editableParts';
import { ChatContext } from '../../react/chat/context';

type THoverButtons = {
  isEditing: boolean;
  enterEdit: (cancel?: boolean) => void;
  copyToClipboard: (setIsCopied: React.Dispatch<React.SetStateAction<boolean>>) => void;
  getCanCopy: () => boolean;
  conversation: TConversation | null;
  message: TMessage;
  regenerate: () => void;
  handleContinue: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** The tail as of the row's last render, which the row re-renders on whenever
   *  this message enters or leaves it; compared against, never sent anywhere. */
  latestMessageId?: string;
  /** The tail at call time, for actions that send it (forking at a split target). */
  getLatestMessageId?: () => string | undefined;
  isLast: boolean;
  index: number;
  handleFeedback?: ({ feedback }: { feedback: TFeedback | undefined }) => void;
};

type HoverButtonProps = {
  id?: string;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isLast?: boolean;
  /** Fades the button in with its row; the latest message's toolbar stays visible. */
  reveal?: boolean;
  dataTestId?: string;
  disabled?: boolean;
};

const HoverButton = memo(
  ({
    id,
    onClick,
    title,
    icon,
    isActive = false,
    isLast = false,
    reveal = !isLast,
    dataTestId,
    disabled = false,
  }: HoverButtonProps) => {
    return (
      <TooltipAnchor
        description={title}
        render={
          <Button
            variant={reveal ? 'message-hover-reveal' : 'message-hover'}
            size="icon"
            id={id}
            data-testid={dataTestId}
            data-hover-active={isActive || undefined}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
          >
            {icon}
          </Button>
        }
      />
    );
  },
);

HoverButton.displayName = 'HoverButton';

function isRateLimited(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) {
    return false;
  }
  const { status, statusCode, response } = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  return response?.status === 429 || status === 429 || statusCode === 429;
}

const HoverButtons = ({
  index,
  isEditing,
  enterEdit,
  copyToClipboard,
  getCanCopy,
  conversation,
  message,
  regenerate,
  handleContinue,
  latestMessageId,
  getLatestMessageId,
  isLast,
  handleFeedback,
}: THoverButtons): ReactNode => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  /** Read from the pane's chat contract here rather than passed down: a send toggles the
   *  rerun controls on every row, and only this toolbar has to re-render for it. */
  const isSubmitting = useContext(ChatContext)?.isSubmitting === true;
  const [isCopied, setIsCopied] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [openFeedbackDialog, setOpenFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState(message.feedback?.text ?? '');
  const moreMenuId = useId();

  const host = useMessagesHost();
  const { useGetMessages, useHasPendingTurn } = host;
  const getMessages = useGetMessages();
  const hasPendingTurn = useHasPendingTurn(conversation?.conversationId ?? '');
  const forkConversation = host.useForkConversation();
  const { option: forkSetting, splitAtTarget } = host.useForkPreferences();

  const endpoint = useMemo(() => {
    if (!conversation) {
      return '';
    }
    return conversation.endpointType ?? conversation.endpoint;
  }, [conversation]);

  /** Which turn a rerun would replay, resolved for a model turn only. */
  const parentIsUserMessage = useMemo(() => {
    if (message.isCreatedByUser === true) {
      return undefined;
    }
    const messages = getMessages();
    if (messages == null) {
      return undefined;
    }
    return findMessageById(messages, message.parentMessageId)?.isCreatedByUser === true;
  }, [getMessages, message.isCreatedByUser, message.parentMessageId]);

  /** Resolved only if the row has nothing to replay, because the artifact check
   *  inside parses markdown. */
  const getHasEditablePart = useCallback(() => hasEditablePart(message), [message]);

  /** A pending queued follow-up is a generation about to start: no rerun or
   *  continuation may race it, exactly as while a run is submitting. */
  const generationCapabilities = useGenerationsByLatest({
    isEditing,
    isSubmitting: isSubmitting || hasPendingTurn,
    error: message.error,
    endpoint: endpoint ?? '',
    messageId: message.messageId,
    searchResult: message.searchResult,
    finish_reason: message.finish_reason,
    isCreatedByUser: message.isCreatedByUser,
    getHasEditablePart,
    parentIsUserMessage,
    isUserInitiatedCompaction: isUserInitiatedCompaction(message),
    latestMessageId: latestMessageId,
  });

  const {
    hideEditButton,
    regenerateEnabled,
    continueSupported,
    forkingSupported,
    isActiveStreamingMessage,
    isEditableEndpoint,
  } = generationCapabilities;

  const canCopy = useMemo(
    () => !isActiveStreamingMessage && getCanCopy(),
    [isActiveStreamingMessage, getCanCopy],
  );

  const startFork = useCallback(
    (option: string) => {
      if (forkConversation == null || !conversation?.conversationId) {
        return;
      }
      showToast({ message: localize('com_ui_fork_processing'), status: 'info' });
      const request: TForkConvoRequest = {
        messageId: message.messageId,
        conversationId: conversation.conversationId,
        option,
        splitAtTarget,
        latestMessageId: getLatestMessageId?.() ?? latestMessageId,
      };
      forkConversation(request, {
        onSuccess: () => showToast({ message: localize('com_ui_fork_success'), status: 'success' }),
        onError: (error) =>
          showToast({
            message: isRateLimited(error)
              ? localize('com_ui_fork_error_rate_limit')
              : localize('com_ui_fork_error'),
            status: 'error',
          }),
      });
    },
    [
      conversation?.conversationId,
      forkConversation,
      getLatestMessageId,
      latestMessageId,
      localize,
      message.messageId,
      showToast,
      splitAtTarget,
    ],
  );

  const handleFeedbackDialogSave = () => {
    if (!handleFeedback) {
      return;
    }
    handleFeedback({
      feedback: {
        rating: message.feedback?.rating ?? 'thumbsDown',
        tag: message.feedback?.tag,
        text: feedbackText,
      },
    });
    setOpenFeedbackDialog(false);
  };

  const handleFeedbackDialogClear = () => {
    if (!handleFeedback) {
      return;
    }
    if (message.feedback?.rating) {
      handleFeedback({
        feedback: {
          rating: message.feedback.rating,
          tag: message.feedback.tag,
        },
      });
    } else {
      handleFeedback({ feedback: undefined });
    }
    setFeedbackText('');
    setOpenFeedbackDialog(false);
  };

  const { isCreatedByUser, error } = message;
  const isSubagentThreadReadOnly = conversation?.subagentThread != null;

  const moreMenuItems = useMemo<MenuItemProps[]>(() => {
    const items: MenuItemProps[] = [];

    // Regenerate
    if (!isSubagentThreadReadOnly && regenerateEnabled) {
      items.push({
        id: 'regenerate-generation-button',
        dataTestId: 'regenerate-generation-button',
        label: localize('com_ui_regenerate'),
        title: localize('com_ui_regenerate'),
        icon: <RegenerateIcon size="19" />,
        onClick: regenerate,
      });
    }

    // Continue
    if (!isSubagentThreadReadOnly && continueSupported) {
      items.push({
        id: 'continue-generation-button',
        dataTestId: 'continue-generation-button',
        label: localize('com_ui_continue'),
        title: localize('com_ui_continue'),
        icon: <ContinueIcon className="size-4.75" />,
        onClick: (e) => e && handleContinue(e as unknown as React.MouseEvent<HTMLButtonElement>),
      });
    }

    // Fork
    if (!error && !isActiveStreamingMessage && forkingSupported && forkConversation != null) {
      items.push({
        id: 'fork-message-button',
        dataTestId: 'fork-message-button',
        label: localize('com_ui_fork') || 'Fork',
        title: localize('com_ui_fork') || 'Fork',
        icon: <GitFork className="size-4" />,
        onClick: () => startFork(forkSetting),
        subItems: [
          {
            id: 'fork-visible',
            label: localize('com_ui_fork_visible'),
            title: localize('com_ui_fork_visible'),
            icon: <GitCommit className="size-4 rotate-90" />,
            onClick: () => startFork(ForkOptions.DIRECT_PATH),
          },
          {
            id: 'fork-branches',
            label: localize('com_ui_fork_branches'),
            title: localize('com_ui_fork_branches'),
            icon: <GitBranchPlus className="size-4 rotate-180" />,
            onClick: () => startFork(ForkOptions.INCLUDE_BRANCHES),
          },
          {
            id: 'fork-all-target',
            label: `${localize('com_ui_fork_all_target')} (${localize('com_endpoint_default')})`,
            title: `${localize('com_ui_fork_all_target')} (${localize('com_endpoint_default')})`,
            icon: <ListTree className="size-4" />,
            onClick: () => startFork(ForkOptions.TARGET_LEVEL),
          },
        ],
      });
    }

    // Feedback
    if (!error && !isActiveStreamingMessage && !isCreatedByUser && handleFeedback != null) {
      if (items.length > 0) {
        items.push({ separate: true });
      }

      const isThumbsUp = message.feedback?.rating === 'thumbsUp';
      const isThumbsDown = message.feedback?.rating === 'thumbsDown';

      const positiveTags = getTagsForRating('thumbsUp');
      const negativeTags = getTagsForRating('thumbsDown');

      const positiveSubItems: MenuItemProps[] = [
        {
          id: 'thumbs-up-quick',
          label: `${localize('com_ui_feedback_positive')} 👍`,
          title: localize('com_ui_feedback_positive'),
          onClick: () => {
            if (isThumbsUp && !message.feedback?.tag) {
              handleFeedback({ feedback: undefined });
            } else {
              handleFeedback({ feedback: { rating: 'thumbsUp', tag: undefined } });
            }
          },
        },
        ...positiveTags.map((tag) => ({
          id: `thumbs-up-tag-${tag.key}`,
          label: localize(tag.label as Parameters<typeof localize>[0]),
          title: localize(tag.label as Parameters<typeof localize>[0]),
          ariaChecked: isThumbsUp && message.feedback?.tag?.key === tag.key,
          ariaRole: 'menuitemcheckbox' as const,
          onClick: () => {
            handleFeedback({
              feedback: {
                rating: 'thumbsUp',
                tag,
              },
            });
          },
        })),
        {
          id: 'thumbs-up-more-info',
          label: `${localize('com_ui_feedback_more_information')}...`,
          title: localize('com_ui_feedback_more_information'),
          onClick: () => {
            setFeedbackText(message.feedback?.text ?? '');
            setOpenFeedbackDialog(true);
          },
        },
      ];

      const negativeSubItems: MenuItemProps[] = [
        {
          id: 'thumbs-down-quick',
          label: `${localize('com_ui_feedback_negative')} 👎`,
          title: localize('com_ui_feedback_negative'),
          onClick: () => {
            if (isThumbsDown && !message.feedback?.tag) {
              handleFeedback({ feedback: undefined });
            } else {
              handleFeedback({ feedback: { rating: 'thumbsDown', tag: undefined } });
            }
          },
        },
        ...negativeTags.map((tag) => ({
          id: `thumbs-down-tag-${tag.key}`,
          label: localize(tag.label as Parameters<typeof localize>[0]),
          title: localize(tag.label as Parameters<typeof localize>[0]),
          ariaChecked: isThumbsDown && message.feedback?.tag?.key === tag.key,
          ariaRole: 'menuitemcheckbox' as const,
          onClick: () => {
            handleFeedback({
              feedback: {
                rating: 'thumbsDown',
                tag,
              },
            });
          },
        })),
        {
          id: 'thumbs-down-more-info',
          label: `${localize('com_ui_feedback_more_information')}...`,
          title: localize('com_ui_feedback_more_information'),
          onClick: () => {
            setFeedbackText(message.feedback?.text ?? '');
            setOpenFeedbackDialog(true);
          },
        },
      ];

      items.push({
        id: 'feedback-thumbs-up',
        dataTestId: 'feedback-thumbs-up',
        label: localize('com_ui_feedback_positive'),
        title: localize('com_ui_feedback_positive'),
        ariaLabel: localize('com_ui_feedback_positive'),
        icon: <ThumbUpIcon size="1.1875rem" />,
        ariaChecked: isThumbsUp,
        ariaRole: 'menuitemcheckbox',
        subItems: positiveSubItems,
      });

      items.push({
        id: 'feedback-thumbs-down',
        dataTestId: 'feedback-thumbs-down',
        label: localize('com_ui_feedback_negative'),
        title: localize('com_ui_feedback_negative'),
        ariaLabel: localize('com_ui_feedback_negative'),
        icon: <ThumbDownIcon size="1.1875rem" />,
        ariaChecked: isThumbsDown,
        ariaRole: 'menuitemcheckbox',
        subItems: negativeSubItems,
      });
    }

    return items;
  }, [
    isSubagentThreadReadOnly,
    regenerateEnabled,
    localize,
    regenerate,
    continueSupported,
    handleContinue,
    error,
    isActiveStreamingMessage,
    forkingSupported,
    forkConversation,
    startFork,
    forkSetting,
    isCreatedByUser,
    handleFeedback,
    message.feedback,
  ]);

  if (!conversation) {
    return null;
  }

  const onEdit = () => {
    if (isEditing) {
      return enterEdit(true);
    }
    enterEdit();
  };

  const handleCopy = () => copyToClipboard(setIsCopied);
  const speechText = getSpeechText(message);

  return (
    <div className="group touch:gap-1.5 visible flex justify-center gap-0.5 self-end focus-within:outline-hidden lg:justify-start">
      {/* Text to Speech */}
      {!error && !isActiveStreamingMessage && speechText.length > 0 && (
        <MessageAudioSlot
          index={index}
          isLast={isLast}
          messageId={message.messageId}
          content={speechText}
          renderButton={(props) => (
            <HoverButton
              onClick={props.onClick}
              title={props.title}
              icon={props.icon}
              isActive={props.isActive}
              isLast={isLast}
              dataTestId={isLast && !isCreatedByUser ? 'read-aloud-button' : undefined}
            />
          )}
        />
      )}

      {/* Copy Button */}
      {!isActiveStreamingMessage && (
        <HoverButton
          onClick={handleCopy}
          title={
            isCopied ? localize('com_ui_copied_to_clipboard') : localize('com_ui_copy_to_clipboard')
          }
          icon={<MorphIcon icon={isCopied ? Check : Copy} size="1.1875rem" />}
          isLast={isLast}
          disabled={!canCopy}
          reveal={!isLast || (isSubmitting && isCreatedByUser)}
          dataTestId={!isCreatedByUser ? 'copy-response-button' : undefined}
        />
      )}

      {/* Edit Button */}
      {!isSubagentThreadReadOnly && isEditableEndpoint && !hideEditButton && (
        <HoverButton
          id={`edit-${message.messageId}`}
          onClick={onEdit}
          title={localize('com_ui_edit')}
          icon={<EditIcon size="19" />}
          isActive={isEditing}
          isLast={isLast}
        />
      )}

      {/* More Options Dropdown Menu */}
      {moreMenuItems.length > 0 && (
        <DropdownPopup
          portal={true}
          menuId={moreMenuId}
          focusLoop={true}
          unmountOnHide={false}
          isOpen={isMoreOpen}
          setIsOpen={setIsMoreOpen}
          items={moreMenuItems}
          trigger={
            <TooltipAnchor
              description={localize('com_ui_more_options')}
              render={
                <Ariakit.MenuButton
                  id={`more-menu-${message.messageId}`}
                  data-testid="message-more-menu-button"
                  aria-label={localize('com_ui_more_options')}
                  aria-expanded={isMoreOpen}
                  render={
                    <Button
                      variant={!isLast ? 'message-hover-reveal' : 'message-hover'}
                      size="icon"
                      data-hover-active={isMoreOpen || undefined}
                    >
                      <Ellipsis className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
              }
            />
          }
        />
      )}

      {/* Feedback Text Modal */}
      {openFeedbackDialog && (
        <OGDialog open={openFeedbackDialog} onOpenChange={setOpenFeedbackDialog}>
          <OGDialogContent className="w-11/12 max-w-lg">
            <OGDialogTitle className="text-lg leading-6 font-semibold">
              {localize('com_ui_feedback_more_information')}
            </OGDialogTitle>
            <Textarea
              variant="note"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              placeholder={localize('com_ui_feedback_placeholder')}
              maxLength={500}
            />
            <div className="mt-4 flex items-end justify-end gap-2">
              <Button variant="destructive" onClick={handleFeedbackDialogClear}>
                {localize('com_ui_delete')}
              </Button>
              <Button
                variant="submit"
                onClick={handleFeedbackDialogSave}
                disabled={!feedbackText.trim()}
              >
                {localize('com_ui_save')}
              </Button>
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
    </div>
  );
};

const MemoHoverButtons: NamedExoticComponent<THoverButtons> = memo(HoverButtons);

export default MemoHoverButtons;
