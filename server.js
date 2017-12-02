var app = require('http').createServer(httpHandler).listen(8888);
var io = require('socket.io').listen(app);
var fs = require('fs');
var mkdirp = require('mkdirp'); // recursively mkdir third party lib
var path = require("path");
var csvToJson = require('convert-csv-to-json'); // read and parse sensor calibration csv file
var moment = require('moment');

var sensor_config_map = {}; // key value pair
var csv_schema = [];

var SENSOR_ID = "sensor_id";
var SENSOR_DATA = "sensor_data";
var SENSOR_VOLTAGE = "sensor_voltage";
var RECEIVED_DATE = "received_date";
var VERNIER_AMMONIUM = "Vernier_Ammonium";
var VERNIER_NITRATE = "Vernier_Nitrate";
var SENSOR_TYPE = "sensor_type";
var EO = "Eo"; // b y=kx+b
var M = "m";   // k y=kx+b
var UNIT = "unit";
var UPDATE_FRONTEND = "update_frontend";

var SERIAL_PORT = "/dev/cu.usbserial-AD02AHUU";

init();

function init()
{
    console.log("**************************************************************");
    console.log("*  Please go to localhost:8888 in browser to open dashboard  *");
    console.log("**************************************************************");

    var serialport = require('serialport');
    var port = new serialport(SERIAL_PORT, {
        baudRate: 57600,
        parser: serialport.parsers.readline("\n")
    });

    loadConfigFile();

    port.on('data', function (raw_data) {
        console.log(raw_data);
        if (!validateData(raw_data))
        {
            console.log('data received is invalid.');
            return;
        }
        printForCalibration(raw_data);
        var single_sensor_data_map = transformRawData(raw_data);
        saveToBuffer(single_sensor_data_map); // data buffer hold all sensor data for latest sec
        // saveToCSV(data);     // per 60 secs
        // saveToDB(data);      // to do list
        // sendToFrontend();       // per 1 sec
    });

    setInterval(persistData, 60000); // DEBUG
    setInterval(updateFrontend, 3000);
}

function validateData(raw_data)
{
    if (typeof raw_data == 'undefined')
    {
        return false;
    }

    var raw_data_array = raw_data.split('#');
    if (raw_data_array.length != 2)
    {
        return false;
    }

    var sensor_id = raw_data_array[0];
    if (!sensor_config_map.hasOwnProperty(sensor_id))
    {
        return false;
    }

    var sensor_data = raw_data_array[1];
    if (isNaN(sensor_data))
    {
        return false;
    }

    return true;
}

function printForCalibration(raw_data)
{
    data = raw_data.replace('\r', ''); // data from Arduino will ended with a '\r'
    var raw_data_array = raw_data.split('#');

    var sensor_id = raw_data_array[0];
    var analog_reading = raw_data_array[1]
    var raw_voltage = analog_reading / 1023 * 5.0;
    var voltage = 137.55 * raw_voltage - 0.1682;
    console.log(sensor_id + ' voltage' + ' : ' + voltage.toFixed(2) + ' mV');
}

function voltageForCalibration(raw_data)
{
    data = raw_data.replace('\r', ''); // data from Arduino will ended with a '\r'
    var raw_data_array = raw_data.split('#');
    var sensor_id = raw_data_array[0];
    var analog_reading = raw_data_array[1]
    var raw_voltage = analog_reading / 1023 * 5.0;
    var voltage = 137.55 * raw_voltage - 0.1682;
    return voltage.toFixed(2);
}

