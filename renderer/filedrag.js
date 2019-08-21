/*jslint browser: true*/
/*jslint devel: true*/
/*jslint es6 */
/*global currentColumnDefinition,loadData*/
let file;

// file drag hover
function FileDragHover(e) {
  e.stopPropagation();
  e.preventDefault();
  e.target.className = (e.type === "dragover" ? "hover" : "");
}

// file selection
function FileSelectHandler(e) {

  // cancel event and hover styling
  FileDragHover(e);

  // fetch FileList object
  let files = e.target.files || e.dataTransfer.files;

  if (currentColumnDefinition === undefined || currentColumnDefinition === null || currentColumnDefinition.length < 1) {
    alert('Please load a content type before adding files!');
    return false;
  }
  // Build spreadsheet
  console.log('Spreadsheet',currentColumnDefinition);
  let pathColumn = currentColumnDefinition.findIndex( (element) => element.id === 'local_path_original' );
  let extentColumn = currentColumnDefinition.findIndex( (element) => element.id === 'field_extent' );
  let data = [];
  Array.from(files).forEach( function (file) {
    let path = file.webkitRelativePath;
    if (!path) {
      path = file.name;
    }
    let row = new Array(currentColumnDefinition.length).fill('');
    if (pathColumn > -1) {
      row[pathColumn] = path;
    }
    //Extent, Possible TODO: human-friendly extent.
    if (extentColumn > -1) {
      row[extentColumn] = file.size + ' bytes';
    }
    data.push(row);
  });

  loadData(data, currentColumnDefinition);

}

// call initialization file
if (window.File && window.FileList && window.FileReader) {
  Init();
}

//
// initialize
function Init() {
  let fileselect = document.getElementById("fileselect");
  let filedrag = document.getElementById("filedrag");
  let submitbutton = document.getElementById("submitbutton");

  // file select
  fileselect.addEventListener("change", FileSelectHandler, false);

  // is XHR2 available?
  let xhr = new XMLHttpRequest();
  if (xhr.upload) {
    // file drop
    filedrag.addEventListener("dragover", FileDragHover, false);
    filedrag.addEventListener("dragleave", FileDragHover, false);
    filedrag.addEventListener("drop", FileSelectHandler, false);
    filedrag.style.display = "block";

    // remove submit button
    submitbutton.style.display = "none";
  }

}
