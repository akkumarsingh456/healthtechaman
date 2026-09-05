import { useState } from "react";
import { Building2, MapPin, Users, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
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

const SUPER_SPECIALTY_WARANGAL = [
  { name: "Rohini Super Specialty Hospital", location: "Hanamkonda", address: "Rohini Superspeciality Hospital, Ramnagar, Hanamkonda, Warangal, Telangana 506001" },
  { name: "Samraksha Super Specialty Hospital", location: "Warangal", address: "Samraksha Super Speciality Hospital, Kishanpura, Hanamkonda, Warangal, Telangana 506001" },
];

const GENERAL_HOSPITALS_WARANGAL = [
  { name: "Jaya Hospital", location: "Hanamkonda", address: "Jaya Hospital, Balasamudram, Hanamkonda, Warangal, Telangana 506001" },
  { name: "Guardian Multi-Speciality Hospital", location: "Warangal", address: "Guardian Multi Speciality Hospital, Naim Nagar, Hanamkonda, Warangal, Telangana 506009" },
  { name: "Max Care Hospitals", location: "Warangal", address: "Maxcare Hospitals, Nakkalagutta, Hanamkonda, Warangal, Telangana 506001" },
  { name: "Pramoda Hospital", location: "Hanamkonda", address: "Pramoda Hospital, Subedari, Hanamkonda, Warangal, Telangana 506001" },
  { name: "Sharat Laser Eye Hospital", location: "Hanamkonda", address: "Dr. Sharat Maxivision Eye Hospital, Subedari, Hanamkonda, Warangal, Telangana 506001" },
  { name: "Sri Laxmi Narasimha Hospital", location: "Hanamkonda", address: "Sri Laxmi Narasimha Hospital, Hanamkonda, Warangal, Telangana 506001" },
];

const SUPER_SPECIALTY_HYDERABAD = [
  { name: "Basavatarakam Indo American Cancer Hospital", location: "Hyderabad", address: "Road No. 10, Banjara Hills, Hyderabad, Telangana 500034" },
  { name: "Krishna Institute of Medical Sciences Ltd.", location: "Hyderabad", address: "1-8-31/1, Minister Road, Krishna Nagar, Begumpet, Secunderabad, Telangana 500003" },
  { name: "Sunshine Hospitals", location: "Hyderabad", address: "Penderghast Road, Beside Sujana Forum Mall, Paradise, Secunderabad, Telangana 500003" },
  { name: "CARE Super Speciality Hospitals", location: "Hyderabad", address: "Road No. 1, Banjara Hills, Hyderabad, Telangana 500034" },
];

const EMPANELLED_HOSPITALS = [
  { sno: 1, name: "M/s. CARE Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "CARE Hospitals, Road No. 1, Banjara Hills, Hyderabad, Telangana 500034" },
  { sno: 2, name: "M/s. KIMS Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "KIMS Hospitals, 1-8-31/1, Minister Road, Begumpet, Secunderabad, Telangana 500003" },
  { sno: 3, name: "M/s. KIMS-Sunshine Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "KIMS-Sunshine Hospitals, Penderghast Road, Paradise, Secunderabad, Telangana 500003" },
  { sno: 4, name: "M/s. Basavatarakam Indo-American Cancer Hospital & Research Institute", place: "Hyderabad", entitlement: "Employees" , address: "Basavatarakam Indo-American Cancer Hospital, Road No. 10, Banjara Hills, Hyderabad, Telangana 500034" },
  { sno: 5, name: "M/s. Star Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "Star Hospitals, Road No. 10, Banjara Hills, Hyderabad, Telangana 500034" },
  { sno: 6, name: "M/s. Omega Hospitals", place: "Hyderabad", entitlement: "Employees" , address: "Omega Hospitals, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034" },
  { sno: 7, name: "M/s. Medicover Hospitals", place: "Hyderabad & Warangal", entitlement: "Employees & Students" , address: "Medicover Hospitals, Nakkalagutta, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 8, name: "M/s. Vijaya Diagnostic Centre Ltd.", place: "Hyderabad & Warangal", entitlement: "Employees & Students" , address: "Vijaya Diagnostic Centre, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 9, name: "M/s. Rohini Medicare Pvt. Ltd.", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Rohini Superspeciality Hospital, Ramnagar, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 10, name: "M/s. Ajara Hospitals", place: "Warangal", entitlement: "Employees & Students" , address: "Ajara Hospitals, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 11, name: "M/s. Laxmi Narasimha Hospital", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Sri Laxmi Narasimha Hospital, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 12, name: "M/s. Samraksha Super Specialty Hospital", place: "Warangal", entitlement: "Employees & Students" , address: "Samraksha Super Speciality Hospital, Kishanpura, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 13, name: "M/s. Dr. Sharat Maxivision Eye Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Dr. Sharat Maxivision Eye Hospital, Subedari, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 14, name: "M/s. Ekashilaa Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Ekashilaa Hospitals, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 15, name: "M/s. Jaya Hospitals", place: "Hanamkonda", entitlement: "Employees & Students" , address: "Jaya Hospital, Balasamudram, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 16, name: "M/s. S Vision Hospital", place: "Hanamkonda", entitlement: "Employees & Students" , address: "S Vision Hospital, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 17, name: "M/s. Guardian Multi Speciality Hospital", place: "Warangal", entitlement: "Employees" , address: "Guardian Multi Speciality Hospital, Naim Nagar, Hanamkonda, Warangal, Telangana 506009" },
  { sno: 18, name: "M/s. Pramoda Hospital", place: "Hanamkonda", entitlement: "Employees" , address: "Pramoda Hospital, Subedari, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 19, name: "M/s. Dr. Vasavi's Hospital", place: "Naimnagar, Hanamkonda", entitlement: "Employees & Students" , address: "Dr. Vasavi's Hospital, Naimnagar, Hanamkonda, Warangal, Telangana 506009" },
  { sno: 20, name: "M/s. Pebbles Kids Hospital", place: "Main Road, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Pebbles Kids Hospital, Main Road, Balasamudram, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 21, name: "M/s. Sri Chakra Super Speciality Hospital", place: "Opp. Hayagreevachary Ground, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Sri Chakra Super Speciality Hospital, Opp. Hayagreevachary Ground, Balasamudram, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 22, name: "M/s. Sri Valli Good Life Hospital", place: "Beside New Bustand Road, Balasamudram, Hanamkonda", entitlement: "Employees & Students" , address: "Sri Valli Good Life Hospital, Beside New Bus Stand Road, Balasamudram, Hanamkonda, Warangal, Telangana 506001" },
  { sno: 23, name: "M/s. K&H Dental Hospitals", place: "Near Hanuman Temple Road, Hanamkonda & JPN Road, Warangal", entitlement: "Employees & Students" , address: "K&H Dental Hospital, Near Hanuman Temple Road, Hanamkonda, Warangal, Telangana 506001" },
];

const HospitalCard = ({ name, location, address }: { name: string; location: string; address: string }) => (
  <a
    href={mapsUrl(name, address)}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Open ${name} on Google Maps`}
    className="block p-4 bg-white rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
  >
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {name}
        </h4>
        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{address}</span>
        </p>
        <span className="text-xs text-primary font-medium mt-1 inline-block">View on Google Maps</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
  </a>
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
