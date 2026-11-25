import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

export interface PlaceValue {
  address: string;
  lat?: number;
  lng?: number;
}

interface PlaceInstance {
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
}

interface AutocompleteSuggestionItem {
  placePrediction?: {
    placeId?: string;
    text: { text: string };
    toPlace: () => PlaceInstance;
  };
}

interface PlacesLibraryShape {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: {
      input: string;
      sessionToken: unknown;
    }) => Promise<{ suggestions?: AutocompleteSuggestionItem[] }>;
  };
}

interface MapPolyline {
  setOptions: (opts: { strokeColor: string; strokeWeight: number; strokeOpacity: number }) => void;
  setMap: (map: unknown | null) => void;
}

const POPULAR_HUBS: Array<PlaceValue> = [
  { address: 'Visakhapatnam International Airport (VTZ), Vizag', lat: 17.7212, lng: 83.2245 },
  { address: 'Visakhapatnam Railway Station, Dwaraka Nagar, Vizag', lat: 17.7222, lng: 83.2896 },
  { address: 'RK Beach & Kailasagiri, Visakhapatnam', lat: 17.7142, lng: 83.3237 },
  { address: 'Araku Valley Hill Station, Visakhapatnam District', lat: 18.3273, lng: 82.8775 },
  { address: 'Simhachalam Temple, Visakhapatnam', lat: 17.7664, lng: 83.2504 },
  { address: 'Vijayawada Kanaka Durga & City Centre, AP', lat: 16.5062, lng: 80.648 },
  { address: 'Tirupati Balaji & Renigunta Airport, AP', lat: 13.6288, lng: 79.4192 },
  { address: 'Rajiv Gandhi International Airport (HYD), Hyderabad', lat: 17.2403, lng: 78.4294 },
];

function checkQuotaError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('Quota') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export const MapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!MAPS_API_KEY) {
    return <>{children}</>;
  }
  return (
    <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
      {children}
    </APIProvider>
  );
};

