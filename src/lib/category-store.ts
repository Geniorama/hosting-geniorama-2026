"use client";

import { useSyncExternalStore } from "react";
import type { PlanCategory } from "./plans";

let category: PlanCategory = "web";
const listeners = new Set<() => void>();

export const categoryStore = {
  get: () => category,
  set: (v: PlanCategory) => {
    category = v;
    listeners.forEach((l) => l());
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useCategory() {
  return useSyncExternalStore(
    categoryStore.subscribe,
    categoryStore.get,
    () => "web" as PlanCategory,
  );
}
