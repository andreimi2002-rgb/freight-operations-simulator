/**
 * FOS mission rules v1. All bundled places, distances, weights and costs are
 * sample scenario data until a record explicitly carries a verified source.
 */
export const ROUTES = [
  {id:"ats-seattle-spokane",world:"ATS",from:"Seattle, Washington",to:"Spokane, Washington",region:"west",geography:"north-america",distanceMi:[275,300]},
  {id:"ats-phoenix-tucson",world:"ATS",from:"Phoenix, Arizona",to:"Tucson, Arizona",region:"south",geography:"north-america",distanceMi:[110,125]},
  {id:"ats-portland-bend",world:"ATS",from:"Portland, Oregon",to:"Bend, Oregon",region:"west",geography:"north-america",distanceMi:[125,165]},
  {id:"ats-denver-cheyenne",world:"ATS",from:"Denver, Colorado",to:"Cheyenne, Wyoming",region:"west",geography:"north-america",distanceMi:[100,115]},
  {id:"ats-dallas-austin",world:"ATS",from:"Dallas, Texas",to:"Austin, Texas",region:"south",geography:"north-america",distanceMi:[190,205]},
  {id:"ats-sacramento-reno",world:"ATS",from:"Sacramento, California",to:"Reno, Nevada",region:"west",geography:"north-america",distanceMi:[130,150]},
  {id:"ats-kansas-oklahoma",world:"ATS",from:"Kansas City, Missouri",to:"Oklahoma City, Oklahoma",region:"midwest",geography:"north-america",distanceMi:[350,370]},
  {id:"ets-berlin-hamburg",world:"ETS2",from:"Berlin, Germany",to:"Hamburg, Germany",region:"north",geography:"europe",distanceMi:[180,190]},
  {id:"ets-rotterdam-brussels",world:"ETS2",from:"Rotterdam, Netherlands",to:"Brussels, Belgium",region:"north",geography:"europe",distanceMi:[95,115]},
  {id:"ets-milan-bologna",world:"ETS2",from:"Milan, Italy",to:"Bologna, Italy",region:"south-eu",geography:"europe",distanceMi:[135,155]},
  {id:"ets-lyon-marseille",world:"ETS2",from:"Lyon, France",to:"Marseille, France",region:"south-eu",geography:"europe",distanceMi:[195,220]},
  {id:"ets-prague-dresden",world:"ETS2",from:"Prague, Czechia",to:"Dresden, Germany",region:"north",geography:"europe",distanceMi:[90,110]},
  {id:"ets-oslo-gothenburg",world:"ETS2",from:"Oslo, Norway",to:"Gothenburg, Sweden",region:"north",geography:"europe",distanceMi:[180,200]},
  {id:"ets-warsaw-krakow",world:"ETS2",from:"Warsaw, Poland",to:"Kraków, Poland",region:"north",geography:"europe",distanceMi:[185,205]},
].map(route => ({...route, dataStatus:"illustrative", source:{id:"fos-starter-scenarios", label:"FOS starter scenario dataset"}}));

export const EQUIPMENT = {
  dryVan:{id:"dryVan",name:"Dry van",samplePayloadLimitKg:24000},
  reefer:{id:"reefer",name:"Refrigerated trailer",samplePayloadLimitKg:22000},
  flatbed:{id:"flatbed",name:"Flatbed",samplePayloadLimitKg:25000},
  equipment:{id:"equipment",name:"Equipment trailer",samplePayloadLimitKg:26000},
  chassis:{id:"chassis",name:"Container chassis",samplePayloadLimitKg:24000},
  hopper:{id:"hopper",name:"Grain hopper",samplePayloadLimitKg:26000},
  dump:{id:"dump",name:"Dump trailer",samplePayloadLimitKg:26000},
  slidingTarp:{id:"slidingTarp",name:"Sliding tarp trailer",samplePayloadLimitKg:25000},
  lowboy:{id:"lowboy",name:"Lowboy trailer",samplePayloadLimitKg:30000},
  carTransporter:{id:"carTransporter",name:"Car transporter",samplePayloadLimitKg:20000},
  silo:{id:"silo",name:"Silo trailer",samplePayloadLimitKg:26000},
  chemicalTank:{id:"chemicalTank",name:"Chemical tank trailer",samplePayloadLimitKg:26000},
  curtainsider:{id:"curtainsider",name:"Curtainsider",samplePayloadLimitKg:24000}
};

