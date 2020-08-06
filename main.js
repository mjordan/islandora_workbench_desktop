// Modules to control application life and create native browser window
const {ipcMain, dialog, app, BrowserWindow, Menu, net} = require('electron')
const path = require('path')
const yaml = require('js-yaml');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

const menu_template = [{
  label: 'Application',
    submenu: [
      { label: 'Set path to workbench', click: function () { openWorkbenchPathDialog() } },
      { label: 'Return to main window', accelerator: 'CmdOrCtrl+M', click: function () { mainWindow.loadURL('file://' + path.join(__dirname, 'renderer/index.html'));} },
      { label: 'View log file', accelerator: 'CmdOrCtrl+L', click: function () { mainWindow.loadURL('file://' + path.join(__dirname, 'workbench.log'));} },
      { label: 'Clear main window', click: function () { mainWindow.loadURL('file://' + path.join(__dirname, 'renderer/index.html'));} },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
    ]},
    {
    label: 'Task',
    submenu: [
      { label: 'Choose configuration file', accelerator: 'CmdOrCtrl+F', click: function () { openConfigFileDialog() } },
      { label: 'Edit a configuration file (not implemented yet!)', enabled: false },
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
    width: 1000,
    height: 600,
    show: false,
    icon: __dirname + '/assets/islandora_workbench_desktop_icon.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('renderer/index.html')

  // Execute workbench.
  const ipc = ipcMain
  ipc.on('asynchronous-message', function (event, arg) {
    if (typeof store.get('workbench.current-config-file') == "undefined") {
      event.sender.send('workbench-config-file', 'No configuration file selected.')
    } else {
      var config = yaml.safeLoad(fs.readFileSync(store.get('workbench.current-config-file'), 'utf8'));
    }

    var workbenchArgs = ['--config', store.get('workbench.current-config-file')]

    // Issue #10. 
    ping_islandora(config).then((jsonApiJson) => {
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
        event.sender.send('workbench-config-file', 'Checking configuration file ' +
          store.get('workbench.current-config-file') + ' for "' + config.task + '" task and data.')
      } else {
        event.sender.send('workbench-config-file', 'Running task using configuration file ' +
          store.get('workbench.current-config-file') + ' for "' + config.task + '" task.')
      }

      let shell = new PythonShell(store.get('workbench.path-to-workbench'), options);
      shell.on('message', function (message) {
        event.sender.send('asynchronous-reply', message)
      });

      shell.on('close', function (message) {
        if (arg == 'check') {
          event.sender.send('workbench-exit', 'Islandora Workbench has finished checking configuration  for "' +
            config.task + '" task and data.')
        } else {
          event.sender.send('workbench-exit', 'Islandora Workbench has finished "' + config.task + '" task.')
        }
      });
    }).catch(e => dialog.showMessageBoxSync(mainWindow, { type: 'warning', message: "Workbench can't connect to Islandora.",
      detail: e.toString(), buttons: ['OK']}));
  });

  let editorWindow;
  ipc.on('add-editor-window', () => {
    if (!editorWindow) {
      editorWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        icon: __dirname + '/assets/islandora_workbench_desktop_icon.png',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: true
        }
      });
      editorWindow.loadFile(path.join('renderer','editor.html'));

      // FOR DEBUGGING. REMOVE BEFORE PR.
      editorWindow.webContents.openDevTools();
      
      // Clean up the window when closed.
      editorWindow.on('closed', () => {
        editorWindow = null;
      });
      
      ipc.on('run-workbench', (event, configPath, check = false) => {
        runWorkbench(configPath, check);
      });
    }
  });

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

/**
 * Returs a promise with JSON:API object if we can connect; otherwise catch the error.
 */
async function ping_islandora(config) {
  
  let jsonApiPrefix = config.host + '/jsonapi/';
  let jsonAPIAuth = config.username + ':' + config.password;
  
  var needle = require('needle');
  return needle(
    'get',
    jsonApiPrefix,
    {follow: 1, rejectUnauthorized: false, username: config.username, password: config.password}
  ).then((res) => res.body)
  .catch(function(err) {
    console.error(err.message);
  });
}

async function runWorkbench(configPath, check = false) {
  let config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
  
  ping_islandora(config).then((jsonApiJson) => {
    let {PythonShell} = require('python-shell');
    let workbenchArgs = ['--config', configPath];

    if (check) {
      workbenchArgs.push('--check');
    }

    let options = {
      mode: 'text',
      pythonOptions: ['-u'],
      args: workbenchArgs
    }

    if (check) {
      mainWindow.send('workbench-config-file', 'Checking configuration file ' +
        configPath + ' for "' + config.task + '" task and data.')
    } else {
      mainWindow.send('workbench-config-file', 'Running task using configuration file ' +
        configPath + ' for "' + config.task + '" task.')
    }

    let shell = new PythonShell(store.get('workbench.path-to-workbench'), options);
    shell.on('message', function (message) {
      mainWindow.send('asynchronous-reply', message)
    });

    shell.on('close', function (message) {
      if (check) {
        mainWindow.send('workbench-exit', 'Islandora Workbench has finished checking configuration  for "' +
          config.task + '" task and data.')
          dialog.showMessageBox({
            type: 'info',
            title: 'Check Completed',
            message: 'Islandora Workbench has finished checking configuration  for "' +
              config.task + '" task and data.'
          });
      } else {
        mainWindow.send('workbench-exit', 'Islandora Workbench has finished "' + config.task + '" task.')
      }
    });
  }).catch(e => dialog.showMessageBoxSync(mainWindow, { type: 'warning', message: "Workbench can't connect to Islandora.",
    detail: e.toString(), buttons: ['OK']}));
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