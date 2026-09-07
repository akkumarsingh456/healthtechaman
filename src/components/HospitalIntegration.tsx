import { useState } from "react";
import { Building2, MapPin, Users, ChevronDown, ChevronUp, ExternalLink, Phone, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Google Maps link built from the hospital name + full address so the pin resolves exactly.
const mapsUrl = (name: string, address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;

// Phone numbers / hours are collected from each hospital's public website or public
// directory listings. They are shown as "unverified" in the UI — always confirm before visiting.
const SUPER_SPECIALTY_WARANGAL = [
  { name: "Rohini Super Specialty Hospital", location: "Hanamkonda", address: "Rohini Super Specialty Hospital, 2-5-742, Subedari, Hanamkonda, Warangal, Telangana 506001", phone: "+91 73375 55108", hours: "Open 24 hours" },
  { name: "Samraksha Super Specialty Hospital", location: "Warangal", address: "Samraksha Super Speciality Hospital, Narsampet Road, Prathap Nagar, Warangal, Telangana", phone: "+91 79979 77744", hours: "Open 24 hours" },
];

const GENERAL_HOSPITALS_WARANGAL = [
  { name: "Jaya Hospital", location: "Hanamkonda", address: "Jaya Hospital, Vijaya Talkies Road, Hanamkonda Chowrasta, Hanamkonda, Warangal, Telangana 506001", phone: "+91 870 256 8353", hours: "" },
  { name: "Guardian Multi-Speciality Hospital", location: "Warangal", address: "Guardian Multi Speciality Hospital, 15-1-237, Opp. L.B. College, Mulugu X Road, Vidya Nagar, Warangal, Telangana 506007", phone: "+91 80088 02292", hours: "Open 24 hours" },
  { name: "Max Care Hospitals", location: "Warangal", address: "Ekashilaa Hospitals (formerly Maxcare), 6-1-236, Sai Nagar, Opp. Ashoka Hotel, Hanamkonda, Warangal, Telangana 506001", phone: "+91 89788 12333", hours: "" },
  { name: "Pramoda Hospital", location: "Hanamkonda", address: "Pramoda Hospital, Kaloji Marg, Beside Canara Bank, Balasamudram, Hanamkonda, Warangal, Telangana 506001", phone: "+91 85209 83050", hours: "24x7 emergency; OPD timings vary by doctor" },
  { name: "Sharat Laser Eye Hospital", location: "Hanamkonda", address: "Dr. Sharat Maxivision Eye Hospital, Alankar Circle, Raganna Darwaja, Kakatiya Colony, Hanamkonda, Warangal, Telangana 506011", phone: "+91 92402 14612", hours: "" },
  { name: "Sri Laxmi Narasimha Hospital", location: "Hanamkonda", address: "Sri Laxmi Narasimha Hospital, 2-2-316, Naim Nagar, Hanamkonda, Warangal, Telangana 506001", phone: "+91 95509 78696", hours: "Mon-Sun, 6:00 AM - 9:00 PM" },
];

const SUPER_SPECIALTY_HYDERABAD = [
  { name: "Basavatarakam Indo American Cancer Hospital", location: "Hyderabad", address: "Road No. 10, Banjara Hills, Hyderabad, Telangana 500034", phone: "+91 77298 00800", hours: "" },
  { name: "Krishna Institute of Medical Sciences Ltd.", location: "Hyderabad", address: "1-8-31/1, Minister Road, Krishna Nagar, Begumpet, Secunderabad, Telangana 500003", phone: "+91 40 4488 5000", hours: "24x7 emergency" },
  { name: "Sunshine Hospitals", location: "Hyderabad", address: "Penderghast Road, Beside Sujana Forum Mall, Paradise, Secunderabad, Telangana 500003", phone: "+91 80081 08108", hours: "24x7 emergency" },
  { name: "CARE Super Speciality Hospitals", location: "Hyderabad", address: "Road No. 1, Banjara Hills, Hyderabad, Telangana 500034", phone: "+91 40 6810 6529", hours: "24x7 emergency" },
];

const EMPANELLED_HOSPITALS = [
  { sno: 1, name: "M/s. CARE Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "CARE Hospitals, Road No. 1, Banjara Hills, Hyderabad, Telangana 500034", phone: "+91 40 6810 6529", hours: "24x7 emergency" },
  { sno: 2, name: "M/s. KIMS Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "KIMS Hospitals, 1-8-31/1, Minister Road, Begumpet, Secunderabad, Telangana 500003", phone: "+91 40 4488 5000", hours: "24x7 emergency" },
  { sno: 3, name: "M/s. KIMS-Sunshine Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "KIMS-Sunshine Hospitals, Penderghast Road, Paradise, Secunderabad, Telangana 500003", phone: "+91 80081 08108", hours: "24x7 emergency" },
  { sno: 4, name: "M/s. Basavatarakam Indo-American Cancer Hospital & Research Institute", place: "Hyderabad", entitlement: "Employees" , address: "Basavatarakam Indo-American Cancer Hospital, Road No. 10, Banjara Hills, Hyderabad, Telangana 500034", phone: "+91 77298 00800", hours: "" },
  { sno: 5, name: "M/s. Star Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "Star Hospitals, Road No. 10, Banjara Hills, Hyderabad, Telangana 500034", phone: "1800 102 7827", hours: "24x7 emergency" },
  { sno: 6, name: "M/s. Omega Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "Omega Hospitals, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034", phone: "+91 40 2355 1034", hours: "Open 24 hours" },
  { sno: 7, name: "M/s. Medicover Hospitals", place: "Hyderabad & Warangal", entitlement: "Employees & Students" , address: "Medicover Hospitals, 23-6-156/1, Hunter Road, Hanamkonda, Warangal, Telangana 506001", phone: "+91 40 6833 4455", hours: "OPD Mon-Sat, 9:00 AM - 7:00 PM; 24x7 emergency" },
  { sno: 8, name: "M/s. Vijaya Diagnostic Centre Ltd.", place: "Hyderabad & Warangal", entitlement: "Employees & Students" , address: "Vijaya Diagnostic Centre, Beside Joyalukkas, Near Vijaya Talkies, Hanamkonda, Warangal, Telangana 506001", phone: "+91 92402 22222", hours: "Mon-Sat, 7:00 AM - 10:00 PM; Sun, 7:00 AM - 9:00 PM" },
  { sno: 9, name: "M/s. Rohini Medicare Pvt. Ltd.", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Rohini Super Specialty Hospital, 2-5-742, Subedari, Hanamkonda, Warangal, Telangana 506001", phone: "+91 73375 55108", hours: "Open 24 hours" },
  { sno: 10, name: "M/s. Ajara Hospitals", place: "Warangal", entitlement: "Employees & Students" , address: "Ajara Hospitals, Opp. Sub Station, Mulugu Road, Vidya Nagar, Warangal, Telangana 506007", phone: "", hours: "Open 24 hours" },
  { sno: 11, name: "M/s. Laxmi Narasimha Hospital", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Sri Laxmi Narasimha Hospital, 2-2-316, Naim Nagar, Hanamkonda, Warangal, Telangana 506001", phone: "+91 95509 78696", hours: "Mon-Sun, 6:00 AM - 9:00 PM" },
  { sno: 12, name: "M/s. Samraksha Super Specialty Hospital", place: "Warangal", entitlement: "Employees & Students" , address: "Samraksha Super Speciality Hospital, Narsampet Road, Prathap Nagar, Warangal, Telangana", phone: "+91 79979 77744", hours: "Open 24 hours" },
  { sno: 13, name: "M/s. Dr. Sharat Maxivision Eye Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Dr. Sharat Maxivision Eye Hospital, Alankar Circle, Raganna Darwaja, Kakatiya Colony, Hanamkonda, Warangal, Telangana 506011", phone: "+91 92402 14612", hours: "" },
  { sno: 14, name: "M/s. Ekashilaa Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Ekashilaa Hospitals, Opp. KUDA Office, Near Ashoka Hotel, Sai Nagar, Hanamkonda, Warangal, Telangana 506001", phone: "+91 89788 12333", hours: "" },
  { sno: 15, name: "M/s. Jaya Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Jaya Hospital, Vijaya Talkies Road, Hanamkonda Chowrasta, Hanamkonda, Warangal, Telangana 506001", phone: "+91 870 256 8353", hours: "" },
  { sno: 16, name: "M/s. S Vision Hospital", place: "Hanamkonda", entitlement: "Employees & Students" , address: "S Vision Hospital, 6-2-261, Near Hanamkonda Chowrasta, Kakaji Colony, Hanamkonda, Warangal, Telangana 506001", phone: "+91 98588 05805", hours: "Mon-Sat, 9:00 AM - 9:00 PM" },
  { sno: 17, name: "M/s. Guardian Multi Speciality Hospital", place: "Warangal", entitlement: "Employees" , address: "Guardian Multi Speciality Hospital, 15-1-237, Opp. L.B. College, Mulugu X Road, Vidya Nagar, Warangal, Telangana 506007", phone: "+91 80088 02292", hours: "Open 24 hours" },
  { sno: 18, name: "M/s. Pramoda Hospital", place: "Hanamkonda", entitlement: "Employees" , address: "Pramoda Hospital, Kaloji Marg, Beside Canara Bank, Balasamudram, Hanamkonda, Warangal, Telangana 506001", phone: "+91 85209 83050", hours: "24x7 emergency; OPD timings vary by doctor" },
  { sno: 19, name: "M/s. Dr. Vasavi's Hospital", place: "Naimnagar, Hanamkonda", entitlement: "Employees & Students" , address: "Dr. Vasavi's Hospital, 2-2-112/A, Naim Nagar Main Road, Hanamkonda, Warangal, Telangana 506001", phone: "+91 79931 00100", hours: "Open 24 hours" },
  { sno: 20, name: "M/s. Pebbles Kids Hospital", place: "Main Road, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Pebbles Kids Hospital, Main Road, Balasamudram, Hanamkonda, Warangal, Telangana 506001", phone: "", hours: "" },
  { sno: 21, name: "M/s. Sri Chakra Super Speciality Hospital", place: "Opp. Hayagreevachary Ground, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Sri Chakra Super Speciality Hospital, Fire Station Road, Kaloji Marg, Opp. Hayagreevachary Ground, Balasamudram, Hanamkonda, Warangal, Telangana 506001", phone: "+91 90520 12320", hours: "Mon-Sat, 8:30 AM - 10:00 PM; 24x7 emergency" },
  { sno: 22, name: "M/s. Sri Valli Good Life Hospital", place: "Beside New Bustand Road, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Sri Valli Good Life Hospital, Sai Nagar, Balasamudram Road, Near New Bus Stand, Hanamkonda, Warangal, Telangana 506001", phone: "+91 73373 34108", hours: "Mon-Sun, 9:00 AM - 8:00 PM" },
  { sno: 23, name: "M/s. K&H Dental Hospitals", place: "Near Hanuman Temple Road, Hanamkonda & JPN Road, Warangal", entitlement: "Employees & Students" , address: "K&H Dental Hospital, Vijaya Talkies Road, Near Hanuman Temple, Opp. Sri Krishna Children's Hospital, Hanamkonda, Warangal, Telangana 506001", phone: "", hours: "10:00 AM - 9:00 PM" },
];


const HospitalCard = ({ name, location, address, phone, hours }: { name: string; location: string; address: string; phone?: string; hours?: string }) => (
  <div className="p-4 bg-white rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all group">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {name}
        </h4>
        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{address}</span>
        </p>
        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
          <Clock className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{hours || "Timings not published — please call ahead"}</span>
        </p>
        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
          <Phone className="h-3 w-3 mt-0.5 shrink-0" />
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {phone}
            </a>
          ) : (
            <span>Phone number not published</span>
          )}
        </p>
        <a
          href={mapsUrl(name, address)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} on Google Maps`}
          className="text-xs text-primary font-medium mt-2 inline-flex items-center gap-1 hover:underline"
        >
          View on Google Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  </div>
);


const HospitalIntegration = () => {
  const [showAllEmpanelled, setShowAllEmpanelled] = useState(false);
  const displayedEmpanelled = showAllEmpanelled ? EMPANELLED_HOSPITALS : EMPANELLED_HOSPITALS.slice(0, 10);

  return (
    <section className="py-20" id="hospitals">
      <div className="container mx-auto px-4 bg-white/92 backdrop-blur-sm rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] p-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Network Hospitals
          </span>
          <h2 className="section-title">Hospital Integration</h2>
          <p className="section-subtitle">
            Connected with ABDM-enabled hospitals across Warangal and Hyderabad for seamless healthcare access
          </p>
        </div>

        <Accordion type="multiple" className="space-y-4">
          {/* Super Specialty Hospitals - Warangal */}
          <AccordionItem value="super-warangal" className="border rounded-xl overflow-hidden">
            <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Super Specialty Hospitals at Warangal</h3>
                  <p className="text-sm text-muted-foreground">{SUPER_SPECIALTY_WARANGAL.length} hospitals</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                {SUPER_SPECIALTY_WARANGAL.map((hospital) => (
                  <HospitalCard key={hospital.name} {...hospital} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* General Hospitals - Warangal */}
          <AccordionItem value="general-warangal" className="border rounded-xl overflow-hidden">
            <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-secondary/5 to-transparent hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-secondary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">General Hospitals at Warangal</h3>
                  <p className="text-sm text-muted-foreground">{GENERAL_HOSPITALS_WARANGAL.length} hospitals</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {GENERAL_HOSPITALS_WARANGAL.map((hospital) => (
                  <HospitalCard key={hospital.name} {...hospital} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Super Specialty Hospitals - Hyderabad */}
          <AccordionItem value="super-hyderabad" className="border rounded-xl overflow-hidden">
            <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Super Specialty Hospitals at Hyderabad</h3>
                  <p className="text-sm text-muted-foreground">{SUPER_SPECIALTY_HYDERABAD.length} hospitals</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                {SUPER_SPECIALTY_HYDERABAD.map((hospital) => (
                  <HospitalCard key={hospital.name} {...hospital} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Empanelled Hospitals List */}
          <AccordionItem value="empanelled" className="border rounded-xl overflow-hidden">
            <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-green-500/5 to-transparent hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Empanelled Hospitals for Employees & Students</h3>
                  <p className="text-sm text-muted-foreground">{EMPANELLED_HOSPITALS.length} empanelled hospitals</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-semibold text-sm border-b">S.No</th>
                        <th className="text-left p-3 font-semibold text-sm border-b">Name of the Hospital</th>
                        <th className="text-left p-3 font-semibold text-sm border-b">Address</th>
                        <th className="text-left p-3 font-semibold text-sm border-b">Entitlement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedEmpanelled.map((hospital) => (
                        <tr key={hospital.sno} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 border-b text-sm">{hospital.sno}</td>
                          <td className="p-3 border-b text-sm font-medium">{hospital.name}</td>
                          <td className="p-3 border-b text-sm text-muted-foreground">
                            <a
                              href={mapsUrl(hospital.name.replace(/^M\/s\.\s*/, ""), hospital.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1 hover:text-primary hover:underline"
                            >
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{hospital.address}</span>
                            </a>
                          </td>
                          <td className="p-3 border-b">
                            <Badge 
                              variant={hospital.entitlement === "Employees & Students" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {hospital.entitlement}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {EMPANELLED_HOSPITALS.length > 10 && (
                  <div className="text-center mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAllEmpanelled(!showAllEmpanelled)}
                    >
                      {showAllEmpanelled ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Show All {EMPANELLED_HOSPITALS.length} Hospitals
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
};

export default HospitalIntegration;
