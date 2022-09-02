// Require express and create an instance of it
require("dotenv").config();
var express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const OneSignal = require('@onesignal/node-onesignal');
const nodemailer = require('nodemailer');
var mongoose = require('mongoose');
var m = require('./scripts/database.js');
const emoji = require('node-emoji');
var app = express();
var cookies = require("cookie-parser");
const ONESIGNAL_APP_ID = '8ec8f18d-38ef-449b-8e10-69025823a4a5';

const Notif_OS = {
    getToken() {
        return process.env.ONESIGNAL_TOKEN;
    }
};


const configuration = OneSignal.createConfiguration({
    authMethods: {
        app_key: {
        	tokenProvider: Notif_OS
        }
    }
});
const client = new OneSignal.DefaultApi(configuration);

const { moveMessagePortToContext } = require('worker_threads');

app.set('trust proxy', true);
app.use(cookies());
m.init(process.env.DB_PASSWORD);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


// var mailSender = nodemailer.createTransport("SMTP",{
//   service: 'Gmail',
//   auth: {
//     user: 'sparkclub862@gmail.com',
//     clientId: '',
//     clientSecret: '',
//     refreshToken: ''
//   }
// });


const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: 'sparkclub862@gmail.com',
      pass: process.env.SMTP_PASSWORD,
    },
  });
  

async function notifyUsers(users, title, subtitle, message){
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.include_external_user_ids = users;
    notification.headings = { en: title };
    notification.subtitle = subtitle;
    notification.contents = { en: message };
    const {id} = await client.createNotification(notification);
}

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

function sendEmail(email, title, subtitle, message){
    transporter.sendMail({
        from: '"SparkClub #862" <sparkclub862@gmail.com>', // sender address
        to: email, // list of receivers
        subject: title, // Subject line
        
        html: `<h1><strong>${subtitle}</strong></h1><p>${message}</p>`, // html body
      }).then(info => {
        console.log({info});
      }).catch(console.error);
}

function sendNotifications(emails, title, message){
    // emails.forEach(e => {
    //     var mailOptions = {
    //         from: 'sparkclub862@gmail.com',
    //         to: e,
    //         subject: title,
    //         generateTextFromHTML: true,
    //         html: message
    //       };

    //       mailSender.sendMail(mailOptions, function(error, info){
    //         //console.log(error)
    //         });
    // });

}

function sendNotification(email, title, message){
    // var mailOptions = {
    //     from: 'sparkclub862@gmail.com',
    //     to: email,
    //     subject: title,
    //     html: message,
    //     generateTextFromHTML: true
    //   };

    //   mailSender.sendMail(mailOptions, function(error, info){
    //     //console.log(error)
    //     });

}

