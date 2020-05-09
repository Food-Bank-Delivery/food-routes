/**
 * Top level namespace
 */
fdel = {
    form_node: undefined,
    rowTemplate: undefined,
    data: []
};

/**
 * Scan the form and create a JSON data structure.
 */
fdel.rescanData = function () {
    var rows = fdel.form_node.getElementsByTagName("fieldset");
    var data = [];
    for (var i = 0; i < rows.length; i++) {
        var entry = {};
        var fields = rows[i].getElementsByTagName("input");
        for (var j = 0; j < fields.length; j++) {
            entry[fields[j].name] = fields[j].value;
        }
        data.push(entry);
    }
    fdel.data = data;
};


/**
 * Rebuild the form from the saved data
 */
fdel.rebuildForm = function () {
    fdel.form_node.innerHTML = "";
    for (var i = 0; i < fdel.data.length; i++) {
        var entry = fdel.data[i];
        var row = fdel.rowTemplate.cloneNode(true);
        var fields = row.getElementsByTagName("input");
        for (var j = 0; j < fields.length; j++) {
            fields[j].value = entry[fields[j].name];
        }
        fdel.form_node.appendChild(row);
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
    fdel.form_node.appendChild(row);
    fdel.doChange();
};


/**
 * Remove a delivery row from the form
 */
fdel.removeRow = function (node) {
    if (confirm("Delete delivery?")) {
        var row = node.closest("fieldset");
        fdel.form_node.removeChild(row);
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
    }
    window.location.hash = JSON.stringify(fdel.data);
};


/**
 * Set up once the document finishes loading.
 */
window.onload = function () {
    fdel.form_node = document.getElementById("deliveries");

    // Add change handler to all form inputs
    var fields = fdel.form_node.getElementsByTagName("input");
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
};
