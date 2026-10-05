export type SpeedafPickupStation = {
  id: string;
  county: string;
  area: string;
  name: string;
  address: string;
  phone: string;
};

// Approved Speedaf collection points from DOC-20260709-WA0020. Keep this
// deliberately separate from general delivery towns: only these points qualify
// for POD collection.
const source = [
  "Eldoret|Uasin Gishu|Kapsoya|Robu Car Wash, Waiganjo Street off Elgeyo Rd, next to Fargo Courier|0716005337",
  "Nanyuki|Laikipia|Nanyuki|Along Laikipia-Nanyuki Highway, next to Mabati Factory|0112795734",
  "Kakamega|Kakamega|Sheywe|K-Place Business Center, Room 9, Mumias Road|0710929501",
  "Ruaka|Kiambu|Ruaka|Behind Quick Mart Supermarket, Room C3, containers next to Willy's Apartment|0101580996",
  "Diani / Ukunda|Kwale|Diani / Ukunda|Darad Neema House, after Palm Beach Hospital, Diani Beach Road|0790643027",
  "Watamu|Kilifi|Watamu|Madina Electronics, opposite Swahili Cafe|0745381998",
  "Njiru / Ruai|Nairobi|Njiru / Ruai|Ruai Bypass, opposite Vantage Center|0705373037",
  "Kilimani|Nairobi|Kilimani|Near Yaya Center, opposite Naivas Kilimani Mall, Tigoni Road|0798528892",
  "Sotik|Bomet|Sotik|Sotik Town, near Sillent Hotel, Kisii-Kericho Highway|0794411370",
  "Lang'ata|Nairobi|Lang'ata|Maboko Road, Lang'ata Height Business Centre, next to Penda Medical Centre|0792566409",
  "Athi River|Machakos|Athi River|Stadium Business Centre, 1st Floor Room 20, opposite Mutonguni Hospital|0782196756",
  "Kitengela|Kajiado|Kitengela|Near National Oil Petrol Station off Namanga Road, opposite Moran Trade Centre|0782196756",
  "Nakuru|Nakuru|Nakuru|Prestige Mall, next to Mache Hardware|0799089670",
  "Mombasa CBD|Mombasa|Mombasa CBD|Next to New Bayleaf Hospital|0106699887",
  "Thika|Kiambu|Thika|Upper Hill Road, behind Thika Main Stage, opposite Diversity Microcredit|0738316570",
  "Kisumu|Kisumu|Nyalenda|Tumaini Mall, Ground Floor, Door 7|0703127025",
  "Karatina|Nyeri|Karatina|Opposite Kimathi Bookshop, Room B5|0108160421",
  "Eastleigh|Nairobi|Eastleigh|OTC, Sokomix Biashara Centre / Family Bank Building|0799736373",
  "Kilifi|Kilifi|Kilifi|Ronleb Tech, opposite NCBA/Post Bank, Biashara Street|0110663691",
  "Garden City|Nairobi|Garden City|Blessed House, Thika Road, opposite Garden City Mall|0728840826",
  "Meru|Meru|Meru|Hart Towers, opposite Meru Police Station, next to Aga Khan Hospital|0798907372",
  "Luthuli|Nairobi|Nairobi CBD|Royal Palm Mall, Ground Floor Wing B, Room BG47|0725002700",
  "Naivasha|Nakuru|Naivasha|Parkview Complex, Kariuki Chotara Road|0712821155",
  "Kajiado Town|Kajiado|Kajiado Town|Off Kajiado-Namanga Highway, next to Neighbors Building|0720464368",
  "Bamburi|Mombasa|Bamburi|Pastor Lai Road, near Hotel Sisteres|0720450002",
  "Kiambu Town|Kiambu|Kiambu Town|Sakina Petrol Station, Office 3, near Kiambu Mall/Radiant Hospital|0792466526",
  "Molo|Nakuru|Molo|Molo Town|0700487405",
  "Ruiru|Kiambu|Ruiru|Wangirika House, adjacent to Cooperative Bank, 1st Floor Office F20|0745614818",
  "Buruburu|Nairobi|Buruburu|Buruburu Shopping Centre, next to KCB Bank|0799971020",
  "Homabay Town|Homa Bay|Homabay Town|Bay Lodge Building, behind Main Stage, opposite Lunar Credit|0721575535",
  "Oyugis|Homa Bay|Oyugis|Next to Raila Grounds, Oyugis Town|0794297119",
  "Narok Town|Narok|Narok Town|Paulo Electricals & Electronics, Corner House|0718319600",
  "Mbale|Vihiga|Mbale|Mbihi Road, next to Praise Center|0720489792",
  "Bondo|Siaya|Bondo|Sevens Road, opposite White House Bar|0768981128",
  "Mariakani|Kilifi|Mariakani|Mombasa-Nairobi Highway, next to Manazil Petrol Station|0725749822",
  "Mtwapa|Kilifi|Mtwapa|Kivuline White House|0725749822",
  "Moi Avenue|Mombasa|Moi Avenue|Talyani Plaza, Mwembe Tayari Road, next to Saphire Hotel|0798721065",
  "Busia|Busia|Busia|Busia Business Solutions, opposite Huduma Center|0719169093",
  "Chwele|Bungoma|Chwele|Off Chwele-Bungoma Road, next to Wanda Medical Center|0725462606",
  "Malaba|Busia|Malaba|Near Bluemart Hardware, Malaba-Bungoma Highway|0111446025",
  "Moi's Bridge|Uasin Gishu|Moi's Bridge|Langat Building, opposite Bread Point|0708281803",
  "Webuye|Bungoma|Webuye|KMTC Road, behind Kenya Power Offices|0110624807",
  "Industrial Area / South B|Nairobi|Industrial Area / South B|Near Police Band|0112482358",
  "Murang'a Town|Murang'a|Murang'a Town|Sagana Stage, behind Ecclesia Flat|0101684687",
  "Nkubu|Meru|Nkubu|Next to Kawasaki Building|0795722131",
  "Embu|Embu|Embu|Near Kirimari Shell Petrol Station, opposite Billionaire Club/Linco Store|0793837469",
  "Limuru|Kiambu|Limuru|Behind Shell Petrol Station, opposite Rafiki Tents|0742954503",
  "Karen|Nairobi|Karen|CrossRoads Mall, Karen-Boyani Road|0792566409",
  "Kirinyaga Road|Nairobi|Nairobi CBD|Shell, junction of Accra Road and Kirinyaga Road|0703253305",
  "Rongo|Migori|Rongo|Rongo Town, opposite Rongo Police Station|0768635015",
  "Nambale|Busia|Nambale|Nambale Town|0710141149",
  "Mumias|Kakamega|Mumias|Lumino Road, Survival Towers, behind G4S Mumias|0722157117",
  "Kibwezi|Makueni|Kibwezi|D-Light Office Kibwezi, DWA Stage|0705814108",
  "Westlands|Nairobi|Westlands|Reliance Center, Ground Floor, first door right|0748386159",
  "Kisii|Kisii|Kisii|Golf House/Elgon View College, next to Gusii Stadium, Ground Floor Room 6|0790725941",
  "Keroka|Kisii|Keroka|Behind Shivling Supermarket / Cooperative Bank|0725797077",
  "Voi|Taita Taveta|Voi|Tsavorite Building, opposite Sechu Plaza, beside Mombasa Maize Millers|0112872243",
  "Nyeri|Nyeri|Nyeri|Kingongo Central Steel & Mabati Factory, next to OLA Petrol Station|0713555990",
  "Mwea|Kirinyaga|Mwea|Mwea Town, opposite Eastmart Supermarket|0705470671",
  "Machakos Town|Machakos|Machakos Town|Splash, opposite Makamithi Agrovet|0798208424",
  "Siaya Town|Siaya|Siaya Town|Inside Migingo Market|0710929501",
  "Luanda|Vihiga|Luanda|Opposite Texas Petrol Station|0723714899",
  "Awasi|Kisumu|Awasi|In front of Awasi Police Station|0729500571",
  "Ahero|Kisumu|Ahero|Next to KENHA Weighbridge|0705293287",
  "Subukia|Nakuru|Subukia|Near Subukia Market|0987654321",
  "Isibania|Migori|Isibania|Isibania Town Shopping Centre, Isibania Kilishop|0745388609",
  "Ogembo|Kisii|Ogembo|Kemboa Junction|0724033949",
  "Gilgil|Nakuru|Gilgil|Amani Biashara Center, 2nd Floor Room 29, opposite Cooperative Bank|0743126454",
  "Likoni|Mombasa|Likoni|Kilimall Pickup Station, next to Abu Musa Ration Store|0706688331",
  "Migori Town|Migori|Migori Town|Opposite Migori Primary, Migori Suna Driving School Building, Room 1|0712281985",
  "Kikuyu|Kiambu|Kikuyu|Behind Equity Bank, Mary Ngendo Plaza, next to Rider's Lounge|0796216369",
  "Malindi|Kilifi|Malindi|Malindi Mall, next to KWFT|0726996610",
  "Bomet Town|Bomet|Bomet Town|Kipchamba Road, next to BOMASCO|0746520270",
  "Kerugoya|Kirinyaga|Kerugoya|Opposite Family Bank, next to Focus Clinic/ACK Building|0791622614",
  "Kericho|Kericho|Kericho|Kong'onyot Plaza, next to Sunshine Hotel, Tengecha Street|0758973618",
  "Kitale|Trans Nzoia|Kitale|Behind Vision Gate Building, Midtown Business Centre, Stall 97|0745232015",
  "Chuka|Tharaka Nithi|Chuka|Chuka Town Main Stage, Wakim Shop|0729396088",
  "Bungoma|Bungoma|Bungoma|Between Christ the King Catholic Church and G4S Office|0729623763",
  "Litein|Kericho|Litein|Next to Stabex Petrol Station, Litein Town|0728488535",
  "Nyahururu|Laikipia|Nyahururu|Viona House, Ground Floor Room 4, next to Olympia Hotel|0726336186",
  "Imenti|Nairobi|Nairobi CBD|Imenti House, parking area|0701857522",
  "Wote|Makueni|Wote|Behind Cooperative Bank, next to Coca-Cola Depot|0724304867",
  "Kapsabet|Nandi|Kapsabet|Sogom Hotel Building, opposite Gariza Mall, Ground Floor Room 2|0719776372",
] as const;

export const speedafPickupStations: SpeedafPickupStation[] = source.map(([name, county, area, address, phone], index) => ({
  id: `speedaf-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
  name, county, area, address, phone,
}));

export const speedafCounties = [...new Set(speedafPickupStations.map((station) => station.county))].sort();
export const speedafAreasForCounty = (county: string) => [...new Set(speedafPickupStations.filter((station) => station.county === county).map((station) => station.area))].sort();
export const speedafStationsForArea = (county: string, area: string) => speedafPickupStations.filter((station) => station.county === county && station.area === area);
export const getSpeedafPickupStation = (id: string) => speedafPickupStations.find((station) => station.id === id) ?? null;