function isAuthenticated(req, method, permissionReq, callback) {
    if (req.headers.authorization || req.cookies.session) {
        
        var token = req.headers.authorization || req.cookies.session;
        jwt.verify(token, 'secret', async function (err, decoded) {
            if (err) {
                console.log(err)
                callback(false, undefined);
            } else {
                var randomReqNum = Math.random()*200;
                req.user = decoded;
                try{
                    if(permissionReq != undefined && permissionReq.length > 0){
                        var u = (await m.getDocs('Account', {_id: decoded.id}))[0];
                        var group = (await m.getDocs('Group', {uniqueId: u.group}))[0];
                        
                        var specificRolePerms = group.roles.filter(r => r.name == u.access.role).length > 0 ? group.roles.filter(r => r.name == u.access.role)[0].permissions : [];
                        decoded.permissions = specificRolePerms;
                        var access = false;
    
                        for(var pN = 0; pN < permissionReq.length; pN++){
                            var p = permissionReq[pN];
                            if(specificRolePerms.includes(p) || specificRolePerms.includes('*')){
                                
                                callback(true, decoded);
                                
                                access = true;
                                break;
                            }
                        }
                        
                        if(!access){
                            callback(false, decoded);
                        }
                    }else{
                        var u = (await m.getDocs('Account', {_id: decoded.id}))[0];
                        var group = (await m.getDocs('Group', {uniqueId: u.group}))[0];
                        console.log("SUCCESS")
                        var specificRolePerms = group.roles.filter(r => r.name == u.access.role).length > 0 ? group.roles.filter(r => r.name == u.access.role)[0].permissions : [];
                        decoded.permissions = specificRolePerms;
                        callback(true, decoded);
                    }
                }catch(e){
                    console.log(e)
                    callback(false, decoded);
                }
                

                


                
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
    //console.log("A");
    res.sendFile(__dirname + "/views/base.html");
    //console.log("B");
    
    //res.end();
});


app.get('/home*', function (req, res) {
    
    isAuthenticated(req, "cookie",[], function(status, user){
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


app.get('/signin', function (req, res) {
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            res.redirect("/home");
        }else{
            res.sendFile(__dirname + "/views/anonsignin.html");
        }
    });
    
    //res.end();
});

app.get('/present', function (req, res) {
    if(req.query.part != undefined){
        res.sendFile(__dirname + "/views/present.html");
    }else{
        res.sendFile(__dirname + "/views/base.html");
    }
    //res.end();
});
app.get('/createpresent', function (req, res) {
    if(req.query.part != undefined){
        res.sendFile(__dirname + "/views/createpresent.html");
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
    m.getDocs('Account', {username: req.body.username, group: req.body.group}).then(async function(docs){
        if(docs.length == 0){
            res.send(JSON.stringify({successful: false}));
        }else{
            crypto.pbkdf2(req.body.password, docs[0].pwsalt, docs[0].pwiterations, 64, 'sha512', async function(err, derivedKey){
                if(docs[0].pwhash == derivedKey.toString('hex')){
                    var token = jwt.sign({
                        username: req.body.username,
                        group: req.body.group,
                        id: docs[0]._id
                    }, 'secret', {
                        expiresIn: '7d'
                    });

                    sendEmail(docs[0].email, emoji.get("large_orange_diamond") + "#862 - Notice", "New Login Detected", "Hey " + docs[0].username + ", a new device just signed into your account. Please let us know if this was NOT you! Always remember not to share your password with anyone except for team leadership!");

                    notifyUsers([docs[0]._id],emoji.get("large_orange_diamond") + "#862 - Notice", "New Login Detected", "Hey " + docs[0].username + ", a new device just signed into your account. Please let us know if this was NOT you!");
                    res.send(JSON.stringify({successful: true, user: await createSafeUser(docs[0], 3), token: token}));
                }else{
                    res.send(JSON.stringify({successful: false}));
                }
            })
            
        }
    });
    
});

app.post("/acc/reset", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var acc = (await m.getDocs('Account', {_id: user.id}))[0];
            var old = req.body.oldPw;
            var newPw = req.body.newPw;
            crypto.pbkdf2(old, acc.pwsalt, acc.pwiterations, 64, 'sha512', async function(err, derivedKey){
                if(acc.pwhash == derivedKey.toString('hex')){

                    // can set the new password

                    hashPassword(newPw, async function(pwres){
                        await m.updateDoc('Account', {_id: acc._id}, {pwsalt: pwres.salt, pwiterations: pwres.iterations, pwhash: pwres.hash});
                        res.send(JSON.stringify({successful: true}));
                    })

                    
                }else{
                    res.send(JSON.stringify({successful: false}));
                }
            })
        }else{
            res.send(JSON.stringify({successful: false}));
        }
            
    });
    
})

app.post("/acc/forcereset", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            var acc = (await m.getDocs('Account', {_id: req.body.id}))[0];
            var newPw = req.body.newPw;
            hashPassword(newPw, async function(pwres){
                await m.updateDoc('Account', {_id: acc._id}, {pwsalt: pwres.salt, pwiterations: pwres.iterations, pwhash: pwres.hash});
                res.send(JSON.stringify({successful: true}));
            })
        }else{
            res.send(JSON.stringify({successful: false}));
        }
            
    });
    
})

app.post("/acc/delete", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            await m.deleteDoc('Account', {_id: req.body.id});
            res.send(JSON.stringify({successful: true}));
        }else{
            res.send(JSON.stringify({successful: false}));
        }
            
    });
    
})

async function createSafeUser(u, access){
    var group = (await m.getDocs('Group', {uniqueId: u.group}))[0];
    var role = group.roles.find(r => r.name == u.access.role);
    var safeUser = {
        username: u.username,
        group: u.group,
        id: u._id,
        attendance: u.attendance,
        access: u.access,
        fullname: u.fullname,
        protonLog: u.protonLog,
        notes: u.notes,
        email: u.email,
        externalId: u.externalIds == undefined ? undefined : u.externalIds[0],
        permissions: role == undefined ? [] : role.permissions


    }
    //console.log(safeUser.permissions);
    return safeUser;
}


