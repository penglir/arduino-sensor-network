var app = require('http').createServer(httpHandler).listen(8888);
// var server = require('http').createServer();
// var express = require('express');
// var app = express();
var formidable = require("formidable");
var util = require('util');

var io = require('socket.io').listen(app);
var fs = require('fs');
var five = require("johnny-five");
var board = new five.Board();
var path = require("path");
var led;
var sensor1;
var sensor2;
var sensor3;
var sensor4;

// on board ready
board.on("ready", function() {

  // init a led on pin 13, strobe every 1000ms
  // led = new five.Led(13).strobe(1000);

  // poll this sensor every second
  sensor1 = new five.Sensor({
    pin: "A0",
    freq: 2000  // new five.Sensor 直接取Arduino上的一个Pin, 可以指定取样频率
  });

  sensor2 = new five.Sensor({
    pin: "A2",
    freq: 2000  // new five.Sensor 直接取Arduino上的一个Pin, 可以指定取样频率
  });

  // sensor3 = new five.Sensor({
    // pin: "A2",
    // freq: 1000  // new five.Sensor 直接取Arduino上的一个Pin, 可以指定取样频率
  // });

  // sensor4 = new five.Sensor({
    // pin: "A3",
    // freq: 1000  // new five.Sensor 直接取Arduino上的一个Pin, 可以指定取样频率
  // });

});

// express framework
/*
app.post('/calibrate', function (req, res) {

  console.log("express calibrate");

});

app.get('/', function (req, res) {

})

app.listen(8888, function() {
  console.log('listening on port 3000');
});
*/

// handle web server
function httpHandler (req, res) {

  console.log("---------------");
  console.log(req.method);
  console.log(req.url);

  if (req.method == 'POST' && req.url == '/calibrate') {

    // console.log("calibrate");

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


// on a socket connection
io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });// connection是系统事件，连接上以后，发送news信息，html接收news信息

  // if board is ready
  if(board.isReady){
    // read in sensor data, pass to browser
    sensor1.on("data",function(){                  // Sensor 是一个 johhny five 的对象， data是一个event

      var Eo = 204.5;
      var m = 19.6;

      var count = this.raw;
      var voltage = count / 1023 * 5.0;
      var electrode_reading = 137.55 * voltage - 0.1682;
      var val = ((electrode_reading - Eo) / m);
      var concentration = Math.exp(val).toFixed(2);
      if (concentration < 0 || concentration > 100) concentration = 0;

    //   console.log('NH4 ' + concentration);

      socket.emit('sensor1', { raw: concentration  });
    });

    sensor2.on("data",function(){                  // Sensor 是一个 johhny five 的对象， data是一个event

      var Eo = 323;
      var m = -23;

      var count = this.raw;
      var voltage = count / 1023 * 5.0;
      var electrode_reading = 137.55 * voltage - 0.1682;
      var val = ((electrode_reading - Eo) / m);
      var concentration = Math.exp(val).toFixed(2);
      if (concentration < 0 || concentration > 100) concentration = 0;

    //   console.log('NO3 ' + concentration);

      socket.emit('sensor2', { raw: concentration });
    });

    // sensor3.on("data",function(){                  // Sensor 是一个 johhny five 的对象， data是一个event
      // socket.emit('sensor3', { raw: this.raw });
    // });

    // sensor4.on("data",function(){                  // Sensor 是一个 johhny five 的对象， data是一个event
      // socket.emit('sensor4', { raw: this.raw });
    // });
  }


  // if led message received
  socket.on('led', function (data) {
    console.log(data);
     if(board.isReady){    led.strobe(data.delay); }
  });

});
