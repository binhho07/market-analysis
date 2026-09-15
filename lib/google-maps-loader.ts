// Centralized Google Maps script loader to prevent duplicate loads
// Loads ALL required libraries at once

let isGoogleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string, libraries: string[] = []): Promise<void> {
  // Check if already loaded
  if (isGoogleMapsLoaded && window.google?.maps) {
    return Promise.resolve();
  }

  // Return existing promise if currently loading
  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  // Check if script tag already exists
  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  );
  
  if (existingScript) {
    // Script exists, wait for it to load
    if (window.google?.maps) {
      isGoogleMapsLoaded = true;
      return Promise.resolve();
    }
    
    // Script exists but not loaded yet, wait for it
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          isGoogleMapsLoaded = true;
          resolve();
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Google Maps script timeout"));
      }, 10000);
    });
  }

  // Combine all required libraries (remove duplicates)
  const allLibraries = Array.from(new Set([
    "places",
    "marker", 
    "visualization",
    ...libraries
  ]));

  // Create new load promise
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${allLibraries.join(",")}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGoogleMapsLoaded = true;
      googleMapsLoadPromise = null;
      resolve();
    };

    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };

    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

// Reset function for testing
export function resetGoogleMapsLoader() {
  isGoogleMapsLoaded = false;
  googleMapsLoadPromise = null;
}