// web server hanlder
function httpHandler (req, res) {

  // console.log("---------------");
  // console.log(req.method);
  // console.log(req.url);

  if (req.method == 'POST' && req.url == '/calibrate') {

    req.on('data', function (data) {
        console.log(data);
    });

    res.writeHead(301, { 'Location': '/index.html' });
    res.end();

    return;
  }

  var filePath = req.url;

  if (filePath == '/') {
      filePath = './index.html';
  } else {
      filePath = '.' + req.url;
  }

  var extname = path.extname(filePath);
  var contentType = 'text/html';

  switch (extname) {
    case '.js':
        contentType = 'text/javascript';
        break;
    case '.css':
        contentType = 'text/css';
        break;
    case '.csv':
        contentType = 'text/csv';
        res.setHeader('Content-Disposition', 'attachment');
        break;
  }

  fs.exists(filePath, function(exists) {

    if (exists) {
        fs.readFile(filePath, function(error, content) {
            if (error) {
                res.writeHead(500);
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    else {
        res.writeHead(404);
        res.end();
    }
  });
}

var websocket = null;
// websocket connection event
io.sockets.on('connection', function (socket) {
    websocket = socket;
    console.log("websocket connected");

    websocket.on('calibrate', function (arr) {
        console.log('receive calibrate paras from frontend');
        console.log(arr);
        if (!arr.hasOwnProperty(SENSOR_ID) || !arr.hasOwnProperty(EO) || !arr.hasOwnProperty(M))
        {
            console.log('invalid calibrate parameters received from frontend.');
        }
        else
        {
            writeConfigFile(arr);
        }
    });
});

function writeConfigFile(paras)
{
    // var paras = {
    //                 SENSOR_ID : 'Sensor-1',
    //                 M : 10,
    //                 EO : 20,
    //             };

    var to_be_update_sensor_id = paras[SENSOR_ID];
    var eo = paras[EO];  // b
    var m = paras[M];   // k

    // refresh config data in memory
    if (!sensor_config_map.hasOwnProperty(to_be_update_sensor_id))
    {
        console.log('invalid sensor id to be updated');
    }
    else
    {
        var sensor_config = sensor_config_map[to_be_update_sensor_id];
        sensor_config[EO] = eo;
        sensor_config[M] = m;
    }

    // write config data to local config csv file
    var config_file = "./config/config.csv";
    var json = csvToJson.fieldDelimiter(',').getJsonFromCsv(config_file);
    for(var i = 0; i < json.length; i++){
        var sensor_config = json[i];
        var sensor_id = sensor_config[SENSOR_ID];
        if (sensor_id == to_be_update_sensor_id)
        {
            sensor_config[EO] = eo;
            sensor_config[M] = m;
            break;
        }
    }
    // console.log(json);

    var buffer = '';

    // write header
    var header = '';
    var sensor_config = json[0];
    for (var key in sensor_config)
    {
        if (header != '')
        {
            header += ',';
        }
        header += key;
    }
    header += '\n';
    buffer += header;

    // write body
    for(var i = 0; i < json.length; i++){
        var sensor_config = json[i];
        var row = '';
        for (var key in sensor_config)
        {
            if (row != '')
            {
                row += ',';
            }
            row += sensor_config[key];
        }
        row += '\n';
        buffer += row;
    }

    try {
        fs.writeFile('./config/config.csv', buffer, (err) => {
            if (err) throw err;
            console.log('New config file has been saved!');
        });
    } catch (err) {
        if (err.code == 'EBUSY')
        {
            console.log('Please exit the config csv file when calibrating and try again.');
        }
    }
}

function loadConfigFile()
{
    csv_schema.push("Date");

    var config_file = "./config/config.csv";
    var json = csvToJson.fieldDelimiter(',').getJsonFromCsv(config_file);
    for(var i = 0; i < json.length; i++){
        var sensor_config = json[i];
        removeRCharacter(sensor_config);
        sensor_config_map[sensor_config.sensor_id] = sensor_config;

        //csv_schema.push(sensor_config.sensor_id + ' (' + sensor_config.unit + ')');
        csv_schema.push(sensor_config.sensor_id);
    }
}

function removeRCharacter(sensor_config)
{
    for (var key in sensor_config)
    {
        sensor_config[key] = sensor_config[key].replace('\r', '');;
    }
}

function transformRawData(raw_data)
{
    data = raw_data.replace('\r', ''); // data from Arduino will ended with a '\r'
    var raw_data_array = raw_data.split('#');
    var data_map = {};
    data_map[SENSOR_ID] = raw_data_array[0];
    data_map[SENSOR_DATA] = decodeRawData(raw_data_array[1], raw_data_array[0]);
    data_map[SENSOR_VOLTAGE] = voltageForCalibration(raw_data);
    data_map[RECEIVED_DATE] = new Date();
    data_map[UNIT] = getUnit(raw_data_array[0]);
    return data_map;
}

function decodeRawData(raw_data, sensor_id)
{
    var result = null;

    if (!sensor_config_map.hasOwnProperty(sensor_id))
    {
        console.log("exception sensor id was received.");
        return;
    }

    var sensor_config = sensor_config_map[sensor_id];
    if (sensor_config[SENSOR_TYPE] == VERNIER_AMMONIUM
        || sensor_config[SENSOR_TYPE] == VERNIER_NITRATE)
    {
        var Eo = sensor_config[EO];
        var m = sensor_config[M];

        var count = raw_data;
        var voltage = count / 1023 * 5.0;
        var electrode_reading = 137.55 * voltage - 0.1682;
        var val = ((electrode_reading - Eo) / m);
        var concentration = Math.exp(val).toFixed(2);
        // if (concentration < 0 || concentration > 100) // filter
        // {
        //     concentration = 0;
        // }
        result = concentration;
    }
    return result;
}

function getUnit(sensor_id)
{
    var sensor_config = sensor_config_map[sensor_id];
    return sensor_config[UNIT];
}

var buffer = {};
function saveToBuffer(data_map)
{
    buffer[data_map[SENSOR_ID]] = data_map;
}

function persistData()
{
    saveToCSV();
    saveToDB();
    clearBuffer();
}

var outputToFileBuffer = '';
function saveToCSV()
{
    var csv_row = '';
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();

    //var csv_row_date = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ' MT.';
    var csv_row_date = moment().format('YYYY-MM-DD hh:mm:ss') + ' MT';

    for (var i = 0; i < csv_schema.length; i++)
    {
        if (i > 0)
        {
            csv_row += ',';
        }

        var item = csv_schema[i];
        if (item == 'Date')
        {
            csv_row += csv_row_date;
        }
        else if (buffer.hasOwnProperty(item)) // sensor id
        {
            var data_map = buffer[item];
            var data = data_map[SENSOR_DATA];
            csv_row += data;
        }
        else
        {
            csv_row += 'NaN';
        }

        if (i == csv_schema.length - 1)
        {
            csv_row += '\n';
        }
    }

    var date_prefix = year + '-' + month + '-' + day;
    var filename = date_prefix;
    var extension = 'csv';
    var full_filename = filename + '.' + extension;
    var dir = './csv/';
    var path = dir + full_filename;

    // ensure the dir exist
    if (!fs.existsSync(dir)) {
        console.log('dir not exist');
        mkdirp.sync(dir, function (err) {
            if (err) throw err;
            else console.log('dir is created');
        });
    }

    if (!fs.existsSync(path))
    {
        var schema_row = "";
        for (var i = 0; i < csv_schema.length; i++)
        {
            if (i > 0)
            {
                schema_row += ",";
            }
            var item = csv_schema[i];
            if (sensor_config_map.hasOwnProperty(item)) // is sensor id column
            {
                var sensor_config = sensor_config_map[item];
                var unit = sensor_config[UNIT];
                item += ' (' + unit + ')';
            }
            schema_row += item;

            if (i == csv_schema.length - 1)
            {
                schema_row += '\n';
            }
        }

        // write csv schema for the first row
        //fs.appendFile(path, schema_row, function (err){
        //    if (err) throw err;
        //    //console.log('data append to ' + path);
        //});
        fs.appendFileSync(path, schema_row);
    }
    // write sensor record to local csv file
    //fs.appendFile(path, csv_row, function (err){
    //    if (err) throw err;
    //    //console.log('data append to ' + path);
    //});

    try {
        csv_row = outputToFileBuffer + csv_row
        fs.appendFileSync(path, csv_row);
        // write to file must success if the code could come here
        outputToFileBuffer = '' // clear buffer
    } catch (err) {
        if (err.code == 'EBUSY')
        {
            // save date to buffer
            outputToFileBuffer = csv_row
        }
    }
}

// per 60 seconds
function saveSingleDataToCSV(data_map)
{
    var sensor_id = data_map[SENSOR_ID];
    var unit = data_map[UNIT];
    var date = new Date(data_map[RECEIVED_DATE]);
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();

    var date_prefix = year + '-' + month + '-' + day;
    var filename = date_prefix + '-' + sensor_id;
    var extension = 'csv';
    var full_filename = filename + '.' + extension;
    var dir = './csv/' + sensor_id;
    var path = dir + '/' + full_filename;

    // ensure the dir exist
    if (!fs.existsSync(dir)) {
        console.log('dir not exist');
        mkdirp.sync(dir, function (err) {
            if (err) throw err;
            else console.log('dir is created');
        });
    }

    var data = data_map[SENSOR_DATA];
    // var csv_row = sensor_id + ',' + data + ',' + date + '\n'
    var csv_row = sensor_id + ',' + data + ',' + unit + ',' + date + '\n'

    // write sensor record to local csv file
    fs.appendFile(path, csv_row, function (err){
        if (err) throw err;
        //console.log('data append to ' + path);
    });
}

function saveToDB(data)
{
}

function clearBuffer()
{
    for (var sensor_id in buffer)
    {
        delete buffer[sensor_id];
    }
}

function updateFrontend()
{
    if (websocket != null)
    {
        websocket.emit(UPDATE_FRONTEND, buffer);
    }
}