interface PlaceAutocompleteInputProps {
  id?: string;
  label?: string;
  placeholder: string;
  value: string;
  onChange: (val: PlaceValue) => void;
  className?: string;
  iconType?: 'pickup' | 'drop';
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  className = '',
  iconType = 'pickup',
}) => {
  const placesLib = (MAPS_API_KEY ? useMapsLibrary('places') : null) as PlacesLibraryShape | null;
  const sessionTokenRef = useRef<unknown>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!placesLib || !focused || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value.trim(),
        sessionToken: sessionTokenRef.current,
      })
        .then((res: { suggestions?: AutocompleteSuggestionItem[] }) => {
          if (!cancelled) {
            setSuggestions(res.suggestions || []);
            setOpen(true);
          }
        })
        .catch((err: unknown) => {
          checkQuotaError(err);
          if (!cancelled) {
            setSuggestions([]);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, value, focused]);

  const handleSelectPrediction = async (suggestion: AutocompleteSuggestionItem) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const address =
        place.formattedAddress ||
        place.displayName ||
        suggestion.placePrediction.text.text;
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      onChange({ address, lat, lng });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setOpen(false);
      setFocused(false);
    } catch (err) {
      checkQuotaError(err);
      onChange({ address: suggestion.placePrediction.text.text });
      setOpen(false);
    }
  };

  const fallbackMatches = POPULAR_HUBS.filter(
    (h) => !value.trim() || h.address.toLowerCase().includes(value.trim().toLowerCase())
  ).slice(0, 5);

  const showFallbackHubs = focused && suggestions.length === 0 && fallbackMatches.length > 0;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-slate-400 pointer-events-none">
          {iconType === 'pickup' ? (
            <MapPin className="w-4 h-4 text-[#2563EB]" />
          ) : (
            <Navigation className="w-4 h-4 text-[#F59E0B]" />
          )}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onChange={(e) => {
            onChange({ address: e.target.value });
            setOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-[#102A43] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors"
        />
      </div>

      {open && (suggestions.length > 0 || showFallbackHubs) && (
        <ul className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
          {suggestions.length > 0
            ? suggestions.map((s, idx) => (
                <li key={s.placePrediction?.placeId || idx}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void handleSelectPrediction(s);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-sm text-[#102A43] hover:bg-[#F5F7FA] flex items-start gap-2.5 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{s.placePrediction?.text.text}</span>
                  </button>
                </li>
              ))
            : fallbackMatches.map((hub) => (
                <li key={hub.address}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(hub);
                      setOpen(false);
                      setFocused(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-sm text-[#102A43] hover:bg-[#F5F7FA] flex items-start gap-2.5 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{hub.address}</span>
                  </button>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
};

interface RouteOverlayProps {
  origin: PlaceValue;
  destination: PlaceValue;
  onRouteCalculated?: (info: { distanceKm: number; durationText: string }) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  onRouteCalculated,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<MapPolyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin.address || !destination.address) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const originParam =
      typeof origin.lat === 'number' && typeof origin.lng === 'number'
        ? { lat: origin.lat, lng: origin.lng }
        : origin.address;
    const destParam =
      typeof destination.lat === 'number' && typeof destination.lng === 'number'
        ? { lat: destination.lat, lng: destination.lng }
        : destination.address;

    let cancelled = false;
    const RouteClass = (routesLib as unknown as {
      Route: {
        computeRoutes: (req: unknown) => Promise<{
          routes?: Array<{
            distanceMeters?: number;
            durationMillis?: number;
            viewport?: unknown;
            createPolylines: () => MapPolyline[];
          }>;
        }>;
      };
    }).Route;

    RouteClass.computeRoutes({
      origin: originParam,
      destination: destParam,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        if (cancelled || !routes || routes.length === 0) return;
        const primaryRoute = routes[0];
        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#2563EB',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;
        if (primaryRoute.viewport) {
          (map as unknown as { fitBounds: (b: unknown) => void }).fitBounds(primaryRoute.viewport);
        }
        const distanceKm = Math.max(10, Math.round((primaryRoute.distanceMeters || 40000) / 1000));
        const mins = Math.max(15, Math.round((primaryRoute.durationMillis || 3600000) / 60000));
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        const durationText = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''} ${remMins} mins` : `${remMins} mins`;
        onRouteCalculated?.({ distanceKm, durationText });
      })
      .catch((err: unknown) => {
        checkQuotaError(err);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin.address, origin.lat, origin.lng, destination.address, destination.lat, destination.lng]);

  return null;
};

export const RoutePreviewMap: React.FC<{
  origin: PlaceValue;
  destination: PlaceValue;
  onRouteCalculated?: (info: { distanceKm: number; durationText: string }) => void;
}> = ({ origin, destination, onRouteCalculated }) => {
  const defaultCenter =
    typeof origin.lat === 'number' && typeof origin.lng === 'number'
      ? { lat: origin.lat, lng: origin.lng }
      : { lat: 12.9716, lng: 77.5946 };

  if (!MAPS_API_KEY) {
    return (
      <div className="w-full h-56 rounded-xl border border-slate-200 bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-6 h-6 text-[#2563EB] mb-2" />
        <p className="text-sm font-semibold text-[#102A43]">Route Map Preview</p>
        <p className="text-xs text-slate-500 mt-1">
          {origin.address || 'Pickup'} to {destination.address || 'Drop'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-60 rounded-xl overflow-hidden border border-slate-200">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={defaultCenter}
        defaultZoom={8}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        {typeof origin.lat === 'number' && typeof origin.lng === 'number' && (
          <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }} title="Pickup">
            <Pin background="#2563EB" borderColor="#102A43" glyphColor="#FFFFFF" />
          </AdvancedMarker>
        )}
        {typeof destination.lat === 'number' && typeof destination.lng === 'number' && (
          <AdvancedMarker position={{ lat: destination.lat, lng: destination.lng }} title="Destination">
            <Pin background="#F59E0B" borderColor="#102A43" glyphColor="#102A43" />
          </AdvancedMarker>
        )}
        <RouteOverlay
          origin={origin}
          destination={destination}
          onRouteCalculated={onRouteCalculated}
        />
      </GoogleMap>
    </div>
  );
};

export const DepotLocationMap: React.FC<{
  lat?: number;
  lng?: number;
  companyName?: string;
  address?: string;
}> = ({
  lat = 17.7289,
  lng = 83.3106,
  companyName = 'Vizag Jagan Travels',
  address = 'Dwaraka Nagar Main Road, Visakhapatnam, AP 530016',
}) => {
  const depotPos = { lat, lng };

  if (!MAPS_API_KEY) {
    return (
      <div className="w-full h-72 rounded-xl border border-slate-200 bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-7 h-7 text-[#2563EB] mb-2" />
        <p className="text-sm font-semibold text-[#102A43]">{companyName} Central Hub</p>
        <p className="text-xs text-slate-600 mt-1">{address}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-200">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        center={depotPos}
        defaultZoom={14}
        gestureHandling="cooperative"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={depotPos} title={`${companyName} Central Hub`}>
          <Pin background="#102A43" borderColor="#F59E0B" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
};
