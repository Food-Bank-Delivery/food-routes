/**
 * Top level namespace
 */
fdel = {
    formNode: undefined,
    map: undefined,
    markerLayer: undefined,
    rowTemplate: undefined,
    geoCache: {},
    data: []
};


/**
 * Set up the Leaflet map with OSM tiles and a marker group
 */
fdel.setupMap = function () {
    fdel.map = L.map('map-node').setView([45.42, -75.69], 13);
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
    }
    
    var query = "https://nominatim.openstreetmap.org/search?format=json&country=Canada&city=Ottawa&street=" + encodeURIComponent(address);
    var request = new XMLHttpRequest();
    if (!func) {
        func = console.log;
    }
    if (!err) {
        err = alert;
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
                err("Cannot find address.\n\n" + address);
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
        entry[fields[i].name] = fields[i].value;
    }
    return entry;
};


/**
 * Scan whole form and update fdel.data
 */
fdel.rescanData = function () {
    var rows = fdel.formNode.getElementsByTagName("fieldset");
    var data = [];
    for (var i = 0; i < rows.length; i++) {
        data.push(fdel.scanRow(rows[i]));
    }
    fdel.data = data;
};


/**
 * Redraw the map with all current addresses.
 */
fdel.updateMap = function () {
    fdel.markerLayer.clearLayers();
    fdel.data.forEach(function (delivery) {
        if (delivery.address) {
            fdel.geocode(delivery.address, function (latlon, fullAddress) {
                var marker = L.marker(latlon, { title: fullAddress });
                marker.addTo(fdel.markerLayer);
            });
        }
    });
    fdel.map.fitBounds(fdel.markerLayer.getBounds());
};


/**
 * Rebuild the form from fdel.data (e.g. after a reload)
 */
fdel.rebuildForm = function () {
    fdel.formNode.innerHTML = "";
    for (var i = 0; i < fdel.data.length; i++) {
        var entry = fdel.data[i];
        var row = fdel.rowTemplate.cloneNode(true);
        var fields = row.getElementsByTagName("input");
        for (var j = 0; j < fields.length; j++) {
            fields[j].value = entry[fields[j].name];
        }
        fdel.formNode.appendChild(row);
    }
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
            fields[i].onchange = fdel.doChange;
        } else {
            fields[i].value = "";
            fields[i].onblur = fdel.doChange;
        }
    }
    fdel.formNode.appendChild(row);
    fdel.doChange();
};


/**
 * Remove a delivery row from the form
 */
fdel.removeRow = function (node) {
    var row = node.closest("fieldset");
    var data = fdel.scanRow(row);
    if (!data.address || confirm("Delete delivery?\n\n" + data.address)) {
        fdel.formNode.removeChild(row);
        fdel.doChange();
    }
};


/**
 * Update data whenever the user leaves a form field.
 */
fdel.doChange = function (node) {
    fdel.rescanData();
    if (fdel.data.length == 0) {
        fdel.data = [{
            quantity: 1,
            address: "",
            notes: ""
        }];
        fdel.rebuildForm();
    } else {
        fdel.updateMap();
    }
    window.location.hash = JSON.stringify(fdel.data);
};


/**
 * Set up once the document finishes loading.
 */
window.onload = function () {
    fdel.formNode = document.getElementById("deliveries");

    // Add change handler to all form inputs
    var fields = fdel.formNode.getElementsByTagName("input");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].type == "number") {
            fields[i].onchange = fdel.doChange;
        } else {
            fields[i].onblur = fdel.doChange;
        }
    }

    // Grab a template for a row (delivery)
    fdel.rowTemplate = document.getElementsByTagName("fieldset")[0].cloneNode(true);

    // Check for saved data in the URL
    if (window.location.hash) {
        fdel.data = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
        fdel.rebuildForm();
    }

    // Set up map
    fdel.setupMap();
};
