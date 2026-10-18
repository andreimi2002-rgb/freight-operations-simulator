/*
 * Selected reference data derived from Truck Simulator Wiki pages.
 * This file is maintained separately under CC BY-SA 4.0; see ../DATA-LICENSES.md.
 * Game names remain subject to their owners' rights. FOS is unofficial.
 */
export const GAME_REFERENCE_CATALOG = {
  license:"CC BY-SA 4.0",
  attribution:"Truck Simulator Wiki contributors",
  sources:{
    cargoATS:"https://trucksimulator.wiki.gg/wiki/Cargo_types/American_Truck_Simulator",
    cargoETS2:"https://trucksimulator.wiki.gg/wiki/Cargo_types/Euro_Truck_Simulator_2",
    companiesATS:"https://trucksimulator.wiki.gg/wiki/Companies/American_Truck_Simulator",
    companiesETS2:"https://trucksimulator.wiki.gg/wiki/Companies/Euro_Truck_Simulator_2",
    license:"https://trucksimulator.wiki.gg/wiki/Truck_Simulator_Wiki:Copyrights"
  },
  cargo:{
    ATS:[
      {id:"ats-grain",name:"Grain",scenarioCategory:"industrial",equipmentNames:["Grain Hopper","Bulk Feed","Dry Bulk","Hopper"]},
      {id:"ats-gravel",name:"Gravel",scenarioCategory:"industrial",equipmentNames:["Dumper"]},
      {id:"ats-guard-rails",name:"Guard Rails",scenarioCategory:"timber",equipmentNames:["Dry Van","Sliding Tarp"]},
      {id:"ats-gypsum",name:"Gypsum",scenarioCategory:"industrial",equipmentNames:["Sliding Tarp"]},
      {id:"ats-harvester",name:"Harvester",scenarioCategory:"vehicles",equipmentNames:["Lowboy"]},
      {id:"ats-hydrochloric-acid",name:"Hydrochloric Acid",scenarioCategory:"chemicals",equipmentNames:["Chemical Tank"]},
      {id:"ats-haul-truck-chassis",name:"Haul Truck Chassis",scenarioCategory:"vehicles",equipmentNames:["Lowboy"]},
      {id:"ats-wood-chipper",name:"Wood Chipper",scenarioCategory:"timber",equipmentNames:["Drop Deck","Lowboy"]},
      {id:"ats-yogurt",name:"Yogurt",scenarioCategory:"food",equipmentNames:["Refrigerated"]}
    ],
    ETS2:[
      {id:"ets-barley",name:"Barley",scenarioCategory:"industrial",equipmentNames:["Dumper","Silo"]},
      {id:"ets-beef",name:"Beef",scenarioCategory:"food",equipmentNames:["Refrigerated"]},
      {id:"ets-bricks",name:"Bricks",scenarioCategory:"timber",equipmentNames:["Curtainsider","Dry Freighter"]},
      {id:"ets-cars",name:"Cars",scenarioCategory:"vehicles",equipmentNames:["Car Transporter"]},
      {id:"ets-cement",name:"Cement",scenarioCategory:"industrial",equipmentNames:["Silo"]},
      {id:"ets-chemicals",name:"Chemicals",scenarioCategory:"chemicals",equipmentNames:["Chemical Tank"]},
      {id:"ets-cauliflower",name:"Cauliflower",scenarioCategory:"food",equipmentNames:["Refrigerated","Insulated"]},
      {id:"ets-cod",name:"Atlantic Cod Fillet",scenarioCategory:"food",equipmentNames:["Insulated","Refrigerated"]}
    ]
  },
  companies:{
    ATS:[
      {name:"42 Print",industry:"Printing"},{name:"ABQ Cargo Center",industry:"Airport logistics"},
      {name:"AI Automotive",industry:"Vehicle parts manufacturing and distribution"},{name:"Alis Cars",industry:"Passenger vehicle retail"},
      {name:"American Lines",industry:"Railroad construction"},{name:"Angel City Airport",industry:"Airport logistics"},
      {name:"Antlion",industry:"Heavy machinery manufacturing"},{name:"Apex Steel",industry:"Metal processing"}
    ],
    ETS2:[
      {name:"Adrica",industry:"Port logistics"},{name:"AeroBaltica",industry:"Airport logistics"},
      {name:"Agrominta UAB",industry:"Farming"},{name:"Agronord",industry:"Crop farming"},
      {name:"Ateria AS",industry:"Food processing"},{name:"EuroAcres",industry:"Farming"},
      {name:"EuroGoodies",industry:"Food distribution"},{name:"Icaria Logistic Company",industry:"Port logistics"}
    ]
  }
};
