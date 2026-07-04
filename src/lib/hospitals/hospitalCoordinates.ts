// Empanelled / tied-up hospital coordinates + closest-hospital ranking.
// Uses the Haversine formula. NITW main gate is the fallback origin.

export const NITW_ORIGIN = { lat: 17.9689, lng: 79.5941, label: "NIT Warangal (main gate)" };

export interface HospitalGeo {
  name: string;
  location: string;
  lat: number;
  lng: number;
  city: "Warangal" | "Hyderabad";
  entitlement: "Employees & Students" | "Employees";
  superSpecialty: boolean;
  specialties?: string[];
  phone?: string;
  emergency?: string;
}

// Coordinates approximated from public map data for each empanelled hospital.
export const HOSPITALS_GEO: HospitalGeo[] = [
  // Warangal / Hanamkonda (closest to NITW)
  { name: "Rohini Super Specialty Hospital", location: "Hanamkonda", lat: 17.9975, lng: 79.5647, city: "Warangal", entitlement: "Employees & Students", superSpecialty: true, specialties: ["Cardiology", "Neurology", "Nephrology", "Oncology"], phone: "0870-2461111", emergency: "0870-2461122" },
  { name: "Samraksha Super Specialty Hospital", location: "Warangal", lat: 17.9784, lng: 79.5980, city: "Warangal", entitlement: "Employees & Students", superSpecialty: true, specialties: ["Cardiac Surgery", "Orthopedics", "Gastroenterology", "Urology"], phone: "0870-2577777", emergency: "0870-2577700" },
  { name: "Medicover Hospitals", location: "Nakkalagutta, Hanamkonda", lat: 18.0064, lng: 79.5580, city: "Warangal", entitlement: "Employees & Students", superSpecialty: true, specialties: ["Multi-Specialty", "Emergency Care", "Diagnostics"], phone: "040-68334455", emergency: "040-68334455" },
  { name: "Jaya Hospital", location: "Hanamkonda", lat: 17.9928, lng: 79.5677, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["General Medicine", "Surgery", "Pediatrics", "Gynecology"], phone: "0870-2542899", emergency: "0870-2542800" },
  { name: "Guardian Multi-Speciality Hospital", location: "Warangal", lat: 17.9765, lng: 79.6015, city: "Warangal", entitlement: "Employees", superSpecialty: false, specialties: ["Multi-Specialty", "Critical Care", "Dialysis"], phone: "0870-2576666", emergency: "0870-2576600" },
  { name: "Max Care Hospitals", location: "Nakkalagutta, Warangal", lat: 18.0055, lng: 79.5595, city: "Warangal", entitlement: "Employees", superSpecialty: false, phone: "0870-2555555" },
  { name: "Pramoda Hospital", location: "Hanamkonda", lat: 17.9903, lng: 79.5642, city: "Warangal", entitlement: "Employees", superSpecialty: false, phone: "0870-2500222" },
  { name: "Sharat Laser Eye Hospital", location: "Subedari, Hanamkonda", lat: 17.9861, lng: 79.5697, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["Ophthalmology", "LASIK", "Cataract Surgery"], phone: "0870-2574433" },
  { name: "Sri Laxmi Narasimha Hospital", location: "Hanamkonda", lat: 17.9944, lng: 79.5720, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, phone: "0870-2543322" },
  { name: "Ajara Hospitals", location: "Warangal", lat: 17.9807, lng: 79.6003, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, phone: "0870-2500123" },
  { name: "Ekashilaa Hospitals", location: "Hanamkonda", lat: 17.9915, lng: 79.5688, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, phone: "0870-2571234" },
  { name: "S Vision Hospital", location: "Hanamkonda", lat: 17.9890, lng: 79.5701, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["Ophthalmology", "Eye Care"], phone: "0870-2575000" },
  { name: "Dr. Vasavi's Hospital", location: "Naimnagar, Hanamkonda", lat: 17.9950, lng: 79.5610, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, phone: "0870-2546789" },
  { name: "Pebbles Kids Hospital", location: "Balasamudram, Hanamkonda", lat: 17.9855, lng: 79.5745, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["Pediatrics", "Neonatal Care"], phone: "0870-2549876" },
  { name: "Sri Chakra Super Speciality Hospital", location: "Balasamudram, Hanamkonda", lat: 17.9848, lng: 79.5738, city: "Warangal", entitlement: "Employees & Students", superSpecialty: true, phone: "0870-2548765" },
  { name: "Sri Valli Good Life Hospital", location: "Balasamudram, Hanamkonda", lat: 17.9860, lng: 79.5750, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, phone: "0870-2547654" },
  { name: "Vijaya Diagnostic Centre", location: "Hanamkonda, Warangal", lat: 17.9920, lng: 79.5665, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["Diagnostics", "Lab Tests", "Radiology"], phone: "0870-2440000" },
  { name: "K&H Dental Hospitals", location: "Hanamkonda", lat: 17.9908, lng: 79.5695, city: "Warangal", entitlement: "Employees & Students", superSpecialty: false, specialties: ["Dental Care", "Orthodontics"], phone: "0870-2574321" },
  // Hyderabad (super-specialty tertiary care)
  { name: "Basavatarakam Indo American Cancer Hospital", location: "Banjara Hills, Hyderabad", lat: 17.4149, lng: 78.4460, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, specialties: ["Oncology", "Radiation Therapy", "Chemotherapy"], phone: "040-23551235", emergency: "040-23551236" },
  { name: "KIMS Hospitals (Krishna Institute of Medical Sciences)", location: "Secunderabad", lat: 17.4416, lng: 78.4983, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, specialties: ["Cardiac Sciences", "Neuro Sciences", "Liver Transplant"], phone: "040-44885000", emergency: "040-44885100" },
  { name: "Sunshine Hospitals", location: "Secunderabad", lat: 17.4413, lng: 78.4990, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, specialties: ["Orthopedics", "Joint Replacement", "Spine Surgery"], phone: "040-44556677", emergency: "040-44556600" },
  { name: "CARE Super Speciality Hospitals", location: "Banjara Hills, Hyderabad", lat: 17.4172, lng: 78.4483, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, specialties: ["Cardiac Sciences", "Neuro Sciences", "Oncology"], phone: "040-30418888", emergency: "040-30418800" },
  { name: "Star Hospitals", location: "Banjara Hills, Hyderabad", lat: 17.4166, lng: 78.4436, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, phone: "040-44777777" },
  { name: "Omega Hospitals", location: "Banjara Hills, Hyderabad", lat: 17.4155, lng: 78.4459, city: "Hyderabad", entitlement: "Employees", superSpecialty: true, specialties: ["Oncology", "Cancer Care"], phone: "040-23551000" },
];

