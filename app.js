// Require express and create an instance of it
var express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const crypto = require('crypto');
var mongoose = require('mongoose');
var m = require('./scripts/database.js');
var app = express();
var cookies = require("cookie-parser");

app.use(cookies());
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

function isAuthenticated(req, method, callback) {
    if (req.headers.authorization || req.cookies.session) {
        
        var token = req.headers.authorization || req.cookies.session;
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

// focus on getting a specific part, and then redirecting
app.get("/part*", function(req, res){
    var path = req.originalUrl;
    var part = path.substring(req.originalUrl.indexOf("/part") + 5);
    res.redirect(part + "/?part=1");
});


app.get('/', function (req, res) {
    res.sendFile(__dirname + "/views/base.html");
    
    //res.end();
});

app.get('/home*', function (req, res) {
    isAuthenticated(req, "cookie", function(status, user){
        if(status){
            
            if(req.query.part != undefined){
                res.setHeader("group", user.group);
                res.sendFile(__dirname + "/views/a_home.html");
            }else{
                res.sendFile(__dirname + "/views/base.html");
            }
        }else{
            if(req.originalUrl.split("/").length > 2 && !req.originalUrl.split("/")[2].startsWith("?")){
                var group = req.originalUrl.split("/")[2];
                // CHECK IF GROUP PUBLIC HERE
                 
                if(req.query.part != undefined){
                    //res.setHeader("group", group);
                    res.sendFile(__dirname + "/views/a_home.html");
                }else{
                    res.sendFile(__dirname + "/views/base.html");
                }
            }else{
                if(req.query.part != undefined){
                    res.sendFile(__dirname + "/views/home.html");
                }else{
                    
                    res.sendFile(__dirname + "/views/base.html");
                }
            }
        }
        
    })
    
    
    //res.end();
});

app.get('/about', function (req, res) {
    if(req.query.part != undefined){
        res.sendFile(__dirname + "/views/about.html");
    }else{
        res.sendFile(__dirname + "/views/base.html");
    }
    //res.end();
});


app.get('/create', function (req, res) {
    if(req.query.part != undefined){
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
                        expiresIn: '24h'
                    });
                    res.send(JSON.stringify({successful: true, user: createSafeUser(docs[0]), token: token}));
                }else{
                    res.send(JSON.stringify({successful: false}));
                }
            })
            
        }
    });
    
});

function createSafeUser(u){
    var safeUser = {
        username: u.username,
        group: u.group,
        id: u._id,
        attendance: u.attendance


    }
    return safeUser;
}


app.get('/acc/verify', function(req, res){
    
    try{
        var token = req.cookies.session;
        var decoded = jwt.verify(token, 'secret');
        m.getDocs('Account', {_id: decoded.id}).then(function(docs){
            if(docs.length == 0){
                res.send(JSON.stringify({successful: false}));
            }else{

                res.send(JSON.stringify({successful: true, user: createSafeUser(docs[0])}));
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
                        res.send(JSON.stringify({successful: true, user: createSafeUser(d), token: token}));
                    });

                    

                    
                });
                
            }else{
                res.send(JSON.stringify({successful: false, error: "username"}));
            }
        });
    });
    
    

    
});

