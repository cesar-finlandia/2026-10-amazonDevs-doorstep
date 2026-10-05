import type { DomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import { createDomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { WeekModel } from "src/domain/types.js";
import { storeActions } from "src/domain/actions.js";

/** createDomainStore({ initial, actions: storeActions, maxHistory: 200 }) */
export function createWeekStore(initial: WeekModel): DomainStore<WeekModel> {
  return createDomainStore({ initial, actions: storeActions, maxHistory: 200 });
}
