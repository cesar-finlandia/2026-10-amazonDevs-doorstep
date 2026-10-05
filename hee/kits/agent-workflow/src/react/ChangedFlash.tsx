// Requirement IDs: HEE-KIT-02
import { useEffect, useState } from "react";
import type { DomainStore } from "../store/domainStore.js";

export interface ChangedFlashProps {
  store: DomainStore<unknown>;
  entityId: string;
  children: React.ReactNode;
}

export function ChangedFlash({ store, entityId, children }: ChangedFlashProps): React.JSX.Element {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = store.subscribe((e) => {
      if (e.entityIds.includes(entityId)) {
        setFlash(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setFlash(false), 900);
      }
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [store, entityId]);
  return <div className={flash ? "changed-flash" : undefined}>{children}</div>;
}