export const CARGO = {
  industrial:{id:"industrial",name:"Packaged industrial components",weightKg:[12000,22000],equipmentIds:["dryVan"],handling:["Secure pallets; verify load plan."]},
  food:{id:"food",name:"Chilled food products",weightKg:[14000,20000],equipmentIds:["reefer"],handling:["Confirm temperature setpoint and food-safety requirements with shipper."]},
  vehicles:{id:"vehicles",name:"Automotive parts and equipment",weightKg:[9000,18000],equipmentIds:["dryVan","equipment"],handling:["Confirm packaging and load securement for the specific commodity."]},
  timber:{id:"timber",name:"Palletized building materials",weightKg:[14000,24000],equipmentIds:["dryVan","flatbed"],handling:["Confirm cargo securement and weather protection requirements."]},
  chemicals:{id:"chemicals",name:"Packaged industrial chemicals",weightKg:[10000,20000],equipmentIds:["dryVan"],handling:["Generic scenario only; verify product identity, safety documents and equipment compatibility."]},
  containers:{id:"containers",name:"Containerized consumer goods",weightKg:[10000,24000],equipmentIds:["chassis"],handling:["Verify container, chassis, gross weight and terminal requirements."]}
};

export const OPERATING_STYLES = {
  casual:{id:"casual",label:"Casual",speedKph:{ATS:88,ETS2:75},fuelFactor:0.92,deadlineBufferHours:3},
  realistic:{id:"realistic",label:"Realistic",speedKph:{ATS:80,ETS2:68},fuelFactor:1,deadlineBufferHours:5},
  hardcore:{id:"hardcore",label:"Hardcore simulation",speedKph:{ATS:73,ETS2:62},fuelFactor:1.12,deadlineBufferHours:7}
};

export const REGIONS = {
  ATS:[{id:"west",label:"Western USA / Pacific Northwest"},{id:"south",label:"Southern USA"},{id:"midwest",label:"Midwest USA"}],
  ETS2:[{id:"north",label:"Northern / Central Europe"},{id:"south-eu",label:"Southern Europe"}]
};

const CARRIER_REFERENCES = {
  ATS:GAME_REFERENCE_CATALOG.companies.ATS,
  ETS2:GAME_REFERENCE_CATALOG.companies.ETS2,
};

const GAME_EQUIPMENT_MAP = {
  "dry van":"dryVan","dry freighter":"dryVan","bulk feed":"hopper","dry bulk":"hopper","grain hopper":"hopper","hopper":"hopper",
  dumper:"dump","sliding tarp":"slidingTarp","lowboy":"lowboy","drop deck":"equipment",refrigerated:"reefer",insulated:"reefer",
  "car transporter":"carTransporter",silo:"silo","chemical tank":"chemicalTank",curtainsider:"curtainsider"
};

const between = (min,max,random) => Math.floor(random()*(max-min+1))+min;
const pick = (items,random) => items[Math.min(items.length-1,Math.floor(random()*items.length))];

