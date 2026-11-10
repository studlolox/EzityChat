import { memo, useMemo, useRef, useState, useEffect } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import type { MessageIconProps } from '@librechat/chat/react';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useShareContext } from '~/Providers/ShareContext';
import { useGetEndpointsQuery } from '~/data-provider';
import Icon from '~/components/Endpoints/Icon';
import { isImageURL } from '~/utils/icons';
import { getIconEndpoint } from '~/utils';

export type EzityAnimationState =
  | 'idle'
  | 'thinking'
  | 'tool-use'
  | 'done'
  | 'cancelled'
  | 'failed';

const EZITY_ANIMATIONS: Record<EzityAnimationState, string> = {
  idle: '/assets/ezity-animations/idle.svg',
  thinking: '/assets/ezity-animations/thinking.svg',
  'tool-use': '/assets/ezity-animations/tool-use.svg',
  done: '/assets/ezity-animations/done.svg',
  cancelled: '/assets/ezity-animations/cancelled.svg',
  failed: '/assets/ezity-animations/failed.svg',
};

function isEzityAvatar(iconURL?: string | null, modelLabel?: string | null): boolean {
  if (iconURL && (iconURL.includes('ezity') || iconURL.includes('idle.svg'))) {
    return true;
  }
  if (
    modelLabel &&
    (modelLabel.includes('Ezity') || modelLabel === 'Ezity AI' || modelLabel === 'Ezity Coder')
  ) {
    return true;
  }
  return false;
}

/**
 * Compares only the fields MessageIcon actually renders.
 * `agent.id` / `assistant.id` are intentionally omitted because
 * this component renders display properties only, not identity-derived content.
 */
export function arePropsEqual(prev: MessageIconProps, next: MessageIconProps): boolean {
  const checks: [unknown, unknown][] = [
    [prev.iconData?.endpoint, next.iconData?.endpoint],
    [prev.iconData?.model, next.iconData?.model],
    [prev.iconData?.iconURL, next.iconData?.iconURL],
    [prev.iconData?.modelLabel, next.iconData?.modelLabel],
    [prev.iconData?.isCreatedByUser, next.iconData?.isCreatedByUser],
    [prev.iconData?.error, next.iconData?.error],
    [prev.iconData?.unfinished, next.iconData?.unfinished],
    [prev.iconData?.isSubmitting, next.iconData?.isSubmitting],
    [prev.iconData?.hasActiveTool, next.iconData?.hasActiveTool],
    [prev.agent?.name, next.agent?.name],
    [prev.agent?.avatar?.filepath, next.agent?.avatar?.filepath],
    [prev.assistant?.name, next.assistant?.name],
    [prev.assistant?.metadata?.avatar, next.assistant?.metadata?.avatar],
  ];

  for (const [prevVal, nextVal] of checks) {
    if (prevVal !== nextVal) {
      return false;
    }
  }
  return true;
}

const MessageIcon = memo(({ iconData, assistant, agent }: MessageIconProps) => {
  const { isSharedConvo } = useShareContext();
  const { data: endpointsConfig } = useGetEndpointsQuery({ enabled: isSharedConvo !== true });

  const agentName = agent?.name ?? '';
  const agentAvatar = agent?.avatar?.filepath ?? '';
  const assistantName = assistant?.name ?? '';
  const assistantAvatar = assistant?.metadata?.avatar ?? '';
  let avatarURL = '';
  if (assistant) {
    avatarURL = assistantAvatar;
  } else if (agent) {
    avatarURL = agentAvatar;
  }

  const iconURL = iconData?.iconURL;
  const isEzity = !iconData?.isCreatedByUser && isEzityAvatar(iconURL, iconData?.modelLabel);

  const [isDonePlaying, setIsDonePlaying] = useState(false);
  const prevSubmittingRef = useRef(iconData?.isSubmitting);

  useEffect(() => {
    if (!isEzity) {
      return;
    }
    if (
      prevSubmittingRef.current &&
      !iconData?.isSubmitting &&
      !iconData?.error &&
      !iconData?.unfinished
    ) {
      setIsDonePlaying(true);
      const timer = setTimeout(() => {
        setIsDonePlaying(false);
      }, 700);
      return () => clearTimeout(timer);
    }
    prevSubmittingRef.current = iconData?.isSubmitting;
  }, [isEzity, iconData?.isSubmitting, iconData?.error, iconData?.unfinished]);

  const resolvedEzityURL = useMemo(() => {
    if (!isEzity) {
      return iconURL;
    }
    if (iconData?.error) {
      return EZITY_ANIMATIONS.failed;
    }
    if (iconData?.unfinished) {
      return EZITY_ANIMATIONS.cancelled;
    }
    if (iconData?.isSubmitting) {
      if (iconData?.hasActiveTool) {
        return EZITY_ANIMATIONS['tool-use'];
      }
      return EZITY_ANIMATIONS.thinking;
    }
    if (isDonePlaying) {
      return EZITY_ANIMATIONS.done;
    }
    return EZITY_ANIMATIONS.idle;
  }, [
    isEzity,
    iconData?.error,
    iconData?.unfinished,
    iconData?.isSubmitting,
    iconData?.hasActiveTool,
    isDonePlaying,
    iconURL,
  ]);

  const effectiveIconURL = isEzity ? resolvedEzityURL : iconURL;

  const endpoint = useMemo(
    () =>
      getIconEndpoint({ endpointsConfig, iconURL: effectiveIconURL, endpoint: iconData?.endpoint }),
    [endpointsConfig, effectiveIconURL, iconData?.endpoint],
  );

  const endpointIconURL = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'iconURL'),
    [endpointsConfig, endpoint],
  );

  if (iconData?.isCreatedByUser !== true && isImageURL(effectiveIconURL)) {
    return (
      <ConvoIconURL
        iconURL={effectiveIconURL}
        modelLabel={iconData?.modelLabel}
        context="message"
        assistantAvatar={assistantAvatar}
        agentAvatar={agentAvatar}
        assistantName={assistantName}
        agentName={agentName}
      />
    );
  }

  return (
    <Icon
      isCreatedByUser={iconData?.isCreatedByUser ?? false}
      endpoint={endpoint}
      iconURL={avatarURL || endpointIconURL}
      endpointsConfig={endpointsConfig}
      model={iconData?.model}
      assistantName={assistantName}
      agentName={agentName}
      size={28.8}
    />
  );
}, arePropsEqual);

MessageIcon.displayName = 'MessageIcon';

export default MessageIcon;