app.get('/acc/verify', function(req, res){
    
    try{
        var token = req.cookies.session;
        var decoded = jwt.verify(token, 'secret');
        m.getDocs('Account', {_id: decoded.id}).then(async function(docs){
            if(docs.length == 0){
                res.send(JSON.stringify({successful: false}));
            }else{

                res.send(JSON.stringify({successful: true, user: await createSafeUser(docs[0], 1)}));
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

function isSecurePassword(password){
    return password.length >= 8 && password.match(/[a-z]/) && password.match(/[A-Z]/) && password.match(/[0-9]/) && password.match(/[^a-zA-Z0-9]/);
}

app.post('/acc/create', function (req, res){


    m.getDocs('Group', {uniqueId: req.body.group}).then(function(docs){
        if(docs.length == 0){
            res.send(JSON.stringify({successful: false, error: "group", message: "This is an invalid group to join!"}));
            return;
        }
        m.getDocs('Account', {username: req.body.username, group: req.body.group}).then(function(docs){
            if(docs.length == 0){
                

                if(!isSecurePassword(req.body.password)){
                    res.send(JSON.stringify({successful: false, error: "password", message: "Password must be >= 8 characters, have uppercase and lowercase letters, and have at least one number and one special character!"}));
                    return;
                }
                if(req.body.externalId.length != 8){
                    res.send(JSON.stringify({successful: false, error: "externalId", message: "External ID must be 8 characters long!"}));
                    return;
                }
                if(req.body.fullname.length < 1){
                    res.send(JSON.stringify({successful: false, error: "fullname", message: "Gotta have a name!"}));
                    return;
                }



                hashPassword(req.body.password, function(pwres){
                    m.createDoc('Account', {
                        username: req.body.username,
                        fullname: req.body.fullname,
                        notes: "Created on " + new Date().toLocaleString(),
                        email: req.body.email,
                        pwhash: pwres.hash,
                        pwsalt: pwres.salt,
                        pwiterations: pwres.iterations,
                        group: req.body.group,
                        access: {
                            role: "guest",
                            restricted: false,
                            elevated: false,
                            permissions: [],
                            groups: []
                        },
                        externalIds: [req.body.externalId],
                        connections: [],
                        attendance: [],
                        protonLog: []
    
                    }).then(async function(d){
                        var token = jwt.sign({
                            username: req.body.username,
                            group: req.body.group,
                            id: d._id
                            // NOTICE: CHANGE TO .ENV FILE
                        }, 'secret', {
                            expiresIn: '2d'
                        });
                        d.token = token;
                        res.send(JSON.stringify({successful: true, user: await createSafeUser(d, 3), token: token}));
                    });

                    

                    
                });
                
            }else{
                res.send(JSON.stringify({successful: false, error: "username", message: "Someone with this Username already exists..."}));
            }
        });
    });
    
    

    
});

app.get("/group/links", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var links = await m.getDocs("QuickLink", {group: user.group});
            res.send(JSON.stringify({successful: true, items: links}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/presentation", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            var pres = await m.getDocs("Presentation", {group: user.group});
            //console.log(pres);
            res.send(JSON.stringify({successful: true, presentation: pres[0]}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/users", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var users = await m.getDocs("Account", {group: user.group});
            var group = await m.getDocs("Group", {uniqueId: user.group});
            var safeUsers = [];
            //console.log(users);
            //console.log(user.group);
            for(var i = 0; i < users.length; i++){
                safeUsers.push(await createSafeUser(users[i], 2));
            }
            res.send(JSON.stringify({successful: true, items: safeUsers, roles: group[0].roles}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/roles", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var group = await m.getDocs("Group", {uniqueId: user.group});
            
            res.send(JSON.stringify({successful: true, items: group[0].roles}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/protons", async function(req, res){
    isAuthenticated(req, "cookie",["*", "COLLECT_PROTONS"], async function(status, user){
        if(status){
            var u = undefined;
            if(req.query.id != undefined){
                u = (await m.getDocs("Account", {_id: req.query.id}))[0];
                
            }else{
                u = (await m.getDocs("Account", {_id: user.id}))[0];
            }

            var total = 0;
            for(var i = 0; i < u.protonLog.length; i++){
                total += u.protonLog[i].protons;
            }
            
            res.send(JSON.stringify({successful: true, total: total, log: u.protonLog}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.post('/group/protons', async function(req, res){
    isAuthenticated(req, "cookie",["*", "AWARD_PROTONS", "AWARD_PROTONS_INFINITE"], async function(status, user){
        if(status){
            // the user awarding the protons NEEDS to have enough protons to award the user
            var requestingUser = await m.getDocs("Account", {_id: user.id})[0];
            var permissions = await m.getDocs("Group", {uniqueId: user.group}).roles.find(r => r.name == requestingUser.access.role).permissions;
            if(permissions.includes("AWARD_PROTONS_INFINITE")){
                // allow for any operation
            }
            else{
                // check for quota

                var protonRequests = await m.getDocs("Group", {uniqueId: user.group}).protonAssignments;
                var total = 0;
                protonRequests.forEach(p => {
                    if(p["assigner"] == user.id){
                        total += p.protons;
                    }

                })

                if(total + req.body.protons < 50){
                    // set protons of resulting user
                }else{
                    res.status(401).send(JSON.stringify({successful: false, message: "OUT OF PROTONS"}));
                }

            }
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.post("/group/role", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            var id = req.body._id;
            var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
            if(req.body.action == "edit"){
                var item = group.roles.find(r => r.name == req.body.oldName);
                var index = group.roles.indexOf(item);
                item.name = req.body.name;
                item.color = req.body.color;
                item.permissions = req.body.permissions;
                var oldName = req.body.oldName;
                group.roles[index] = item;

                // need to update all users with old role name
                var users = await m.getDocs("Account", {group: user.group});
                users.forEach(async function(u){
                    if(u.access.role == oldName){
                        u.access.role = req.body.name;
                        await m.updateDoc("Account", {_id: u._id}, {access: u.access});
                    }
                })
                await m.updateDoc("Group", {_id: group._id}, {roles: group.roles});


                
            }else if(req.body.action == "create"){

                var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
                group.roles.push({
                    name: req.body.name,
                    color: req.body.color,
                    permissions: req.body.permissions
                });
                await m.updateDoc("Group", {_id: group._id}, {roles: group.roles});
            }else if(req.body.action == "delete"){
                var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
                var item = group.roles.find(r => r.name == req.body.name);
                //console.log(group.roles);
                group.roles.splice(group.roles.indexOf(item), 1);
                //console.log(group.roles);

                await m.updateDoc("Group", {_id: group._id}, {roles: group.roles});
            }
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/this", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var group = await m.getDocs("Group", {uniqueId: user.group});
            
            res.send(JSON.stringify({successful: true, group: group[0]}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/subgroup", (req, res) => {
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var subgroupid = req.query.name != undefined ? req.query.name : req.query.tag.toUpperCase();
            var name = req.query.name != undefined;
            var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
            //console.log(subgroupid);

            var subgroup = undefined;
            if(name){
                subgroup = group.subgroups.find(s => s.name == subgroupid);
            }else{
                subgroup = group.subgroups.find(s => s.tag == subgroupid);
            }
            

            var admin = subgroup.managers.filter(m => m == user.id) > 0 || user.permissions.includes("*");

            res.send(JSON.stringify({successful: true, subgroup: subgroup, admin: admin}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
})

app.get("/group/subgroups", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var group = await m.getDocs("Group", {uniqueId: user.group});
            
            res.send(JSON.stringify({successful: true, items: group[0].subgroups}));

        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});


app.post("/group/subgroup", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
            if(req.body.action == "edit"){
                var item = group.subgroups.find(r => r.name == req.body.oldName);
                var index = group.subgroups.indexOf(item);
                item.name = req.body.name;
                // tag editing is DISABLED
                item.features = req.body.features;
                item.joinable = req.body.joinable;
                item.managers = req.body.managers;
                var oldName = req.body.oldName;
                group.subgroups[index] = item;

                // need to update all users with old role name
                var users = await m.getDocs("Account", {group: user.group});
                users.forEach(async function(u){
                    u.access.groups.forEach(async function(g) {
                        if(g == oldName){
                            u.access.groups[u.access.groups.indexOf(g)] = req.body.name;
                        }
                    })
                    await m.updateDoc("Account", {_id: u._id}, {access: u.access});
                })
                await m.updateDoc("Group", {_id: group._id}, {subgroups: group.subgroups});


                
            }else if(req.body.action == "create"){

                var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
                group.subgroups.push({
                    name: req.body.name,
                    tag: req.body.tag,
                    features: req.body.features,
                    joinable: req.body.joinable
                });
                await m.updateDoc("Group", {_id: group._id}, {subgroups: group.subgroups});
            }else if(req.body.action == "delete"){
                var group = (await m.getDocs("Group", {uniqueId: user.group}))[0];
                var item = group.subgroups.find(r => r.name == req.body.name);
                group.subgroups.splice(group.subgroups.indexOf(item), 1);

                await m.updateDoc("Group", {_id: group._id}, {subgroups: group.subgroups});
            }
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});


app.post("/group/link", async function(req, res){
    isAuthenticated(req, "cookie", ["ADMIN_QUICKLINKS", "ADMIN_QUICKLINKS_CREATE"] ,async function(status, user){
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
                    to: req.body.to,
                    from: req.body.from,
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
    isAuthenticated(req, "cookie",[], async function(status, user){
        var group = "";
        var subgroup = (req.headers["subgroup"] != undefined && req.headers["subgroup"] != "") ? req.headers["subgroup"] : "*";

        if(status){
            group = user.group;
        }
        if((req.headers["group"] != undefined && req.headers["group"] != "")){
            group = req.headers["group"];
            
            
        }
        var groupItem = (await m.getDocs("Group", {uniqueId: group.length == undefined ? group["uniqueId"] : group}))[0];
        //console.log(subgroup)
        
        if(group != ""){
            var docs = (await m.getDocs("ModuleItem", {group: group})).filter(d => (d.subgroups.includes(subgroup.toUpperCase()) || (d.subgroups.length == 0 && subgroup == "H") || subgroup == "*") && (d.show || subgroup == "*"));

            res.send(JSON.stringify({successful:true, items: docs, group: groupItem}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.post("/group/meeting", async function(req, res){
    isAuthenticated(req, "cookie",["*", "ADMIN_SCHEDULE"], async function(status,user){
        // must have edit main page access
        if(status){
            var id = req.body._id;
            if(req.body.action == "edit"){
                await m.updateDoc('AttendanceItem', {_id: id}, {
                    title: req.body.title,
                    datetime: req.body.datetime,
                    length: req.body.length,
                    description: req.body.description,
                    subgroups: req.body.subgroups,
                });
            }else if(req.body.action == "create"){
                //console.log(req.body.subgroups);
                await m.createDoc('AttendanceItem', {
                    title: req.body.title,
                    datetime: req.body.datetime,
                    length: req.body.length,
                    description: req.body.description,
                    group: user.group,
                    subgroups: req.body.subgroups
                })
            }else if(req.body.action == "delete"){
                await m.deleteDoc('AttendanceItem', {_id: id});
            }
            

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
        


    })
});

app.post("/group/present", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status,user){
        // must have edit main page access
        if(status){
            var id = req.body._id;
            if(req.body.action == "edit"){
                await m.updateDoc('Presentation', {_id: id}, {
                    title: req.body.title,
                    public: req.body.public,
                    slides: JSON.parse(req.body.slides)
                });
            }else if(req.body.action == "create"){
                await m.createDoc('Presentation', {
                    group: user.group,
                    by: user.id,
                    title: req.body.title,
                    public: true,
                    slides : JSON.parse(req.body.slides)
                })
            }else if(req.body.action == "delete"){
                await m.deleteDoc('Presentation', {_id: id});
            }
            

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
        


    })
});

app.post("/group/item", async function(req, res){
    isAuthenticated(req, "cookie",["ADMIN_LANDING", "ADMIN_LANDING_CREATE"], async function(status,user){
        // must have edit main page access
        if(status){
            //console.log(req.body);
            var id = req.body._id;
            var result = req.body.result;
            if(req.body.resultdata != undefined){
                result = {
                    "to": req.body.resultdata[0],
                    "data": req.body.resultdata[1]
                }
            }
            if(req.body.action == "edit"){
                await m.updateDoc('ModuleItem', {_id: id}, {
                    title: req.body.title,
                    contents: req.body.contents,
                    icon: req.body.icon,
                    result: result,
                    show: req.body.show
                });
            }else if(req.body.action == "create"){
                await m.createDoc('ModuleItem', {
                    title: req.body.title,
                    contents: req.body.contents,
                    icon: req.body.icon,
                    result: result,
                    show: req.body.show,
                    group: user.group,
                    subgroups: req.body.subgroups
                })
            }else if(req.body.action == "delete"){
                //console.log("deleting");
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
                if(Math.abs(d.datetime.getTime()-today.getTime()) < Math.abs(closestToNow.datetime.getTime() - today.getTime())){
                    closestToNow = d;
                }
            }
        }
    });

    // var minApart = null;
    // if(closestToNow != null){
    //     minApart = (closestToNow.datetime.getTime() - today.getTime()/1000)/60;
    //     if(minApart > 90){
    //         closestToNow = null;
    //     }
    // }

    return closestToNow;
}

app.get("/group/meetings", async function(req, res){
    isAuthenticated(req, "cookie",["VIEW_SCHEDULE"], async function(status, user){
        if(status){
            var group = user.group;
            var docs = await m.getDocs("AttendanceItem", {group: group});
            docs = docs.sort((a,b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
            res.send(JSON.stringify({successful: true, items: docs}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/today", async function(req, res){
    isAuthenticated(req, "cookie",["VIEW_SCHEDULE", "VIEW_SCHEDULE_SIGNIN"], async function(status, user){
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
                    length: closestToNow.length,
                    subgroups: closestToNow.subgroups,
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

app.get("/group/user", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            //console.log(req.query.id);
            var getUser = (await m.getDocs('Account', {_id: req.query.id}))[0];
            
            var ownUser = false;
            
            if(getUser.id == req.query.id){
                getUser = await createSafeUser(getUser, 2);
                ownUser = true;
            }else{
                getUser = await createSafeUser(getUser, 1);
            }
            var group = (await m.getDocs('Group', {uniqueId: getUser.group}))[0];




            res.send(JSON.stringify({successful: true, user: getUser, ownUser: ownUser, group: group}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});

app.get('/group/report/attendance', (req, res) => {
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var meetingRecords = await m.getDocs('AttendanceItem', {group: user.group});
            var userRecords = await m.getDocs('Account', {group: user.group});

            var users = [];
            for(var i = 0; i < userRecords.length; i++){
                users.push(await createSafeUser(userRecords[i], 1));
            }
           



            
           




            res.send(JSON.stringify({successful: true, meetings: meetingRecords, users: users}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});


app.post("/group/user", async function(req, res){
    isAuthenticated(req, "cookie",["*"], async function(status, user){
        if(status){
            var _id = req.body.id;
            
            var userCurrently = (await m.getDocs('Account', {_id: _id}))[0];
            if(req.body.action == "edit"){
                
                userCurrently.access.groups = req.body.subgroups;
                userCurrently.access.role = req.body.role;
                await m.updateDoc('Account', {_id: _id}, {
                    username: req.body.username,
                    email: req.body.email,
                    fullname: req.body.fullname,
                    access: userCurrently.access,
                    externalIds: [req.body.externalId],
                    notes: req.body.notes

                });
            }else if(req.body.action == "delete"){
                await m.deleteDoc('Account', {_id: _id});
            }
            
           




            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});

app.post("/group/attendance/verify", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var uid = req.body.uid;
            var meetingId = req.body.meetingId;
            var verified = req.body.verified;

            var thatUser = (await m.getDocs('Account', {_id: uid}))[0];
            
            var index = thatUser.attendance.indexOf(thatUser.attendance.find(a => a.event == meetingId));

            if(index != -1){
                thatUser.attendance[index].overriddenstatus = verified ? "ATTEND" : "ABSENT";
            }

            await m.updateDoc('Account', {_id: uid}, {attendance: thatUser.attendance});
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});

app.post('/group/attendance/request', async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var uid = req.body.uid;
            var meetingId = req.body.meetingId;
            var reqType = req.body.final;

            var meeting = (await m.getDocs('AttendanceItem', {_id: meetingId}))[0];
            
            var requests = meeting.requests;
            if(requests.filter(r => r.requester == uid).length == 0){
                requests.push({
                    requester: uid,
                    final: reqType,
                    datetime: new Date()
                })
                await m.updateDoc('AttendanceItem', {_id: meetingId}, {requests: requests});
            }
            
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }

    });
});

app.post("/group/attendance/override", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var uid = req.body.uid;
            var meetingId = req.body.meetingId;
            var override = req.body.override;

            var thatUser = (await m.getDocs('Account', {_id: uid}))[0];
            
            
            var index = thatUser.attendance.indexOf(thatUser.attendance.find(a => a.event == meetingId));

            if(index != -1){
                thatUser.attendance[index].overriddenstatus = override.toUpperCase();
            }else{
                thatUser.attendance.push({event: meetingId, overriddenstatus: override.toUpperCase(), status: "ABSENT", datetime: new Date()});
            }


            await m.updateDoc('Account', {_id: uid}, {attendance: thatUser.attendance});
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});

app.post("/group/subgroup/schedule", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var meetingId = req.body.meetingId;
            var group = req.body.group;
            var action = req.body.action;
            var thatMeeting = (await m.getDocs('AttendanceItem', {_id: meetingId}))[0];

            if(action == "add"){
                if(!thatMeeting.subgroups.includes(group)){
                    thatMeeting.subgroups.push(group);
                    await m.updateDoc('AttendanceItem', {_id: meetingId}, {subgroups: thatMeeting.subgroups});
                }
            }else if(action == "remove"){
                if(thatMeeting.subgroups.includes(group)){
                    thatMeeting.subgroups = thatMeeting.subgroups.filter(g => g != group);
                    await m.updateDoc('AttendanceItem', {_id: meetingId}, {subgroups: thatMeeting.subgroups});
                }
            }
            

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});


app.post("/group/signinreminder",async function(req, res){
    if(req.headers.key == process.env.CRON_KEY){

        var docs = await m.getDocs('AttendanceItem', {group: "lightning-robotics"});
        var closestToNow = getTodaysEvent(docs);
        if(closestToNow != null){
            var diff = ((closestToNow.datetime.getTime() - new Date().getTime())/1000)/60;
            if(diff < 20){
                var usersToCheck = await m.getDocs("Account", {group: "lightning-robotics"});
                var idsToSend = [];
                var emailsToSend = [];

                for(var i = 0; i < usersToCheck.length; i++){
                    var u = usersToCheck[i];
                    if(u.attendance.filter(x => x.event == closestToNow._id).length == 0){
                        idsToSend.push(u._id);
                        emailsToSend.push(u.email);
                    }
                }

                emailsToSend.forEach(e => {
                    sendEmail(e, emoji.get("lightning_cloud")+ " #862 - Reminder", "Sign In!", "At the meeting: " + closestToNow.title + "? Don't forget to sign in on the landing page!");
                })
                
                notifyUsers(idsToSend, emoji.get("lightning_cloud")+ " #862 - Reminder", "Sign In!", "At the meeting: " + closestToNow.title + "? Don't forget to sign in on the landing page!");

            }
        }
        res.send(JSON.stringify({successful: true}));

    }else{
        res.status(401).send(JSON.stringify({successful: false}));
    }
});


app.get('/group/announcements', async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){

            var group = (await m.getDocs('Group', {uniqueId: user.group}))[0];
            var messages = group.announcements;

            if(messages == undefined){
                messages = [];
            }

            res.send(JSON.stringify({successful: true, messages: messages}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});
app.post('/group/announcement', async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var message = req.body.message;

            var group = (await m.getDocs('Group', {uniqueId: user.group}))[0];
            var u = (await m.getDocs('Account', {_id: user.id}))[0];
            var messages = group.announcements;
            if(messages == undefined){
                messages = [];
            }

            messages.push({
                message: message,
                sender: user.id,
                datetime: new Date()
            });

            var usersToSend = (await m.getDocs('Account', {group: user.group}));
            var idsToSend = usersToSend.map(u => u._id);
            var emailsToSend = usersToSend.map(u => u.email);

            emailsToSend.forEach(e => {
                sendEmail(e, emoji.get("red_circle")+ " #862 - Announcement", "Team Wide Announcement", message + " (" + u.username + ")");
            })
            notifyUsers(idsToSend, emoji.get("red_circle")+ " #862 - Announcement", "Team Wide Announcement", message + " (" + u.username + ")");



            // var users = await m.getDocs('Account', {group: user.group});
            // users.forEach(async function(u){
            //     if(u.access.groups.includes(subgroup)){
            //         sendNotification(u.email, "SparkClub Announcement", "You have a new message from " + user.name + " in " + subgroup + ": " + message);
            //     }
            // });

            group.announcements = messages;

            await m.updateDoc('Group', {uniqueId: user.group}, {announcements: group.announcements});

            res.send(JSON.stringify({successful: true, messages: messages}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
})

app.get('/group/subgroup/messages', async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var subgroup = req.headers.group;

            var group = (await m.getDocs('Group', {uniqueId: user.group}))[0];
            var messages = group.subgroups.find(g => g.name == subgroup).messages;

            if(messages == undefined){
                messages = [];
            }

            res.send(JSON.stringify({successful: true, messages: messages}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});
app.post('/group/subgroup/message', async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var subgroup = req.body.group;
            var message = req.body.message;

            var group = (await m.getDocs('Group', {uniqueId: user.group}))[0];
            var u = (await m.getDocs('Account', {_id: user.id}))[0];
            var messages = group.subgroups.find(g => g.name == subgroup).messages;

            messages.push({
                message: message,
                sender: user.id,
                datetime: new Date()
            });

            var usersToSend = (await m.getDocs('Account', {group: user.group})).filter(u => u.access.groups.includes(subgroup));
            var idsToSend = usersToSend.map(u => u._id);
            var emailsToSend = usersToSend.map(u => u.email);

            emailsToSend.forEach(e => {
                sendEmail(e, emoji.get("red_circle")+ " #862 - Announcement", subgroup + "Announcement", message + " (" + u.username + ")");
            })
            notifyUsers(idsToSend, emoji.get("red_circle")+ " #862 - Announcement", subgroup + "Announcement", message + " (" + u.username + ")");

            group.subgroups.find(g => g.name == subgroup).messages = messages;

            await m.updateDoc('Group', {uniqueId: user.group}, {subgroups: group.subgroups});

            res.send(JSON.stringify({successful: true, messages: messages}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
})

app.post("/group/subgroup/add", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var uid = req.body.uid;
            var group = req.body.group;
            var thatUser = (await m.getDocs('Account', {_id: uid}))[0];

            if(!thatUser.access.groups.includes(group)){
                thatUser.access.groups.push(group);
                await m.updateDoc('Account', {_id: uid}, {access: thatUser.access});
            }

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});

app.post("/group/subgroup/remove", async function(req, res){
    isAuthenticated(req, "cookie",[], async function(status, user){
        if(status){
            var uid = req.body.uid;
            var group = req.body.group;
            var thatUser = (await m.getDocs('Account', {_id: uid}))[0];

            if(thatUser.access.groups.includes(group)){
                thatUser.access.groups = thatUser.access.groups.filter(g => g != group);
                await m.updateDoc('Account', {_id: uid}, {access: thatUser.access});
            }

            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    
    });
});
app.post("/group/today/anon", async function(req, res){
    var externalId = req.body.externalId;
    var group = req.body.group;

    var docs = await m.getDocs('AttendanceItem', {group: group});
    var closestToNow = getTodaysEvent(docs);

    var user = (await m.getDocs('Account', {group: group})).find(u => u.externalIds.includes(externalId));


    if(closestToNow != undefined && (user.attendance == undefined || user.attendance.filter(a => a.event == closestToNow._id).length == 0)){
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
        
        //console.log(toUpdate);
        await m.updateDoc('Account', {_id: user._id}, toUpdate);
    }
    res.send(JSON.stringify({successful: true}));

});
app.post("/group/today", async function(req, res){
    isAuthenticated(req, "cookie",["VIEW_SCHEDULE_SIGNIN"], async function(status, user){
        if(status){

            user = await m.getDocs('Account', {_id: user.id});
            user = user[0];
            ////console.log(user);
            

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
                
                //console.log(toUpdate);
                await m.updateDoc('Account', {_id: user._id}, toUpdate);
            }
            res.send(JSON.stringify({successful: true}));
        }else{
            res.status(401).send(JSON.stringify({successful: false}));
        }
    });
});

app.get("/group/accounts", function(req, res){
    isAuthenticated(req, "cookie",["*", "ADMIN_REPRESENTATIVE"], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/accounts.html");
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
    });
});
app.get("/group/manage", function(req, res){
    isAuthenticated(req, "cookie",["*", "ADMIN_LANDING", "ADMIN_QUICKLINKS"], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/manage.html");
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
    });
});

app.get("/group/report", function(req, res){
    isAuthenticated(req, "cookie",["*"], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/report.html");
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
    });
});

app.get("/group/sg*", function(req, res){
    isAuthenticated(req, "cookie",["*"], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/subgroup.html");
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
    });
});

app.get("/acc/user*", function(req, res){
    isAuthenticated(req, "cookie",[], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/user.html");
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
    });
});

app.get("/group/cable", function(req, res){
    isAuthenticated(req, "cookie",[], function(status, user){
        if(status){
            if(req.headers["partial"] == "YES"){
                res.sendFile(__dirname + "/views/cable.html");
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
    });
});

app.use(async function(req, res, next) {
    // this is the 404 route
    if(req.originalUrl.includes("/ql/")){
        var quickLinks = await m.getDocs('QuickLink', {});
        var sent = false;
        
        quickLinks.forEach(e => {
            //console.log(e.from);
            //console.log(req.originalUrl)
            if(req.originalUrl == "/ql/" + e.from && !sent){
                //console.log("QUICK LINK");
                sent = true;

                isAuthenticated(req, "cookie",[], async function(status, user){
                    //console.log(user)
                    if(status){
                        if(e.visitors == undefined){
                            e.visitors = [user.id];
                        }else if(!e.visitors.includes(user.id)){
                            e.visitors.push(user.id);
                        }


                        if(e.to.includes("http:") || e.to.includes("https:") || e.to.includes("www.") || e.to.includes("//") || e.to.includes(".")){
                            
                            if(e.to.includes("https://")){
                                e.to = e.to.replace("https://", "");
                            }else if(e.to.includes("http://")){
                                e.to = e.to.replace("http://", "");
                            }
                        
                            res.redirect("//"+e.to);
                        }else{
                            var newPath = req.originalUrl.split('ql')[0]
                            res.redirect(newPath + e.to);
                        }

                        
                        
                        
                        
                        await m.updateDoc('QuickLink', {_id: e._id}, {visitors: e.visitors});
                    }else{
                        //console.log("Not authenticated")
                        if(e.restricted == false){
                            res.setHeader("to", e.to);
                            res.setHeader("group", e.group);
                            res.cookie("to", e.to);
                            res.cookie("group", e.group);
                            res.sendFile(__dirname + "/views/tolink.html");
                            
                        }
                    }
                    //console.log(e.visitors);
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
app.listen(process.env.PORT, function () {
    //console.log('Example app listening on port port.');
});