import { useId } from 'react';
import { Dropdown } from '@librechat/client';
import { ArrowDownWideNarrow } from 'lucide-react';
import type { LibrarySortOption } from './types';
import type { TranslationKeys } from '~/hooks';
import { useLocalize } from '~/hooks';

export const SORT_OPTIONS: Array<{ value: LibrarySortOption; labelKey: TranslationKeys }> = [
  { value: 'newest', labelKey: 'com_ui_sort_newest' },
  { value: 'oldest', labelKey: 'com_ui_sort_oldest' },
  { value: 'name_asc', labelKey: 'com_ui_sort_a_z' },
  { value: 'name_desc', labelKey: 'com_ui_sort_z_a' },
];

export const DEFAULT_SORT_OPTION: LibrarySortOption = 'newest';

interface LibrarySortDropdownProps {
  value: LibrarySortOption;
  onChange: (value: LibrarySortOption) => void;
}

export default function LibrarySortDropdown({ value, onChange }: LibrarySortDropdownProps) {
  const localize = useLocalize();
  const labelId = useId();

  const options = SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: localize(option.labelKey),
  }));

  return (
    <span className="flex shrink-0 items-center">
      <span id={labelId} className="sr-only">
        {localize('com_ui_sort')}
      </span>
      <Dropdown
        value={value}
        onChange={(v) => onChange(v as LibrarySortOption)}
        options={options}
        sizeClasses="w-36"
        icon={<ArrowDownWideNarrow className="size-3.5 shrink-0" aria-hidden="true" />}
        shape="default"
        variant="compact"
        triggerClassName="w-36"
        testId="library-sort-dropdown"
        aria-labelledby={labelId}
      />
    </span>
  );
}
