'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { useTheme } from 'next-themes';
import { t } from '@/core/copy';
import { formatMoney } from '@/core/money';

export interface NearBusiness {
  slug: string;
  name: string;
  category: string;
  rating: { avg: number; count: number };
  fromPriceMinor: number | null;
  location: { lat: number; lng: number } | null;
  distanceKm: number | null;
  logoUrl?: string | null;
}

// Esri's gray canvases: quiet basemaps that let the price pins carry the colour. No key needed; credit required.
const TILES = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
};
const ATTRIBUTION = 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

/** Price pins: opaque, readable, the selected one takes the brand gradient. */
function pin(label: string, selected: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<span class="styra-pin${selected ? ' is-selected' : ''}">${label}</span>`,
  });
}
const meIcon = L.divIcon({ className: '', iconSize: [0, 0], html: '<span class="styra-me"><i></i></span>' });

function Fly({ to, zoom }: { to: { lat: number; lng: number }; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([to.lat, to.lng], zoom ?? map.getZoom(), { duration: 0.8 });
  }, [map, to.lat, to.lng, zoom]);
  return null;
}

export function NearMap({
  center,
  me,
  items,
  selected,
  onSelect,
}: {
  center: { lat: number; lng: number };
  me: { lat: number; lng: number } | null;
  items: NearBusiness[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const focus = useMemo(() => items.find((b) => b.slug === selected)?.location ?? null, [items, selected]);
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} zoomControl={false} className="h-full w-full" attributionControl>
      <TileLayer key={resolvedTheme} url={resolvedTheme === 'light' ? TILES.light : TILES.dark} attribution={ATTRIBUTION} />
      <Fly to={center} zoom={13} />
      {focus && <Fly to={focus} />}
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} title={t('near.youAreHere')} />}
      {items.map((b) => (
        <Marker
          key={b.slug}
          position={[b.location!.lat, b.location!.lng]}
          icon={pin(b.fromPriceMinor != null ? formatMoney(BigInt(b.fromPriceMinor)) : b.name, b.slug === selected)}
          title={b.name}
          eventHandlers={{ click: () => onSelect(b.slug) }}
          zIndexOffset={b.slug === selected ? 1000 : 0}
        />
      ))}
    </MapContainer>
  );
}
