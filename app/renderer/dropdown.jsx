import * as Select from '@radix-ui/react-select';
import { useCallback, useState } from 'react';

export function Dropdown({ options, className, label, name, value, defaultValue, onValueChange, disabled, required }) {
  const [dialog, setDialog] = useState(null);
  // A native modal makes portals outside its subtree inert.
  const findDialog = useCallback(trigger => setDialog(trigger?.closest('dialog') ?? null), []);

  return (
    <Select.Root {...{ name, value, defaultValue, onValueChange, disabled, required }}>
      <Select.Trigger ref={findDialog} className={className ? 'dropdown-trigger ' + className : 'dropdown-trigger'} aria-label={label}>
        <span className="dropdown-value"><Select.Value /></span>
        <Select.Icon asChild><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></Select.Icon>
      </Select.Trigger>
      <Select.Portal container={dialog ?? undefined}>
        <Select.Content className="dropdown-content" position="popper" align="start" sideOffset={6} collisionPadding={12}>
          <Select.Viewport className="dropdown-options">
            {options.map(([option, text]) => (
              <Select.Item key={option} value={option} className="dropdown-option">
                <Select.ItemText>{text}</Select.ItemText>
                <Select.ItemIndicator asChild><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8 3 3 6-6" /></svg></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
