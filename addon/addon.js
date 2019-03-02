#!/usr/bin/env node
const path = require('path');

let help = `
  addon [-d|-noW] <pathToBCL> <pathToShared> <destination>

  If some changes in sources or libraries occur then this script:
  (1) configure binding.gyp and rebuild addon
  (2) copies addons (*.node files) from ${path.join(__dirname, 'build', '<config>')} to <destination>.
  (3) copies shared libraries (*.dll or *.so files) from ${path.join('<pathToShared>', '<config>')} to <destination>.
  The <config> parameter mentioned above is Debug if -d option is specified, otherwise it is Release.

  In case of -noW watch mode will be disabled.
 `

const watch = require('watch');
const copy = require('copy');
const fs = require('fs');

let argv = process.argv.slice(2);

if (argv.find(opt => { return (opt == '--help' || opt == '-h'); })) {
  console.log(help);
  return;
}

let dest = path.resolve(argv.pop());
let sharedDir = path.resolve(argv.pop());
let bclDir = path.resolve(argv.pop());

let opt;
let config = 'Release';
let noWatch = false;
do {
  opt = argv.pop();
  config = opt == '-d' ? 'Debug' : config;
  noWatch = opt == '-noW' ? true : noWatch;
} while (opt);

let addonDir = path.resolve(__dirname, 'build', config);
const os = require('os').platform();
let sharedConfigDir = sharedDir;
if (os == 'win32') {
  sharedConfigDir = path.join(sharedDir, config);
}

// Check scrip arguments.
try {
  if (!fs.existsSync(dest))
    throw dest + ' directory does not exist';
  if (!fs.existsSync(bclDir))
    throw bclDir + ' directory does not exist';
}
catch(err) {
  console.log(__filename + ': ' + err);
  return
}

// Configure binding.gyp: replace 'bcl' and 'tsar-build' variables with
// specified passes.
try {
  let bf = path.join(__dirname, 'binding.gyp');
  let bindingFile = JSON.parse(fs.readFileSync(bf, 'utf8'));
  bindingFile.targets[0].variables['bcl'] = path.relative(__dirname, bclDir);
  bindingFile.targets[0].variables['tsar-build'] = sharedDir;
  fs.writeFileSync(bf, JSON.stringify(bindingFile, "", 2), 'utf8');
  let date = new Date();
  console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}` +
    ` - File ${bf} are successfully configured.`)
}
catch(err) {
  console.log(`configure ${path.join(__dirname, 'binding.gyp')}: ${err}`);
}

function copyAddon() {
  try {
    if (!fs.existsSync(addonDir))
      return;
    let cwd = process.cwd();
    process.chdir(addonDir);
    copy('*.node', dest, (err, files) => {
      if (err)
        console.log('copy addon: ' + err);
    });
    process.chdir(cwd);
    let date = new Date();
  console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}` +
    ' - Addons are successfully copied.');
  }
  catch (err) {
    console.log('copy addon: ' + err);
  }
}

// Copy addons to a specified output if they has been changed.
copyAddon();
if (!noWatch) {
  watch.createMonitor(__dirname, (monitor) => {
    monitor.on("created", (file, stat) => { copyAddon(); });
  });
}

function copyShared() {
  try {
    if (!fs.existsSync(sharedConfigDir))
      return;
    let cwd = process.cwd();
    process.chdir(sharedConfigDir);
    copy(['*.dll', '*.so'], dest, (err, files) => {
      if (err)
        console.log('copy shared libraries: ' + err);
    });
    process.chdir(cwd);
    let date = new Date();
    console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}` +
      ' - Shared libraries are successfully copied');
  }
  catch (err) {
    console.log('copy shared libraries: ' + err);
  }
}

function nodeGypExec(cmd, args, cb_stdout, cb_end) {
  const spawn = require('child_process').spawn;
  let child;
  let nodeGypArgs = [
    'rebuild',
    '-C', __dirname,
    '--target=3.1.2',
    '--dist-url=https://atom.io/download/atom-shell'
  ];
  if (config === 'Debug')
    nodeGypArgs.push('-d');
  if (os == 'win32') {
    child = spawn('cmd.exe', [ '/c','node-gyp'].concat(nodeGypArgs));
  } else {
    child = spawn('node-gyp', nodeGypArgs);
  }
  child.on('close', (code) => {
    let date = new Date();
    console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}` +
      ` - Build addon, node-gyp exited with code ${code}`);
  });
  child.on('error', (err) => {console.log(err);});
}

// Rebuild addons and copy shared libraries to a specified output if they
// has been changed.
nodeGypExec();
copyShared();
if (!noWatch) {
  watch.createMonitor(sharedDir, (monitor) => {
    monitor.on("created", (file, stat) => {
      nodeGypExec();
      copyShared();
    });
    monitor.on("changed", (file, stat) => {
      nodeGypExec();
      copyShared();
    });
  });
}
