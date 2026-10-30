import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Unavailable } from './Unavailable';
import { PanoramaRuntime } from '../runtime/PanoramaRuntime';
import { Scene3dRuntime } from '../runtime/Scene3dRuntime';
import { useWebXr } from '../runtime/useWebXr';

type Snapshot = {
  venue: { id: string; title: string; primaryTrackId: string | null };
  tracks: {
    id: string;
    title: string;
    trackKind: 'panorama' | 'scene3d';
    isPrimary: boolean;
    entryAssetId: string | null;
  }[];
  assets: { id: string; url: string; mime: string; kind: string }[];
};

type PublicPayload = {
  publicId: string;
  version: number;
  snapshot: Snapshot;
};

export function VenuePage() {
  const { publicId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const xrOk = useWebXr();
  const [data, setData] = useState<PublicPayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/public/venues/${publicId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const json = (await res.json()) as PublicPayload;
        if (!cancelled) {
          setData(json);
          setUnavailable(false);
        }
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const tracks = data?.snapshot.tracks ?? [];
  const trackParam = params.get('track');
  const activeTrack = useMemo(() => {
    if (!tracks.length) return null;
    return (
      tracks.find((t) => t.id === trackParam) ??
      tracks.find((t) => t.isPrimary) ??
      tracks.find((t) => t.id === data?.snapshot.venue.primaryTrackId) ??
      tracks[0]
    );
  }, [tracks, trackParam, data]);

  useEffect(() => {
    if (!activeTrack) return;
    if (trackParam === activeTrack.id) return;
    const next = new URLSearchParams(params);
    next.set('track', activeTrack.id);
    setParams(next, { replace: true });
  }, [activeTrack, trackParam, params, setParams]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#ccc', background: '#111', minHeight: '100vh' }}>
        加载中…
      </div>
    );
  }
  if (unavailable || !data || !activeTrack) return <Unavailable />;

  const entry = data.snapshot.assets.find((a) => a.id === activeTrack.entryAssetId);
  const hybrid = tracks.length > 1;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <header
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          zIndex: 2,
        }}
      >
        <strong style={{ flex: 1 }}>{data.snapshot.venue.title}</strong>
        {hybrid && (
          <select
            value={activeTrack.id}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set('track', e.target.value);
              setParams(next);
            }}
            style={{ maxWidth: 180 }}
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.trackKind})
              </option>
            ))}
          </select>
        )}
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTrack.trackKind === 'panorama' ? (
          entry?.url ? (
            <PanoramaRuntime imageUrl={entry.url} />
          ) : (
            <div style={{ color: '#ddd', padding: 24 }}>全景轨缺少入口资产</div>
          )
        ) : (
          <Scene3dRuntime entryUrl={entry?.url} enableXr={xrOk} />
        )}
      </div>
    </div>
  );
}