// Haversine distance in km between two lat/lng points.
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface RankedHospital extends HospitalGeo {
  distanceKm: number;
  mapUrl: string;
  directionsUrl: string;
}

export function rankHospitals(
  origin: { lat: number; lng: number },
  priority: "high" | "medium" | "low",
  opts?: { studentEntitlement?: boolean; onlySuperSpecialty?: boolean }
): RankedHospital[] {
  const studentOnly = opts?.studentEntitlement !== false;
  let list = HOSPITALS_GEO.filter((h) => !studentOnly || h.entitlement === "Employees & Students");

  // For HIGH priority, prefer super-specialty capable hospitals when any exist nearby.
  if (priority === "high") {
    const superList = HOSPITALS_GEO.filter((h) => h.superSpecialty);
    if (superList.length) list = [...new Set([...list, ...superList])];
  }
  if (opts?.onlySuperSpecialty) list = list.filter((h) => h.superSpecialty);

  const ranked: RankedHospital[] = list.map((h) => {
    const distanceKm = haversineKm(origin, { lat: h.lat, lng: h.lng });
    return {
      ...h,
      distanceKm,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${h.lat},${h.lng}`,
    };
  });

  ranked.sort((a, b) => {
    if (priority === "high") {
      // super-specialty first, then distance
      if (a.superSpecialty !== b.superSpecialty) return a.superSpecialty ? -1 : 1;
    }
    return a.distanceKm - b.distanceKm;
  });

  return ranked;
}

// Try to get the user's geolocation; fall back to NITW campus on denial/error/timeout.
export function getUserLocation(timeoutMs = 6000): Promise<{ lat: number; lng: number; source: "geo" | "campus" }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve({ ...NITW_ORIGIN, source: "campus" });
    }
    const done = (val: { lat: number; lng: number; source: "geo" | "campus" }) => resolve(val);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      done({ ...NITW_ORIGIN, source: "campus" });
    }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "geo" });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done({ ...NITW_ORIGIN, source: "campus" });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}