/**
 * Top level namespace
 */
fdel = {
    map: undefined,
    markerLayer: undefined,
    geoCache: {},
    data: {
        entries: []
    },
    locations: {
        crcrr: ["Rideau-Rockcliffe Community Resource Centre", "815 St Laurent Blvd"],
        cscvanier: ["Partage Vanier Food Bank", "290 Dupuis St."]
    }
};


/**
 * Set up the Leaflet map with OSM tiles and a marker group
 */
fdel.setupMap = function () {
    fdel.map = L.map('map-node').setView([45.42, -75.69], 13);
    L.control.scale().addTo(fdel.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(fdel.map);
    fdel.markerLayer = L.featureGroup();
    fdel.markerLayer.addTo(fdel.map);
    fdel.updateMap();
};



/**
 * Geocode an address for mapping (assumes Ottawa).
 * Call func with the lat, lon on success
 */
fdel.geocode = function (address, func, err) {

    // be nice and cache
    if (address in fdel.geoCache) {
        var a = fdel.geoCache[address];
        func(a[0], a[1]);
        return;
    }
    
    var query = "https://nominatim.openstreetmap.org/search?format=json&country=Canada&city=Ottawa&street=" + encodeURIComponent(address);
    var request = new XMLHttpRequest();
    if (!func) {
        func = console.log;
    }
    if (!err) {
        err = console.error;
    }

    request.onreadystatechange = function () {
        if (request.readyState == XMLHttpRequest.DONE) {
            var geodata = JSON.parse(request.responseText);
            if (geodata.length > 0) {
                latlon = [geodata[0].lat, geodata[0].lon];
                fullAddress = geodata[0].display_name;
                fdel.geoCache[address] = [latlon, fullAddress];
                func(latlon, fullAddress);
            } else {
                fdel.geoCache[address] = false;
                func(false, false);
            }
        }
    };
    request.onerror = function () {
        err("API error in Nominatim geocoder.\n\n" + address);
        fdel.geoCache[address] = false;
    };
    request.open("GET", query);
    request.send();
};


/**
 * Scan a single fieldset (data row)
 */
fdel.scanRow = function (node) {
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
 * Scan whole form and update fdel.data.entries
 */
fdel.rescanData = function () {

    fdel.data.route = fdel.formNode.route.value;
    fdel.data.date = fdel.formNode.date.value;
    fdel.data.pickup = fdel.formNode.pickup.value;

    var rows = fdel.stopsNode.getElementsByTagName("fieldset");
    var data = [];
    for (var i = 0; i < rows.length; i++) {
        data.push(fdel.scanRow(rows[i]));
    }
    fdel.data.entries = data;
};


/**
 * Redraw the map with all current addresses.
 */
fdel.updateMap = function () {

    fdel.markerLayer.clearLayers();

    var counter = 0;
    fdel.data.entries.forEach((entry, i) => {
        if (entry.address) {
            var add = () => {
                fdel.geocode(entry.address, (latlon, fullAddress) => {
                    if (latlon === false) {
                        alert("Cannot find address " + entry.address);
                    } else {
                        var icon = new L.AwesomeNumberMarkers({"number": i+1});
                        var marker = L.marker(latlon, { title: fullAddress, icon: icon });
                        marker.addTo(fdel.markerLayer);
                        fdel.recenterMap();
                    }
                });
            };

            setTimeout(add, 1500 * i);
        }
    });
};

fdel.recenterMap = function () {
    var bounds = fdel.markerLayer.getBounds();
    fdel.map.fitBounds(bounds.pad(0.25));
};


/**
 * Rebuild the form from fdel.data.entries (e.g. after a reload)
 */
fdel.rebuildForm = function () {
    fdel.stopsNode.innerHTML = "";

    if (fdel.data.entries.length == 0) {
        fdel.data.entries = [
            {
                "quantity": 1,
                "address": "",
                "notes": ""
            }
        ];
    }

    fdel.data.entries.forEach((entry, i) => {
        var row = fdel.rowTemplate.cloneNode(true);
        var fields = row.getElementsByTagName("input");
        for (var j = 0; j < fields.length; j++) {
            fields[j].value = entry[fields[j].name];
        }
        fdel.stopsNode.appendChild(row);
    });

    fdel.formNode.route.value = fdel.data.route;
    fdel.formNode.date.value = fdel.data.date;
    fdel.formNode.pickup.value = fdel.data.pickup;
};


/**
 * Add a new delivery row to the form
 */
fdel.addRow = function () {
    var row = fdel.rowTemplate.cloneNode(true);
    var fields = row.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            fields[i].value = "1";
            fields[i].addEventListener("change", fdel.doChange);
        } else {
            fields[i].value = "";
            fields[i].addEventListener("change", fdel.doChange);
        }
    }
    fdel.stopsNode.appendChild(row);
};


