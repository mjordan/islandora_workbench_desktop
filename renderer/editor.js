/*jslint devel: true*/
/*jslint es6 browser*/
/*jslint node: true*/
/*global Editor*/

const fs = require('fs');
const path = require('path');
const walk = require('walk');

const contentTypesSelect = document.getElementById('content_type_select');
const contentTypesButton = document.getElementById('content_types_button');

let editor = new Editor('spreadsheet');

editor.listContentTypes(contentTypesSelect);

contentTypesButton.addEventListener('click', function () {
    editor.loadContentType();
});

const fileselect = document.getElementById("fileselect");
const filedrag = document.getElementById("filedrag");
const submitbutton = document.getElementById("submitbutton");


// file drag hover
function fileDragHover(e) {
    e.stopPropagation();
    e.preventDefault();
    e.target.className = (e.type === "dragover" ? "hover" : "");
}

// file selection
function fileSelectHandler(e) {

  // cancel event and hover styling
  fileDragHover(e);

  // fetch FileList object
  let files = e.target.files || e.dataTransfer.files;
  
  if (editor.currentColumnDefinition === undefined || editor.currentColumnDefinition === null || editor.currentColumnDefinition.length < 1) {
    alert('Please load a content type before adding files!');
    return false;
  }
  // Build spreadsheet
  let pathColumn = editor.currentColumnDefinition.findIndex( (element) => element.id === 'local_path_original' );
  let extentColumn = editor.currentColumnDefinition.findIndex( (element) => element.id === 'field_extent' );
  let data = [];
  Array.from(files).forEach( function (file) {
    var walker = walk.walk(file.path);
    walker.on("file", function (root, fileStats, next) {
      // console.log('walker file: ',root,fileStats);
        let row = new Array(editor.currentColumnDefinition.length).fill('');
        if (pathColumn > -1) {
          row[pathColumn] = path.join(root, fileStats.name);
        }
        //Extent, Possible TODO: human-friendly extent.
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
      // console.log("Gathered files data:",data);
        editor.loadData(data, editor.currentColumnDefinition);
    });
  });

}

// file select
fileselect.addEventListener("change", fileSelectHandler, false);

// is XHR2 available?
let xhr = new XMLHttpRequest();
if (xhr.upload) {
  // file drop
  filedrag.addEventListener("dragover", fileDragHover, false);
  filedrag.addEventListener("dragleave", fileDragHover, false);
  filedrag.addEventListener("drop", fileSelectHandler, false);
  filedrag.style.display = "block";

  // remove submit button
  submitbutton.style.display = "none";
}