app.get("/group/links", async function(req, res){
    isAuthenticated(req, "cookie", async function(status, user){
        if(status){
            var links = await m.getDocs("QuickLink", {group: user.group});
            res.send(JSON.stringify({successful: true, items: links}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.post("/group/link", async function(req, res){
    isAuthenticated(req, "cookie", async function(status, user){
        if(status){
            var id = req.body._id;
            if(req.body.action == "edit"){
                await m.updateDoc("QuickLink", {_id: id}, {
                    name: req.body.name,
                    from: req.body.from,
                    to: req.body.to,
                    restricted: req.body.restricted
                });
            }else if(req.body.action == "create"){
                await m.createDoc("QuickLink", {
                    name: req.body.name,
                    from: req.body.from,
                    to: req.body.to,
                    restricted: req.body.restricted,
                    group: user.group
                });
            }else if(req.body.action == "delete"){
                await m.deleteDoc("QuickLink", {_id: id});
            }
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});
app.get("/group/items", function(req, res){
    isAuthenticated(req, "cookie", function(status, user){
        var group = "";
        if(status){
            group = user.group;
        }
        if((req.headers["group"] != undefined && req.headers["group"] != "") || group != ""){
            group = req.headers["group"];
            m.getDocs('ModuleItem', {group: group}).then(function(docs){
                res.send(JSON.stringify({successful:true, items: docs, fromGroupId: group}));
            });
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});
app.post("/group/item", async function(req, res){
    isAuthenticated(req, "cookie", async function(status,user){
        // must have edit main page access
        if(status){
            var id = req.body._id;
            if(req.body.action == "edit"){
                await m.updateDoc('ModuleItem', {_id: id}, {
                    title: req.body.title,
                    contents: req.body.contents,
                    icon: req.body.icon,
                    result: req.body.result,
                    show: req.body.show
                });
            }else if(req.body.action == "create"){
                await m.createDoc('ModuleItem', {
                    title: req.body.title,
                    contents: req.body.contents,
                    icon: req.body.icon,
                    result: req.body.result,
                    show: req.body.show,
                    group: user.group
                })
            }else if(req.body.action == "delete"){
                console.log("deleting");
                await m.deleteDoc('ModuleItem', {_id: id});
            }
            

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
        


    })
});


function getTodaysEvent(docs){
    var today = new Date();
    var closestToNow = null;
    docs.forEach(d => {
        if(today.getDate() == d.datetime.getDate() && today.getMonth() == d.datetime.getMonth() && today.getFullYear() == d.datetime.getFullYear()){
            // this is TODAY
            if(closestToNow == null){
                closestToNow = d;
            }else{
                if(d.datetime.getTime() < closestToNow.datetime.getTime()){
                    closestToNow = d;
                }
            }
        }
    });
    return closestToNow;
}

app.get("/group/today", async function(req, res){
    isAuthenticated(req, "cookie", async function(status, user){
        if(status){
            user = await m.getDocs('Account', {_id: user.id});
            user = user[0];
        
            if(req.headers["group"] != user.group){
                var docs = await m.getDocs('AttendanceItem', {group: user.group});
                var closestToNow = getTodaysEvent(docs);

                
                
                res.send(JSON.stringify({successful:true, today: closestToNow == null ? undefined : {
                    id: closestToNow._id,
                    datetime: closestToNow.datetime,
                    title: closestToNow.title,
                    description: closestToNow.description,
                    group: closestToNow.group,
                    logged : (user.attendance == undefined || user.attendance.filter(a => a.event == closestToNow._id).length == 0) ? false : true

                }}));
            }else{
                res.status(401).send(JSON.stringify({successful: false}));
            }
            
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
})
app.post("/group/today", async function(req, res){
    isAuthenticated(req, "cookie", async function(status, user){
        if(status){

            user = await m.getDocs('Account', {_id: user.id});
            user = user[0];
            //console.log(user);
            

            var docs = await m.getDocs('AttendanceItem', {group: user.group});
            var closestToNow = getTodaysEvent(docs);
            

            if(user.attendance == undefined || user.attendance.filter(a => a.event == closestToNow._id).length == 0){
                // add attendance record
                var toUpdate = {
                    attendance : user.attendance == undefined ? [] : user.attendance
                };
                toUpdate.attendance.push({
                    event: closestToNow._id,
                    status: "ATTEND",
                    overriddenstatus: "",
                    datetime: new Date()
                });
                
                console.log(toUpdate);
                await m.updateDoc('Account', {_id: user._id}, toUpdate);
            }
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/manage", function(req, res){
    isAuthenticated(req, "cookie", function(status, user){
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

app.use(async function(req, res, next) {
    // this is the 404 route
    if(req.originalUrl.includes("/ql/")){
        var quickLinks = await m.getDocs('QuickLink', {});
        var sent = false;
        
        quickLinks.forEach(e => {
            console.log(e.from);
            console.log(req.originalUrl)
            if(req.originalUrl == "/ql/" + e.from){
                console.log("QUICK LINK");
                

                isAuthenticated(req, "cookie", async function(status, user){
                    console.log(user)
                    if(status){
                        if(e.visitors == undefined){
                            e.visitors = [user.id];
                        }else if(!e.visitors.includes(user.id)){
                            e.visitors.push(user.id);
                        }
                        res.redirect(e.to);
                        sent = true;
                        
                        await m.updateDoc('QuickLink', {_id: e._id}, {visitors: e.visitors});
                    }else{
                        console.log("Not authenticated")
                        if(e.restricted == false){
                            res.setHeader("to", e.to);
                            res.setHeader("group", e.group);
                            res.sendFile(__dirname + "/views/tolink.html");
                            
                            sent = true;
                        }
                    }
                    console.log(e.visitors);
                });
                
                
            }
        });
    }
    // if(!sent && req.originalUrl.includes("/group/")){
    //     var group = req.originalUrl.split("/")[2];
    //     var groupItem = await m.getDocs('Group', {uniqueId: group});
    //     if(groupItem.length > 0){
    //         groupItem = groupItem[0];
    //         sent = true;
    //     }

        
    // }
    if(!sent){
        res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
    }
    
});

// start the server in the port 3000 !
app.listen(8080, function () {
    console.log('Example app listening on port 3000.');
});