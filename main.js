// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu} = require('electron')
const electron = require('electron')
const path = require('path')

const { dialog } = require('electron')

const Store = require('electron-store');
const store = new Store();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

const menu_template = [{
  label: 'Application',
    submenu: [
      { label: 'Set path to workbench', click: function () { openWorkbenchPathDialog() } },
      { label: 'Return to main window', accelerator: 'CmdOrCtrl+M', click: function () { mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));} },
      { label: 'View log file', accelerator: 'CmdOrCtrl+L', click: function () { mainWindow.loadURL('file://' + path.join(__dirname, 'workbench.log'));} },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
    ]},
    {
    label: 'Task',
    submenu: [
      { label: 'Choose configuration file', accelerator: 'CmdOrCtrl+F', click: function () { openConfigFileDialog() } },
      { label: 'Edit a CSV file (not implemented yet!)', enabled: false },
    ]}
  ]

function openWorkbenchPathDialog () {
  dialog.showOpenDialog(null, { properties: ['openFile'] }, (filePaths) => { store.set('workbench.path-to-workbench', filePaths[0]); } )
}

function openConfigFileDialog () {
  dialog.showOpenDialog(null, { properties: ['openFile'], filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }] }, (filePaths) => { store.set('workbench.current-config-file', filePaths[0]); } )
}

function openCSVFileDialog () {
  // Functionality not yet complete.
}

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Execute workbench.
  const ipc = electron.ipcMain
  ipc.on('asynchronous-message', function (event, arg) {
    if (typeof store.get('workbench.current-config-file') == "undefined") {
      event.sender.send('workbench-config-file', 'No configuration file selected.')
    }

    var workbenchArgs = ['--config', store.get('workbench.current-config-file')]

    let {PythonShell} = require('python-shell');
    if (arg == 'check') {
      workbenchArgs = ['--config', store.get('workbench.current-config-file'), '--check']
    }

    let options = {
      mode: 'text',
      pythonOptions: ['-u'],
      args: workbenchArgs
    }

    if (arg == 'check') {
      event.sender.send('workbench-config-file', 'Checking configuration file ' + store.get('workbench.current-config-file')) + ' and data'
    } else {
      event.sender.send('workbench-config-file', 'Running task using configuration file ' + store.get('workbench.current-config-file'))
    }

    let shell = new PythonShell(store.get('workbench.path-to-workbench'), options);
    shell.on('message', function (message) {
      event.sender.send('asynchronous-reply', message)
    });

    shell.on('close', function (message) {
      if (arg == 'check') {
        event.sender.send('workbench-exit', 'Islandora Workbench has finished checking configuration and data.')
      } else {
        event.sender.send('workbench-exit', 'Islandora Workbench has finished.')
      }
    });
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  mainWindow.on('ready-to-show', function() { 
    mainWindow.show(); 
    mainWindow.focus(); 
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
  const menu = Menu.buildFromTemplate(menu_template)
  Menu.setApplicationMenu(menu)
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