export function generateMission(options={}) {
  const {world="ATS",region="any",cargoId="random",operatingStyle="realistic",includeStop=true,includeCompanies=true,random=Math.random,now=new Date()}=options;
  if(!["ATS","ETS2"].includes(world)) throw new Error(`Unknown transport world: ${world}`);
  const style=OPERATING_STYLES[operatingStyle];
  if(!style) throw new Error(`Unknown operating style: ${operatingStyle}`);
  let routes=ROUTES.filter(route=>route.world===world);
  if(region!=="any") routes=routes.filter(route=>route.region===region);
  if(!routes.length) throw new Error(`No sample routes for ${world} in region ${region}.`);
  const route=pick(routes,random);
  const cargoKey=cargoId==="random"?pick(Object.keys(CARGO),random):cargoId;
  const cargo=CARGO[cargoKey];
  if(!cargo) throw new Error(`Unknown cargo category: ${cargoId}`);
  const cargoReference=pick(GAME_REFERENCE_CATALOG.cargo[world].filter(item=>item.scenarioCategory===cargoKey),random);
  const gameEquipment=cargoReference?.equipmentNames.map(name=>EQUIPMENT[GAME_EQUIPMENT_MAP[name.toLowerCase()]]).filter(Boolean);
  const compatibleEquipment=(gameEquipment?.length?gameEquipment:cargo.equipmentIds.map(id=>EQUIPMENT[id])).filter(item=>item && item.samplePayloadLimitKg>=cargo.weightKg[0]);
  if(!compatibleEquipment.length) throw new Error(`No compatible equipment for ${cargo.name}.`);
  const equipment=pick(compatibleEquipment,random);
  const weightKg=between(cargo.weightKg[0],Math.min(cargo.weightKg[1],equipment.samplePayloadLimitKg),random);
  const distanceMi=between(...route.distanceMi,random);
  const distanceKm=distanceMi*1.609344;
  const isNorthAmerican=route.geography==="north-america";
  const distance={value:Math.round(isNorthAmerican?distanceMi:distanceKm),unit:isNorthAmerican?"mi":"km",status:"illustrative",source:route.source};
  const speedKph=style.speedKph[world];
  const drivingHours=distanceKm/speedKph;
  const fuel=isNorthAmerican
    ? (()=>{const mpg=Number((between(58,72,random)/10*style.fuelFactor).toFixed(1));return {value:Number((distanceMi/mpg).toFixed(1)),unit:"gal US",rate:mpg,rateUnit:"mi/gal",status:"illustrative"}})()
    : (()=>{const litersPer100Km=Math.round(between(28,34,random)*style.fuelFactor);return {value:Math.round(distanceKm/100*litersPer100Km),unit:"L",rate:litersPer100Km,rateUnit:"L/100 km",status:"illustrative"}})();
  const stop=includeStop?{id:"simulated-driver-break",name:"Illustrative driver break",address:null,status:"simulated",note:"Simulated planning stop. No real facility or access is specified."}:null;
  const carrier=includeCompanies
    ? {...pick(CARRIER_REFERENCES[world],random),status:"game-reference-only",relationship:"In-game company reference. This FOS mission is simulated; no actual contract or participation is implied.",source:GAME_REFERENCE_CATALOG.sources[world==="ATS"?"companiesATS":"companiesETS2"]}
    : {name:"Fictional independent carrier",status:"fictional",relationship:"Generated for this simulated scenario."};
  const etaHours=Math.round(drivingHours*10)/10;
  const deadline=new Date(now.getTime()+(drivingHours+style.deadlineBufferHours)*3600000);
  const idSuffix=Math.floor(random()*0xFFFFFF).toString(36).toUpperCase().padStart(5,"0").slice(-5);
  return {
    schemaVersion:1,id:`FOS-${world}-${now.getUTCFullYear()}-${idSuffix}`,createdAt:now.toISOString(),
    world,route:{id:route.id,from:route.from,to:route.to,region:route.region,geography:route.geography,status:route.dataStatus,source:route.source},
    cargo:{...cargo,...(cargoReference?{name:cargoReference.name,gameReference:{id:cargoReference.id,equipmentIds:gameEquipment.map(item=>item.id),source:GAME_REFERENCE_CATALOG.sources[world==="ATS"?"cargoATS":"cargoETS2"]}}:{})},equipment:{...equipment},weightKg,distance,fuel,
    travel:{drivingHours:etaHours,speedKph,status:"illustrative",deadline:deadline.toISOString(),deadlineStatus:"simulated-window"},
    operatingStyle:style.id,carrier,stop,isSimulated:true
  };
}

export function validateMission(mission) {
  const errors=[];
  if(!mission || mission.schemaVersion!==1) return ["Unsupported mission schema."];
  const route=ROUTES.find(item=>item.id===mission.route?.id);
  if(!route || route.world!==mission.world) errors.push("Route does not match the selected world.");
  const cargo=CARGO[mission.cargo?.id];
  const equipment=EQUIPMENT[mission.equipment?.id];
  if(!cargo) errors.push("Unknown cargo profile.");
  const compatibleIds=mission.cargo?.gameReference?.equipmentIds || cargo?.equipmentIds || [];
  if(!equipment || !compatibleIds.includes(equipment.id)) errors.push("Cargo and equipment are incompatible.");
  if(mission.cargo?.gameReference && !GAME_REFERENCE_CATALOG.cargo[mission.world]?.some(item=>item.id===mission.cargo.gameReference.id)) errors.push("Unknown game cargo reference.");
  if(cargo && equipment && (mission.weightKg<cargo.weightKg[0] || mission.weightKg>cargo.weightKg[1] || mission.weightKg>equipment.samplePayloadLimitKg)) errors.push("Cargo weight is outside the sample limits.");
  if(!Number.isFinite(mission.distance?.value) || !["mi","km"].includes(mission.distance?.unit)) errors.push("Distance is missing a valid value or unit.");
  if(!Number.isFinite(mission.travel?.drivingHours) || mission.travel.drivingHours<=0) errors.push("Driving time must be positive.");
  if(!Number.isFinite(mission.fuel?.value) || mission.fuel.value<0) errors.push("Fuel estimate is invalid.");
  return errors;
}
import {GAME_REFERENCE_CATALOG} from "./data/game-reference-catalog.mjs";


