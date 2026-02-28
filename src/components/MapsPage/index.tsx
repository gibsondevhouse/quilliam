"use client";

import { useParams } from "next/navigation";
import { NewMapForm } from "./NewMapForm";
import { MapCanvas } from "./MapCanvas";
import { useMapData } from "./hooks/useMapData";

export function MapsPage() {
  const params = useParams<{ libraryId: string }>();
  const universeId = params.libraryId;

  const {
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
    handleCreateMap,
    handleFileChange,
    addPin,
    setAddPin,
    addPinEntryId,
    setAddPinEntryId,
    addPinIcon,
    setAddPinIcon,
    handleMapClick,
    handleConfirmPin,
    handlePinClick,
  } = useMapData({ universeId });

  if (loading) {
    return <div className="library-page"><p className="library-loading">Loading maps…</p></div>;
  }

  const selectedMap = maps.find((m) => m.id === selectedMapId);

  return (
    <div className="library-page maps-page">
      <div className="library-page-header">
        <h2>Maps</h2>
        <button className="library-page-action" onClick={() => setShowNewMapForm((v) => !v)}>
          + New Map
        </button>
      </div>

      {showNewMapForm && (
        <NewMapForm
          newMapName={newMapName}
          setNewMapName={setNewMapName}
          newMapImageUri={newMapImageUri}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onSubmit={handleCreateMap}
          onCancel={() => {
            setShowNewMapForm(false);
            setNewMapName("");
            setNewMapImageUri("");
          }}
        />
      )}

      <div className="maps-layout">
        <aside className="maps-sidebar">
          {maps.length === 0 ? (
            <p className="library-page-empty">No maps yet.</p>
          ) : (
            <ul className="library-item-list">
              {maps.map((m) => (
                <li key={m.id} className="library-item-row">
                  <button
                    className={`library-item-btn ${selectedMapId === m.id ? "active" : ""}`}
                    onClick={() => setSelectedMapId(m.id)}
                  >
                    <span className="library-item-icon">🗺</span>
                    <span className="library-item-title">{m.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="maps-canvas-wrap">
          {!selectedMap ? (
            <div className="library-page-empty">
              <p>Select or create a map to get started.</p>
            </div>
          ) : (
            <MapCanvas
              mapMedia={mapMedia}
              pins={pins}
              addPin={addPin}
              setAddPin={setAddPin}
              addPinEntryId={addPinEntryId}
              setAddPinEntryId={setAddPinEntryId}
              addPinIcon={addPinIcon}
              setAddPinIcon={setAddPinIcon}
              allEntries={allEntries}
              onMapClick={handleMapClick}
              onPinClick={handlePinClick}
              onConfirmPin={handleConfirmPin}
            />
          )}
        </div>
      </div>
    </div>
  );
}
