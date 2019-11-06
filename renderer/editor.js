/*jslint devel: true*/
/*jslint es6 browser*/
/*jslint node: true*/
/*global Editor*/

// LOAD CONFIGURATION
const {app, dialog} = require('electron').remote;
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
    let pathColumn = editor.currentColumnDefinition.findIndex((element) => element.id === 'file');
    let extentColumn = editor.currentColumnDefinition.findIndex((element) => element.id === 'field_extent');
    let data = [];
    // console.log(input_dir);
    editor.setInputDir(input_dir.path);
    (function () {
        let walker = walk.walk(input_dir.path);
        walker.on("file", function (root, fileStats, next) {
            let row = new Array(editor.currentColumnDefinition.length).fill('');
            if (pathColumn > -1) {
                row[pathColumn] = path.join(root, fileStats.name).substr(input_dir.path.length + 1);
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

editor.listContentTypes(contentTypesSelect);

contentTypesButton.addEventListener('click', function () {
    editor.loadContentType();
});


const ipc = require('electron').ipcRenderer;

function saveCSV() {  
  // We copy the data so we can add the header separately.
  let data = Array.from(editor.spreadsheet.getData());

  // Filter empty lines. (PapaParse can't do it because boolean fields become the string 'false' instead of blank.)
  data = data.filter(function(row){
    let notEmpty = false; 
    row.forEach(function(item){ 
      if(item !== false && item.length > 0){
        notEmpty = true;
      }
    });
    return notEmpty;
  });

  // Field machine names as headers.
  data.unshift(editor.currentColumnDefinition.map(x => x.id));
  // TEMPORARY!! Add uuid column to data on save. Ideally this is done on the editor so they can be updated. This is for testing first.
  if (document.getElementById('generate_uuid_checkbox').checked) {
    editor.workbenchConfig.id_field = 'uuid';
    data.forEach( function (item, index) {
      if(index === 0) {
        item.push('uuid');
      } else {
        // UUID from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
        uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
        item.push(uuid);
      }
    });
  }

  // console.log(data);
  // Serialize it.
  csv = Papa.unparse(data, {skipEmptyLines: true});
  
  // We also need to build a new configuration file that includes
  // which content type we selected and the csv path to pass to
  // the workbench.
  let configPath = path.join(app.getAppPath(), 'config-to-load.yml');
  // dialog.showMessageBoxSync(editorWindow, {
  //   type: 'info',
  //   title: 'Saving Config',
  //   message: 'Saving the current config for loading into Islandora.',
  //   detail: configPath,
  // });
  fs.writeFileSync(configPath,yaml.safeDump(editor.workbenchConfig),'utf-8');
  let csvPath = path.join(config.input_dir, 'metadata.csv');
  // dialog.showMessageBoxSync(editorWindow, {
  //   type: 'info',
  //   title: 'Saving CSV',
  //   message: 'Saving the current CSV for loading into Islandora.',
  //   detail: csvPath,
  // });
  fs.writeFileSync(csvPath,csv,'utf-8');
  return csvPath;
    // ipc.send('run-workbench', config, true);
}

// EXPORT & UPLOAD EVENTS

const saveCsvButton = document.getElementById('save_button');
saveCsvButton.addEventListener('click', function(){
  let csvPath = saveCSV();
  dialog.showMessageBox({
    type: 'info',
    title: 'Saved CSV',
    message: 'Saved the CSV.',
    detail: csvPath,
  });
})
const saveCheckButton = document.getElementById('save_check_button');
saveCheckButton.addEventListener('click', function(){
  let csvPath = saveCSV();
  ipc.send('run-workbench', path.join(app.getAppPath(), 'config-to-load.yml'), true);
})
const uploadButton = document.getElementById('upload_button');
uploadButton.addEventListener('click', function(){
  saveCSV();
  ipc.send('run-workbench', path.join(app.getAppPath(), 'config-to-load.yml'));
});