////////////////////////////////////////////////////////////////////////
// Script to support the food-routes app
////////////////////////////////////////////////////////////////////////

/**
 * Top level namespace
 */
froutes = {
    map: undefined,
    markerLayer: undefined,
    geoCache: {},
    data: {
        route: "Food-bank delivery",
        pickup: "crcrr",
        date: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("iso"),
        time: "09:00",
        entries: []
    },
    locations: { // TODO: move this to a separate file for easier maintenance
        crcrr: {
            name: "Rideau-Rockcliffe Community Resource Centre",
            address: "815 St Laurent Blvd"
        },
        cscvanier: {
            name: "Partage Vanier Food Bank",
            address: "290 Dupuis St."
        }
    }
};


/**
 * Set up the Leaflet map with OSM tiles and a marker group
 *
 * One-time setup; use froutes.updateMap() to redraw
 */
froutes.setupMap = function () {
    froutes.map = L.map('map-node').setView([45.42, -75.69], 13);
    L.control.scale().addTo(froutes.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(froutes.map);
    froutes.markerLayer = L.featureGroup();
    froutes.markerLayer.addTo(froutes.map);
    froutes.updateMap();
};



/**
 * Geocode an address for mapping (assumes Ottawa, for now).
 *
 * Calls the provided func with the [lat, lon] and full address string
 * on success, e.g.
 *
 * func(latlon, fullAddress)
 */
froutes.geocode = function (address, func, err) {

    // be nice to the Nominatim geocoder and cache
    if (address in froutes.geoCache) {
        var a = froutes.geoCache[address];
        func(a[0], a[1]);
        return;
    }

    // construct the geocoding query string
    var query = "https://nominatim.openstreetmap.org/search?format=json&country=Canada&city=Ottawa&street=" + encodeURIComponent(address);

    // asynchronous request
    var request = new XMLHttpRequest();
    if (!func) {
        func = console.log;
    }
    if (!err) {
        err = console.error;
    }

    // result handler
    request.onreadystatechange = () => {
        if (request.readyState == XMLHttpRequest.DONE) {
            var geodata = JSON.parse(request.responseText);
            if (geodata.length > 0) {
                latlon = [geodata[0].lat, geodata[0].lon];
                fullAddress = geodata[0].display_name;
                froutes.geoCache[address] = [latlon, fullAddress];
                func(latlon, fullAddress);
            } else {
                froutes.geoCache[address] = false;
                func(false, false);
            }
        }
    };

    // error handler
    request.onerror = () => {
        err("API error in Nominatim geocoder.\n\n" + address);
        froutes.geoCache[address] = false;
    };

    // OK, we're all set up, set the geocoding request to Nominatim
    request.open("GET", query);
    request.send();
};


/**
 * Scan a single fieldset (data row)
 */
froutes.scanRow = function (node) {
    var entry = {};
    var fields = node.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            entry[fields[i].name] = Number(fields[i].value);
        } else {
            entry[fields[i].name] = fields[i].value;
        }
    }
    return entry;
};


/**
 * Scan whole form and update froutes.data.entries
 */
froutes.rescanData = function () {

    froutes.data.route = froutes.formNode.route.value;
    froutes.data.pickup = froutes.formNode.pickup.value;
    froutes.data.date = froutes.formNode.date.value;
    froutes.data.time = froutes.formNode.time.value;

    var rows = froutes.stopsNode.getElementsByTagName("fieldset");
    var data = [];
    for (var i = 0; i < rows.length; i++) {
        data.push(froutes.scanRow(rows[i]));
    }
    froutes.data.entries = data;
};


/**
 * Redraw the map with all current addresses.
 */
froutes.updateMap = function () {

    function esc (text) {
        var node = document.createElement("span");
        node.textContent = text;
        return node.innerHTML;
    }

    function add (address, num, name) {
        froutes.geocode(address, (latlon, fullAddress) => {
            if (latlon === false) {
                alert("Cannot find address " + address);
            } else {
                var icon;
                if (num == "*") {
                    // This is the food bank; use Unicode package character
                    var icon = new L.AwesomeNumberMarkers({number: "\u{1F4E6}", markerColor: "green"});
                } else {
                    // Use a number
                    var icon = new L.AwesomeNumberMarkers({number: num});
                }
                var title = (name ? name + "\n" : "") + address;
                var marker = L.marker(latlon, { title: title, icon: icon });
                marker.bindPopup(
                    (name ? "<b>" + esc(name) + "</b><br/><br/>" : "") + esc(fullAddress)
                );
                marker.addTo(froutes.markerLayer);
                froutes.recenterMap();
            }
        });
    };

    var pickup = froutes.locations[froutes.data.pickup];

    froutes.markerLayer.clearLayers();

    setTimeout(() => add(pickup.address, "*", pickup.name), 1500);

    froutes.data.entries.forEach((entry, i) => {
        if (entry.address) {
            setTimeout(() => add(entry.address, i + 1), 1500 * (i + 2));
        }
    });
};

froutes.recenterMap = function () {
    var bounds = froutes.markerLayer.getBounds();
    froutes.map.fitBounds(bounds.pad(0.25));
};


/**
 * Rebuild the form from froutes.data.entries (e.g. after a reload)
 */
