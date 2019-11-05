/*jslint devel: true*/
/*jslint es6 browser*/
/*jslint node: true*/
/*global Editor*/

// LOAD CONFIGURATION

const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const Store = require('electron-store');
const store = new Store();
let config = {};
if (store.get('workbench.current-config-file') === "undefined") {
    event.sender.send('workbench-config-file', 'No configuration file selected.');
} else {
    config = yaml.safeLoad(fs.readFileSync(store.get('workbench.current-config-file'), 'utf8'));
}

// LOAD CONTENT TYPES FORM

const contentTypesSelect = document.getElementById('content_type_select');
const contentTypesButton = document.getElementById('content_types_button');

let editor = new Editor('spreadsheet', config);

editor.listContentTypes(contentTypesSelect);

contentTypesButton.addEventListener('click', function () {
    editor.loadContentType();
});

const fileselect = document.getElementById("fileselect");

// LOAD FILES FORM

const walk = require('walk');

// file selection
function fileSelectHandler(e) {

    // cancel event and hover styling
    // fileDragHover(e);
    if (editor.currentColumnDefinition === undefined || editor.currentColumnDefinition === null || editor.currentColumnDefinition.length < 1) {
        alert('Please load a content type before adding files!');
        return false;
    }
    
    if (e.target.files.length < 1) {
        alert('File Select Handler called without selecting a directory!');
        return false;
    }
    let input_dir = e.target.files[0];
    
    // Build spreadsheet
    let pathColumn = editor.currentColumnDefinition.findIndex((element) => element.id === 'local_path_original');
    let extentColumn = editor.currentColumnDefinition.findIndex((element) => element.id === 'field_extent');
    let data = [];
    // console.log(input_dir);
    editor.setInputDir(input_dir.path);
    (function () {
        let walker = walk.walk(input_dir.path);
        walker.on("file", function (root, fileStats, next) {
            let row = new Array(editor.currentColumnDefinition.length).fill('');
            if (pathColumn > -1) {
                row[pathColumn] = path.join(root, fileStats.name);
            }
            if (extentColumn > -1) {
                row[extentColumn] = fileStats.size + ' bytes';
            }
            data.push(row);
            next();
        });
        walker.on("errors", function (root, nodeStatsArray, next) {
            next();
        });
        walker.on("end", function () {
            editor.loadData(data, editor.currentColumnDefinition);
        });
    }());

}

// file select
fileselect.addEventListener("change", fileSelectHandler, false);

// EXPORT CSV

const ipc = require('electron').ipcRenderer;

function saveCSV(csv, config) {
    ipc.send('save-csv', csv, config);
}