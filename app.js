// Require express and create an instance of it
var express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const crypto = require('crypto');
var m = require('./scripts/database.js');
var app = express();
m.init();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


function hashPassword(password, callback) {
    var salt = crypto.randomBytes(128).toString('base64');
    var iterations = 10000;
    crypto.pbkdf2(password, salt, iterations, 64, 'sha512', function (err, derivedKey) {
        callback({
            salt: salt,
            hash: derivedKey.toString('hex'),
            iterations: iterations
        });
    });

    
}

function isAuthenticated(req, callback) {
    if (req.headers.authorization) {
        
        var token = req.headers.authorization;
        jwt.verify(token, 'secret', function (err, decoded) {
            if (err) {
                callback(false, undefined);
            } else {
                // GET USER FROM DB
                req.user = decoded;
                callback(true, decoded);
            }
        });
    } else {
        callback(false, undefined);
    }
}

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/views/base.html");
    //res.end();
});

app.get('/home', function (req, res) {
    isAuthenticated(req, function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/a_home.html");
            }else{
                res.sendFile(__dirname + "/views/base.html");
            }
        }else{
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/home.html");
            }else{
                res.sendFile(__dirname + "/views/base.html");
            }
        }
        
    })
    
    
    //res.end();
});

app.get('/about', function (req, res) {
    if(req.headers["partial"] == "YES"){
        res.sendFile(__dirname + "/views/about.html");
    }else{
        res.sendFile(__dirname + "/views/base.html");
    }
    //res.end();
});


app.get('/create', function (req, res) {
    if(req.headers["partial"] == "YES"){
        res.sendFile(__dirname + "/views/create.html");
    }else{
        res.sendFile(__dirname + "/views/base.html");
    }
    //res.end();
});

app.post('/acc/login', function (req, res){
    m.getDocs('Account', {username: req.body.username, group: req.body.group}).then(function(docs){
        if(docs.length == 0){
            res.send(JSON.stringify({successful: false}));
        }else{
            crypto.pbkdf2(req.body.password, docs[0].pwsalt, docs[0].pwiterations, 64, 'sha512', function(err, derivedKey){
                if(docs[0].pwhash == derivedKey.toString('hex')){
                    var token = jwt.sign({
                        username: req.body.username,
                        group: req.body.group,
                        id: docs[0]._id
                    }, 'secret', {
                        expiresIn: '2h'
                    });
                    res.send(JSON.stringify({successful: true, user: docs[0], token: token}));
                }else{
                    res.send(JSON.stringify({successful: false}));
                }
            })
            
        }
    });
    
});

app.get('/acc/verify', function(req, res){
    var token = req.headers['authorization'];
    try{
        var decoded = jwt.verify(token, 'secret');
        m.getDocs('Account', {_id: decoded.id}).then(function(docs){
            if(docs.length == 0){
                res.send(JSON.stringify({successful: false}));
            }else{
                res.send(JSON.stringify({successful: true, user: docs[0]}));
            }
        });
    }catch(e){
        res.send(JSON.stringify({successful: false}));
    }
});

app.post('/check/groupExists', function(req, res){
    m.getDocs('Group', {uniqueId: req.body.group}).then(function(docs){
        if(docs.length == 0){
            res.send(JSON.stringify({valid: false}));
        }else{
            res.send(JSON.stringify({valid: true}));
        }
    });
})

app.post('/acc/create', function (req, res){


    m.getDocs('Group', {uniqueId: req.body.group}).then(function(docs){
        if(docs.length == 0){
            res.send(JSON.stringify({successful: false, error: "group"}));
            return;
        }
        m.getDocs('Account', {username: req.body.username, group: req.body.group}).then(function(docs){
            if(docs.length == 0){
                hashPassword(req.body.password, function(pwres){
                    m.createDoc('Account', {
                        username: req.body.username,
                        email: req.body.email,
                        pwhash: pwres.hash,
                        pwsalt: pwres.salt,
                        pwiterations: pwres.iterations,
                        group: req.body.group,
                        access: {
                            roles: ["member"],
                            restricted: false,
                            elevated: false
                        },
                        connections: []
    
                    }).then(function(d){
                        var token = jwt.sign({
                            username: req.body.username,
                            group: req.body.group,
                            id: d._id
                            // NOTICE: CHANGE TO .ENV FILE
                        }, 'secret', {
                            expiresIn: '2h'
                        });
                        d.token = token;
                        res.send(JSON.stringify({successful: true, user: d, token: token}));
                    });

                    

                    
                });
                
            }else{
                res.send(JSON.stringify({successful: false, error: "username"}));
            }
        });
    });
    
    

    
});

app.get("/group/items", function(req, res){
    isAuthenticated(req, function(status, user){
        if(status){
            m.getDocs('ModuleItem', {group: user.group}).then(function(docs){
                res.send(JSON.stringify({successful:true, items: docs}));
            });

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/manage", function(req, res){
    isAuthenticated(req, function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/manage.html");
            }else{
                res.sendFile(__dirname + "/views/base.html");
            }
        }else{
            res.sendFile(__dirname + "/views/base.html");
        }
    });
});

app.use(function(req, res, next) {
    res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
});

// start the server in the port 3000 !
app.listen(80, function () {
    console.log('Example app listening on port 3000.');
});