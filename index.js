var Beam = require('beam-client-node');
var Tetris = require('beam-interactive-node');

//Lets us control the keyboard and mouse of the computer
var controls = require("keyboardz");

//Transforms codes(65) into key names(A) and visa versa
var keycode = require('keycode');

//Load the config values in from the json
var config = require('./config/default.json');

var Packets = require('beam-interactive-node/dist/robot/packets');

var Target = Packets.ProgressUpdate.Progress.TargetType;

var username = config.beam.username
var password = config.beam.password;

//50% of users must be voting on an action for it to happen
var tactileThreshold = config.threshold || 0.5;

var beam = new Beam();

var robot = null;


//My onscreen controls are likely to be controls a player(streamer) might use if they don't have a gamepad.
//So we remap keys from the report to lesser used keys here. Ideally id like to emulate a HID and pass beam events through that.
//That way the streamer can type in chat without 123129301293120392 appearing. However the interface allows you to toggle interactive mode
//and the streamer has a microphone too!
var remap = {
    'W':'1',
    'S':'2',
    'A':'3',
    'D':'4',
    'Q':'5',
    'E':'6',
    'C':'7',
    'Z':'8'
};

function remapKey(code) {
    var stringCode;
    if(typeof code === 'number') {
        stringCode = keycode(code).toUpperCase();
    } else {
        stringCode = code;
    }

     if(remap[stringCode]) {
        return remap[stringCode].toLowerCase();
    }
    return code;
}

function validateConfig() {
    var needed = ["channel","password","username"];
    needed.forEach(function(value){
        if(!config.beam[value]) {
            console.error("Missing "+value+ "in your config file. Please add it to the file. Check the readme if you are unsure!");
        }
    });
}

function setup() {

    if(!config) {
        console.log('Missing config file cannot proceed, Please create a config file. Check the readme for help!');
        process.exit();
    }

    validateConfig();

    
    try {
        var streamID = parseInt(config.beam.channel,10);
        if(!steamID.isNAN()) {
            go(streamID);
        }
    } catch (e) {
        getChannelID(config.beam.channel, function(result){
            go(result);
        })
    }
}

/**
 * Our report handler, entry point for data from beam
 * @param  {Object} report 
 */
function handleReport(report) {
    //if no users are playing or there's a brief absence of activity
    //the reports contain no data in the tactile/joystick array. So we detect if there's data
    //before attempting to process it
    if(report.tactile.length) {
        recievingReports = true;
        handleTactile(report.tactile,report.quorum);
    } else {
        recievingReports = false;
    }
}

var recievingReports = true;
/**
 * Watchdog gets called every 500ms to check the status of the reports coming into us from beam.
 * If we havent had any reports that contained usable data in (5 * 500ms)(2.5s) we clear all the
 * inputs that the game uses. This allows the second "player"(controlled by beam to not continue).
 * Stopping and standing still seemed to be better than "CONTINUE RUNNING YAY"
 * @return {[type]} [description]
 */
function watchDog() {
    if(!recievingReports) {
        if(dogCount === 5) {
            console.log('clearing player input due to lack of reports.');
            setKeys(['W','S','A','D','Q','E','C','Z'],false,true);
        }
        dogCount =dogCount + 1;
    } else {
        dogCount = 0;
    }
}



/**
 * Given a report, workout what should happen to the key.
 * @param  {Object} keyObj Directly from the report.tactile array
 * @return {Boolean} true to push AND HOLD the button, false to let go. null to do nothing.
 */
function tactileDecisionMaker(keyObj) {
    if(keycode(keyObj.keycode) === 'L') {
        console.log(keyObj);
    }
    
    //Using similar processing to Matt's Eurotruck
    if(keyObj.down.mean > tactileThreshold) {
        return true;
    } else if(keyObj.up.mean > tactileThreshold) {
        return false;
    }
    return null;
}

function createProgressForKey(keycode,result) {
    return {
        target: Target.TACTILE,
        code:keycode,
        progress: result,
        fired: (result === 1) ? true : false
    };
}

/**
 * Workout for each key if it should be pushed or unpushed according to the report.
 * @param {[type]} keyObj [description]
 */
function setKeyState(keyObj) {
    //Use the remapping table from above to map keys around
    //console.log(keyObj);
    
    //Ignore start for now, spam is bad K?
    if(keycode(keyObj.code) === 'I') {
        return;
    }
    keyObj.original = keyObj.code;
    keyObj.code = remapKey(keyObj.code);

    //Sometimes the key object will be blank and have no data in .down or .up.
    //If this occurs we set the key to be up as we don't have enough data
    if(!keyObj.down) {
        if(keyObj.code) {
            setKey(keyObj.code,false);
        }
        return;
    }

    var decision = tactileDecisionMaker(keyObj);
    if(decision !== null) {
        console.log(keycode(keyObj.original),decision);
        setKey(keyObj.code, decision);
    }
    return createProgressForKey(keyObj.original, (decision !== null && decision ) ? 1 : 0);
}

function handleTactile(tactile) {
    var progress = tactile.map(setKeyState);
    if(robot !== null) {
        robot.send(new Packets.ProgressUpdate({ progress }));
    }
}

/**
 * Convinience function that loops through an array of keys and sets them to status
 * @param {String[]|Number[]} keys   Keys to modify
 * @param {Boolean} status status true to push AND HOLD the button, false to let go. null to do nothing.
 * @param {Boolean} remap  True to also run the keys through the remapping routine.
 */
function setKeys(keys,status,remap) {
    var codes = keys.map(function(key) {
        return keycode(key);
    });
    if(remap) {
        keys = keys.map(remapKey);
    }
    keys.forEach(function(key) {
        setKey(key,status);
    });

    codes = codes.map(function(value) {
        return createProgressForKey(value, (status) ? 1 : 0);
    });
    console.log(codes);
    if(robot !== null) {
        robot.send(new Packets.ProgressUpdate({ progress:codes }));
    }
}

/**
 * Given a key and a boolean push or release that button on the keyboard
 * @param {Number|String} key
 * @param {Boolean} status true to push AND HOLD the button, false to let go. null to do nothing.
 */
function setKey(key,status) {
    //Beam reports back keycodes, convert them to keynames, which robotjs accepts
    if(typeof key === 'number') {
        key = keycode(key);
    }

    //Robotjs wants 'down' or 'up', I prefer true or false for the rest of my program
    //handle that here
    if(status) {
        controls.holdKey(key.toUpperCase());
    } else {
        controls.releaseKey(key.toLowerCase());
    }

    controls.keyToggle(key, status);
}


function getChannelID(channelName,cb) {
    beam.request('GET','channels/'+channelName).then(function(res){
        if(typeof cb === "function") {
            cb(res.body.id);
        }
    });
}

function go(id) {
    beam.use('password', {
        username: username,
        password: password
    }).attempt().then(function () {
        return beam.game.join(id);
    }).then(function (details) {
        details = details.body;
        details.remote = details.address;
        details.channel = id;
        robot = new Tetris.Robot(details);
        robot.handshake(function(err){
            if(err) {
                console.log('Theres a problem connecting to beam, show this to a codey person');
                console.log(err);
            } else {
                console.log('Connected to Beam');
            }
        });

        robot.on('report',handleReport);
        setInterval(watchDog,500);
    }).catch(function(err){
        console.log(err.message.body);
    });
}


setup();
