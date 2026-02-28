"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { makeId } from "@/lib/domain/idUtils";
import { pathForEntryType } from "@/lib/domain/entryUtils";
import type { Entry, EntryType, Map as WorldMap, MapPin, Media } from "@/lib/types";
import { useStore } from "@/lib/context/useStore";
import { PIN_ENTRY_TYPES, type PinWithEntry, type AddPinState } from "../mapTypes";

interface UseMapDataParams {
  universeId: string;
}

interface UseMapDataReturn {
  maps: WorldMap[];
  selectedMapId: string | null;
  setSelectedMapId: (id: string | null) => void;
  mapMedia: Media | null;
  pins: PinWithEntry[];
  loading: boolean;
  allEntries: Entry[];
  // new-map form
  showNewMapForm: boolean;
  setShowNewMapForm: Dispatch<SetStateAction<boolean>>;
  newMapName: string;
  setNewMapName: (v: string) => void;
  newMapImageUri: string;
  setNewMapImageUri: (v: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleCreateMap: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // add-pin
  addPin: AddPinState | null;
  setAddPin: (v: AddPinState | null) => void;
  addPinEntryId: string;
  setAddPinEntryId: (v: string) => void;
  addPinIcon: string;
  setAddPinIcon: (v: string) => void;
  handleMapClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleConfirmPin: () => void;
  handlePinClick: (e: React.MouseEvent, row: PinWithEntry) => void;
}

export function useMapData({ universeId }: UseMapDataParams): UseMapDataReturn {
  const router = useRouter();
  const store = useStore();
  const [maps, setMaps] = useState<WorldMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapMedia, setMapMedia] = useState<Media | null>(null);
  const [pins, setPins] = useState<PinWithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const loadedRef = useRef(false);

  // new-map form
  const [showNewMapForm, setShowNewMapForm] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [newMapImageUri, setNewMapImageUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // add-pin overlay
  const [addPin, setAddPin] = useState<AddPinState | null>(null);
  const [addPinEntryId, setAddPinEntryId] = useState("");
  const [addPinIcon, setAddPinIcon] = useState("📍");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const mapList = await store.listMapsByUniverse(universeId);
      setMaps(mapList);
      if (mapList.length > 0) setSelectedMapId(mapList[0].id);
      const entryTypes: EntryType[] = PIN_ENTRY_TYPES;
      const entryGroups = await Promise.all(entryTypes.map((t) => store.queryEntriesByType(t)));
      setAllEntries(entryGroups.flat());
      setLoading(false);
    })();
  }, [store, universeId]);

  useEffect(() => {
    if (!selectedMapId) return;
    void (async () => {
      const pinList = await store.listMapPinsByMap(selectedMapId);
      const rows = pinList.map((pin) => {
        const entry = allEntries.find((e) => e.id === pin.entryId);
        return { pin, entry };
      });
      setPins(rows);
      const mapDef = maps.find((m) => m.id === selectedMapId);
      if (mapDef?.mediaId) {
        const mediaList = await store.listMediaByUniverse(universeId);
        const media = mediaList.find((m) => m.id === mapDef.mediaId) ?? null;
        setMapMedia(media);
      } else {
        setMapMedia(null);
      }
    })();
  }, [selectedMapId, store, maps, allEntries, universeId]);

  const handleCreateMap = useCallback(async () => {
    if (!newMapName.trim()) return;
    const now = Date.now();

    let mediaId = "";
    if (newMapImageUri) {
      const media: Media = {
        id: makeId("med"),
        universeId,
        mediaType: "image",
        storageUri: newMapImageUri,
        metadata: { name: newMapName.trim() },
        createdAt: now,
        updatedAt: now,
      };
      await store.putMedia(media);
      mediaId = media.id;
    }

    const worldMap: WorldMap = {
      id: makeId("map"),
      universeId,
      mediaId: mediaId || makeId("med_placeholder"),
      createdAt: now,
      updatedAt: now,
    };
    await store.putMap(worldMap);
    setMaps((prev) => [...prev, worldMap]);
    setSelectedMapId(worldMap.id);
    if (newMapImageUri) {
      setMapMedia({
        id: worldMap.mediaId,
        universeId,
        mediaType: "image",
        storageUri: newMapImageUri,
        metadata: { name: newMapName.trim() },
        createdAt: now,
        updatedAt: now,
      });
    }
    setPins([]);
    setShowNewMapForm(false);
    setNewMapName("");
    setNewMapImageUri("");
  }, [newMapName, newMapImageUri, store, universeId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setNewMapImageUri(ev.target?.result as string); };
    reader.readAsDataURL(file);
  }, []);

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setAddPin({ x, y });
    setAddPinEntryId("");
  }, []);

  const handleConfirmPin = useCallback(async () => {
    if (!addPin || !addPinEntryId.trim() || !selectedMapId) return;
    const now = Date.now();
    const pin: MapPin = {
      id: makeId("pin"),
      mapId: selectedMapId,
      entryId: addPinEntryId.trim(),
      x: addPin.x,
      y: addPin.y,
      icon: addPinIcon,
      createdAt: now,
      updatedAt: now,
    };
    await store.putMapPin(pin);
    const entry = allEntries.find((e) => e.id === addPinEntryId.trim());
    setPins((prev) => [...prev, { pin, entry }]);
    setAddPin(null);
    setAddPinEntryId("");
  }, [addPin, addPinEntryId, addPinIcon, selectedMapId, store, allEntries]);

  const handlePinClick = useCallback(
    (e: React.MouseEvent, row: PinWithEntry) => {
      e.stopPropagation();
      if (!row.entry) return;
      const path = pathForEntryType(row.entry.entryType);
      router.push(`/library/${universeId}/${path}?highlight=${row.entry.id}`);
    },
    [router, universeId],
  );

  return {
    maps,
    selectedMapId,
    setSelectedMapId,
    mapMedia,
    pins,
    loading,
    allEntries,
    showNewMapForm,
    setShowNewMapForm,
    newMapName,
    setNewMapName,
    newMapImageUri,
    setNewMapImageUri,
    fileInputRef,
    handleCreateMap: () => { void handleCreateMap(); },
    handleFileChange,
    addPin,
    setAddPin,
    addPinEntryId,
    setAddPinEntryId,
    addPinIcon,
    setAddPinIcon,
    handleMapClick,
    handleConfirmPin: () => { void handleConfirmPin(); },
    handlePinClick,
  };
}
