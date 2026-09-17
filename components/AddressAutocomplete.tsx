"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { loadGoogleMapsScript } from "@/lib/google-maps-loader";
import { getRecentSearches } from "@/lib/js/recentSearches.js";

export interface AddressSuggestion {
  id: string;
  label: string;
  description: string;
  placeId?: string;
  source: "google" | "recent";
}

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function AddressAutocomplete({
  id = "address",
  value,
  onChange,
  onSelect,
  placeholder = "e.g. 123 Main St, Los Angeles, CA",
  disabled,
  error,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [mapsReady, setMapsReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const attributionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return;

      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !window.google?.maps?.places) return;
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        if (attributionRef.current) {
          placesServiceRef.current = new google.maps.places.PlacesService(attributionRef.current);
        }
        setMapsReady(true);
      } catch (err) {
        console.error("Address autocomplete failed to load:", err);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentSuggestions = useCallback((query: string): AddressSuggestion[] => {
    const needle = query.trim().toLowerCase();
    return getRecentSearches()
      .filter((item: { address: string }) =>
        !needle || item.address.toLowerCase().includes(needle)
      )
      .slice(0, 4)
      .map((item: { address: string }) => ({
        id: `recent-${item.address}`,
        label: item.address,
        description: "Recent search",
        source: "recent" as const,
      }));
  }, []);

  useEffect(() => {
    const query = value.trim();
    const recents = recentSuggestions(query);

    if (query.length < 2) {
      setSuggestions(recents);
      setActiveIndex(0);
      setLoading(false);
      return;
    }

    if (!mapsReady || !autocompleteServiceRef.current) {
      setSuggestions(recents);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "us" },
        },
        (predictions, status) => {
          if (requestId !== requestIdRef.current) return;
          setLoading(false);

          const googleSuggestions =
            status === google.maps.places.PlacesServiceStatus.OK && predictions
              ? predictions.slice(0, 6).map((prediction) => ({
                  id: prediction.place_id,
                  label: prediction.structured_formatting?.main_text || prediction.description,
                  description:
                    prediction.structured_formatting?.secondary_text || prediction.description,
                  placeId: prediction.place_id,
                  source: "google" as const,
                }))
              : [];

          const combined = [
            ...recents,
            ...googleSuggestions.filter(
              (suggestion) =>
                !recents.some(
                  (recent) => recent.label.toLowerCase() === suggestion.label.toLowerCase()
                )
            ),
          ];
          setSuggestions(combined);
          setActiveIndex(0);
        }
      );
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, mapsReady, recentSuggestions]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const chooseSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    setOpen(false);
    setSuggestions([]);

    if (!suggestion.placeId || !placesServiceRef.current) {
      onSelect(suggestion.label);
      return;
    }

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.placeId,
        fields: ["formatted_address", "geometry", "name"],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          onSelect(suggestion.label);
          return;
        }

        const address = place.formatted_address || place.name || suggestion.label;
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        onChange(address);
        onSelect(address, lat, lng);
      }
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className={`pl-10 ${error ? "border-red-500" : ""}`}
          aria-label="Salon address or name"
          aria-invalid={!!error}
          aria-expanded={open}
          aria-controls="address-suggestions"
          aria-describedby={error ? "address-error" : undefined}
          onFocus={() => {
            setSuggestions(recentSuggestions(value));
            setOpen(true);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>
      {error && (
        <p id="address-error" className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-purple-50" : "hover:bg-gray-50"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseSuggestion(suggestion);
                }}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  <span className="block font-medium text-gray-900">{suggestion.label}</span>
                  <span className="block text-xs text-gray-500">{suggestion.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={attributionRef} className="hidden" />
    </div>
  );
}
