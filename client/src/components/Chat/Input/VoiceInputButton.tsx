import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn, disabledFillClasses } from '@librechat/client';
import { useLocalize } from '~/hooks';

export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

// Window typing for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = '',
}: VoiceInputButtonProps) {
  const localize = useLocalize();
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
      }
    }
  }, []);

  const toggleListening = () => {
    if (disabled) return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore stop error */
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = (finalTranscript || interimTranscript).trim();
        if (text) {
          onTranscript(text);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        aria-label={localize('com_ui_voice_dictation_unavailable')}
        title={localize('com_ui_voice_dictation_unavailable')}
        className={cn(
          'text-text-tertiary inline-flex size-9 cursor-not-allowed items-center justify-center rounded-full disabled:pointer-events-none',
          disabledFillClasses,
          className,
        )}
      >
        <Mic className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={
        isListening
          ? localize('com_ui_voice_dictation_stop')
          : localize('com_ui_voice_dictation_start')
      }
      disabled={disabled}
      onClick={toggleListening}
      className={cn(
        'relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition',
        isListening
          ? 'bg-status-error-subtle text-status-error border-status-error-border animate-pulse border'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary',
        disabled && 'disabled:pointer-events-none',
        disabled && disabledFillClasses,
        className,
      )}
    >
      {isListening ? (
        <>
          <span className="bg-status-error-strong absolute top-1.5 right-1.5 size-2 animate-ping rounded-full" />
          <MicOff className="size-4" aria-hidden="true" />
        </>
      ) : (
        <Mic className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

export default VoiceInputButton;
