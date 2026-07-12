// AlertWrapper: manages the visibility of transient notifications.
// Fades out automatically after 5 seconds or when the user clicks anywhere.
// Uses Mantine's Transition for the fade effect.

import { useEffect, useState } from 'react';
import { Transition } from '@mantine/core';

export interface AlertWrapperProps {
  readonly children: React.ReactNode;
  readonly visible: boolean;
}

export function AlertWrapper({ children, visible }: AlertWrapperProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);

      const timer = setTimeout(() => setShow(false), 5000);

      const handleClick = () => setShow(false);
      window.addEventListener('click', handleClick);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleClick);
      };
    } else {
      setShow(false);
    }
  }, [visible]);

  return (
    <Transition mounted={show} transition="fade" duration={200}>
      {(styles) => <div style={styles}>{children}</div>}
    </Transition>
  );
}