/**
 * Remove a delivery row from the form
 */
fdel.removeRow = function (node) {
    var row = node.closest("fieldset");
    var data = fdel.scanRow(row);
    if (!data.address || confirm("Delete delivery?\n\n" + data.address)) {
        fdel.stopsNode.removeChild(row);
        fdel.doChange();
    }
};


/**
 * Draw a static display of the route in route.html
 */
fdel.displayRoute = function () {

    function set (id, value) {
        var node = document.getElementById(id);
        if (node) {
            node.textContent = value;
        } else {
            console.error("No element with id", id);
        }
    }

    if (fdel.data.route) {
        var routeName = fdel.data.route;
        document.getElementsByTagName("h1")[0].textContent = routeName;
        if (fdel.data.date) {
            routeName += " (" + fdel.data.date + ")";
        }
        document.title = routeName;
    }

    var totalBoxes = 0;
    var totalStops = 0;
    
    fdel.data.entries.forEach((entry, i) => {
        var rowNode = document.createElement("tr");
        var cellNode;

        if (entry.address) {

            console.log(entry);

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

            fdel.routeNode.appendChild(rowNode);
        }
    });

    var location = fdel.locations[fdel.data.pickup];

    set("v.quantity", totalBoxes);
    if (totalBoxes != 1) {
        set("v.plural", "es");
    }
    set("v.facility", location[0]);
    set("v.address", location[1]);
    set("v.date",new Date(fdel.data.date).toDateString());

};


/**
 * Update data whenever the user leaves a form field.
 */
fdel.doChange = function (node) {
    fdel.rescanData();
    if (fdel.data.entries.length == 0) {
        fdel.data.entries = [{
            quantity: 1,
            address: "",
            notes: ""
        }];
        fdel.rebuildForm();
    } else {
        fdel.updateMap();
    }
    window.location.hash = JSON.stringify(fdel.data);
    fdel.linkNode.setAttribute("href", "route.html" + window.location.hash);
    return true;
};


fdel.setupCommon = function () {
    // Check for saved data in the URL
    if (window.location.hash) {
        fdel.data = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
    }
};

/**
 * Set up once the document finishes loading.
 */
fdel.setupEdit = function () {
    fdel.formNode = document.getElementById("deliveries");
    fdel.formNode.addEventListener("submit", fdel.doChange);

    fdel.stopsNode = document.getElementById("stops");

    fdel.linkNode = document.getElementById("share");
    fdel.linkNode.setAttribute("href", "route.html" + window.location.hash);

    // Add change handler to all form inputs
    var fields = fdel.formNode.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            fields[i].addEventListener("change", fdel.doChange);
        } else {
            fields[i].addEventListener("change", fdel.doChange);
        }
    }

    // Grab a template for a row (delivery)
    fdel.rowTemplate = document.getElementById("stops").getElementsByTagName("fieldset")[0].cloneNode(true);

    fdel.setupCommon();
    fdel.rebuildForm();
    fdel.setupMap();
};


fdel.setupRoute = function () {
    fdel.setupCommon();
    fdel.routeNode = document.getElementById("route-node");
    fdel.stopsNode = document.getElementById("total-stops");
    fdel.boxesNode = document.getElementById("total-boxes");
    fdel.displayRoute();
    fdel.setupMap();
};


