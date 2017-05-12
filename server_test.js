var app = require('http').createServer(httpHandler).listen(8888);

function httpHandler (req, res) {

  // console.log(req);

  var body = '';
    req.on('data', function (data) {
        body += data;
        console.log("Partial body: " + body);
    });
    req.on('end', function () {
        console.log("Body: " + body);
    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('post received');

}
