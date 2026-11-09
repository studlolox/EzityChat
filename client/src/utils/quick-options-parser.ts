/**
 * Ezity AI — Quick Options & Interactive Choices Parser
 * Detects and extracts interactive choices, suggestions,
 * and quick-reply options from assistant message text.
 */

export interface ParsedOption {
  id: string;
  label: string;
  value: string;
}

export interface ParsedQuestionWithOptions {
  question: string;
  options: ParsedOption[];
  isQuestion: boolean;
}

function cleanOptionText(text: string): { label: string; value: string } {
  let label = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
  label = label.replace(/[:;]+$/, '').trim();

  if (label.length > 50 && (label.includes(' - ') || label.includes(': '))) {
    const parts = label.split(/ - |: /);
    if (parts[0] && parts[0].length >= 3) {
      label = parts[0].trim();
    }
  }

  label = label.replace(/[:;]+$/, '').trim();

  const value = label
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

  return { label, value };
}

function isValidOptionLength(text: string): boolean {
  return text.length >= 2 && text.length <= 80;
}

/**
 * Extracts selectable options from assistant markdown text.
 * Returns null if no structured options are detected.
 */
export function extractMessageOptions(content: string): ParsedQuestionWithOptions | null {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();
  if (trimmed.length < 5) return null;

  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  let questionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.endsWith('?') ||
      /\b(which|choose|select|do you want|would you like|options|next steps|how would you like)\b/i.test(
        line,
      )
    ) {
      questionIndex = i;
    }
  }

  const candidateLines = questionIndex >= 0 ? lines.slice(questionIndex + 1) : lines;
  const questionText =
    questionIndex >= 0 ? lines[questionIndex].replace(/^[#*>\s-]+/, '').trim() : '';

  const options: ParsedOption[] = [];

  for (const line of candidateLines) {
    // Match numbered list: "1. Option", "1) Option"
    const numberedMatch = line.match(/^(\d+|[a-zA-Z])[.)]\s+(.+)$/);
    if (numberedMatch) {
      const rawText = numberedMatch[2].trim();
      const { label, value } = cleanOptionText(rawText);
      if (isValidOptionLength(value)) {
        options.push({
          id: `opt_${options.length + 1}`,
          label,
          value,
        });
      }
      continue;
    }

    // Match bullet points if preceded by a question
    if (questionIndex >= 0) {
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        const rawText = bulletMatch[1].trim();
        const { label, value } = cleanOptionText(rawText);
        if (isValidOptionLength(value)) {
          options.push({
            id: `opt_${options.length + 1}`,
            label,
            value,
          });
        }
        continue;
      }
    }
  }

  // Allow between 2 and 6 options
  if (options.length >= 2 && options.length <= 6) {
    return {
      question: questionText || 'Choose an option:',
      options,
      isQuestion: Boolean(questionText && questionText.includes('?')),
    };
  }

  return null;
}