froutes.rebuildForm = function () {
    froutes.stopsNode.innerHTML = "";

    if (froutes.data.entries.length == 0) {
        froutes.data.entries = [
            {
                "quantity": 1,
                "address": "",
                "notes": ""
            }
        ];
    }

    froutes.data.entries.forEach((entry, i) => {
        var row = froutes.rowTemplate.cloneNode(true);
        var fields = row.getElementsByTagName("input");
        for (var j = 0; j < fields.length; j++) {
            fields[j].value = entry[fields[j].name];
        }
        froutes.stopsNode.appendChild(row);
    });

    froutes.formNode.route.value = froutes.data.route;
    froutes.formNode.pickup.value = froutes.data.pickup;
    froutes.formNode.date.value = froutes.data.date;
    froutes.formNode.time.value = froutes.data.time;
};


/**
 * Add a new delivery row to the form
 */
froutes.addRow = function () {
    var row = froutes.rowTemplate.cloneNode(true);
    var fields = row.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            fields[i].value = "1";
            fields[i].addEventListener("change", froutes.doChange);
        } else {
            fields[i].value = "";
            fields[i].addEventListener("change", froutes.doChange);
        }
    }
    froutes.stopsNode.appendChild(row);
};


/**
 * Remove a delivery row from the form
 */
froutes.removeRow = function (node) {
    var row = node.closest("fieldset");
    var data = froutes.scanRow(row);
    if (!data.address || confirm("Delete delivery?\n\n" + data.address)) {
        froutes.stopsNode.removeChild(row);
        froutes.doChange();
    }
};


/**
 * Draw a static display of the route in route.html
 */
froutes.displayRoute = function () {

    function set (id, value) {
        var node = document.getElementById(id);
        if (node) {
            node.textContent = value;
        } else {
            console.error("No element with id", id);
        }
    }

    if (froutes.data.route) {
        var routeName = froutes.data.route;
        document.getElementsByTagName("h1")[0].textContent = routeName;
        if (froutes.data.date) {
            routeName += " (" + froutes.data.date + ")";
        }
        document.title = routeName;
    }

    var totalBoxes = 0;
    var totalStops = 0;
    
    froutes.data.entries.forEach((entry, i) => {
        var rowNode = document.createElement("tr");
        var cellNode;

        if (entry.address) {

            totalBoxes += Number(entry.quantity);
            totalStops++;
            
            cellNode = document.createElement("th");
            cellNode.className = "num";
            cellNode.textContent = "" + (i + 1)
            rowNode.appendChild(cellNode);
            
            cellNode = document.createElement("td");
            cellNode.textContent = entry.address;
            rowNode.appendChild(cellNode);

            cellNode = document.createElement("td");
            cellNode.className = "quantity";
            cellNode.textContent = "" + entry.quantity;
            rowNode.appendChild(cellNode);

            cellNode = document.createElement("td");
            cellNode.setAttribute("class", "notes");
            cellNode.textContent = entry.notes;
            rowNode.appendChild(cellNode);

            froutes.routeNode.appendChild(rowNode);
        }
    });

    var location = froutes.locations[froutes.data.pickup];

    set("v.quantity", totalBoxes);
    if (totalBoxes != 1) {
        set("v.plural", "es");
    }
    set("v.facility", location.name);
    set("v.address", location.address);
    set("v.date", new Date(froutes.data.date).toDateString());
    set("v.time", froutes.data.time);
};


/**
 * Update data whenever the user leaves a form field.
 */
froutes.doChange = function (node) {
    froutes.rescanData();
    if (froutes.data.entries.length == 0) {
        froutes.data.entries = [{
            quantity: 1,
            address: "",
            notes: ""
        }];
        froutes.rebuildForm();
    } else {
        froutes.updateMap();
    }
    window.location.hash = JSON.stringify(froutes.data);
    froutes.linkNode.setAttribute("href", "route.html" + window.location.hash);
    return true;
};



////////////////////////////////////////////////////////////////////////
// Post-load setup functions (called by pages
////////////////////////////////////////////////////////////////////////

/**
 * Setup the edit.html page (called by the page after load)
 */
froutes.setupEdit = function () {
    froutes.formNode = document.getElementById("deliveries");
    froutes.formNode.addEventListener("submit", froutes.doChange);

    froutes.stopsNode = document.getElementById("stops");

    froutes.linkNode = document.getElementById("share");
    froutes.linkNode.setAttribute("href", "route.html" + window.location.hash);

    var sel = froutes.formNode.pickup;
    for (key in froutes.locations) {
        var location = froutes.locations[key];
        var node = document.createElement("option");
        node.textContent = location.name;
        node.value = key;
    }

    // Add change handler to all form inputs
    var fields = froutes.formNode.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            fields[i].addEventListener("change", froutes.doChange);
        } else {
            fields[i].addEventListener("change", froutes.doChange);
        }
    }

    // Grab a template for a row (delivery)
    froutes.rowTemplate = document.getElementById("stops").getElementsByTagName("fieldset")[0].cloneNode(true);

    froutes.setupCommon();
    froutes.rebuildForm();
    froutes.setupMap();
};


/**
 * Setup the route.html page (called by the page after load)
 */
froutes.setupRoute = function () {
    froutes.setupCommon();
    froutes.routeNode = document.getElementById("route-node");
    froutes.stopsNode = document.getElementById("total-stops");
    froutes.boxesNode = document.getElementById("total-boxes");
    froutes.displayRoute();
    froutes.setupMap();
};


/**
 * Common setup for all pages.
 */
froutes.setupCommon = function () {
    // Check for saved data in the URL
    if (window.location.hash) {
        var data = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
        // keep default values if they're missing from the URL hash
        for (key in data) {
            if (data[key]) {
                froutes.data[key] = data[key];
            }
        }
    }
};


// end
