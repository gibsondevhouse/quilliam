"use client";

/**
 * LoRA selection and lifecycle hook.
 * Persists active LoRA id and user-created LoRAs to localStorage.
 */

import { useCallback, useState } from "react";
import {
  DEFAULT_LORA_ID,
  loadLoRAs,
  saveUserLoRAs,
  type LoRA,
} from "./loras";

const ACTIVE_LORA_KEY = "quilliam_active_lora_id";

function readActiveLoRAId(): string {
  if (typeof window === "undefined") return DEFAULT_LORA_ID;
  return localStorage.getItem(ACTIVE_LORA_KEY) ?? DEFAULT_LORA_ID;
}

export interface UseLoRAsReturn {
  loras: LoRA[];
  activeLoRAId: string;
  activeLoRA: LoRA;
  setActiveLoRA: (id: string) => void;
  createLoRA: (draft: Omit<LoRA, "id" | "createdAt" | "updatedAt">) => LoRA;
  deleteLoRA: (id: string) => void;
}

export function useLoRAs(): UseLoRAsReturn {
  const [loras, setLoRAs] = useState<LoRA[]>(() => loadLoRAs());
  const [activeLoRAId, setActiveLoRAId] = useState<string>(() => readActiveLoRAId());

  const activeLoRA = loras.find((l) => l.id === activeLoRAId) ?? loras[0];

  const setActiveLoRA = useCallback((id: string) => {
    setActiveLoRAId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_LORA_KEY, id);
    }
  }, []);

  const createLoRA = useCallback(
    (draft: Omit<LoRA, "id" | "createdAt" | "updatedAt">): LoRA => {
      const now = Date.now();
      const newLoRA: LoRA = {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      setLoRAs((prev) => {
        const next = [...prev, newLoRA];
        const userOnly = next.filter((l) => !l.isDefault);
        saveUserLoRAs(userOnly);
        return next;
      });
      return newLoRA;
    },
    [],
  );

  const deleteLoRA = useCallback((id: string) => {
    setLoRAs((prev) => {
      const target = prev.find((l) => l.id === id);
      if (!target || target.isDefault) return prev; // cannot delete defaults
      const next = prev.filter((l) => l.id !== id);
      const userOnly = next.filter((l) => !l.isDefault);
      saveUserLoRAs(userOnly);
      return next;
    });
    setActiveLoRAId((prev) => (prev === id ? DEFAULT_LORA_ID : prev));
  }, []);

  return { loras, activeLoRAId, activeLoRA, setActiveLoRA, createLoRA, deleteLoRA };
}
