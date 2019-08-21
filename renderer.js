// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const ipc = require('electron').ipcRenderer
const asyncRunButton = document.getElementById('runButton')
const asyncCheckButton = document.getElementById('checkButton')
const asyncShowEditorButton = document.getElementById('showEditorButton')

asyncCheckButton.addEventListener('click', function () {
  document.getElementById('workbench-exit').innerHTML = ''
  document.getElementById('workbench-output').innerHTML = ''	
  ipc.send('asynchronous-message', 'check')
})

asyncRunButton.addEventListener('click', function () {
  document.getElementById('workbench-exit').innerHTML = ''
  document.getElementById('workbench-output').innerHTML = ''
  ipc.send('asynchronous-message', '')
})

asyncShowEditorButton.addEventListener('click', function () {
  ipc.send('add-editor-window')
})

ipc.on('asynchronous-reply', function (event, arg) {
  document.getElementById('workbench-output').innerHTML = document.getElementById('workbench-output').innerHTML + '<br />' + arg
})

ipc.on('workbench-exit', function (event, arg) {
  document.getElementById('workbench-exit').innerHTML = arg
})

ipc.on('workbench-config-file', function (event, arg) {
  document.getElementById('workbench-config-file').innerHTML = arg
})
