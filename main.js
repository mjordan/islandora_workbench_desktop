// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')
const electron = require('electron')
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  const ipc = electron.ipcMain
  ipc.on('asynchronous-message', function (event, arg) {
    let {PythonShell} = require('python-shell');
    let options = {
      mode: 'text',
      pythonOptions: ['-u'],
      // You may need to adjust the path to the workbench configuration file, and also
      // the path in the 'input_dir' option with the configuration file. All paths must
      // be relative to the Islandora Workbench Desktop directory.
      args: ['--config', '../workbench/workbench_desktop.yml']
    }

    // You may need to adjust the path to workbench so that is it relative to
    // the Islandora Workbench Desktop directory.
    let shell = new PythonShell('../workbench/workbench', options);
    shell.on('message', function (message) {
      event.sender.send('asynchronous-reply', message)
    });

    shell.on('close', function (message) {
      event.sender.send('workbench-exit', 'Islandora Workbench has finished.')
    });
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

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
