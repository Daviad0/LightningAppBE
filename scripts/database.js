const mongoose = require('mongoose');


const models = {
    'Account' : mongoose.model('Account',new mongoose.Schema({
        email: String,
        group: String,
        pwhash: String,
        pwsalt: String,
        pwiterations: Number,
        username: String,
        fullname: String,
        notes: String,
        uuid: String,
        access: {
            role: String,
            permissions: [String],
            groups: [String],
            restricted: Boolean,
            elevated: Boolean
        },
        connections:[String],
        attendance:[{
            event: String,
            status: String,
            overriddenstatus: String,
            datetime: Date
        }],
        protonLog: [{
            datetime: Date,
            message: String,
            givenBy: String,
            protons: Number
        }],
        externalIds: [],
        resetCodes: [{
            code: String,
            datetime: Date
        }]
    })),
    'Group' : mongoose.model('Group', new mongoose.Schema({
        name: String,
        uniqueId: String,
        locked: Boolean,
        affiliations: [String],
        subgroups:[{
            name: String,
            tag: String,
            joinable: Boolean,
            features: [String],
            managers: [String],
            messages: [{
                sender: String,
                message: String,
                datetime: Date
            }]
        }],
        roles: [{
            name: String,
            color: String,
            permissions: [String]
        }],
        protonAssignments: [{
            assigner: String,
            protons: Number
        }],
        announcements: [{
            sender: String,
            message: String,
            datetime: Date
        }]
    })),
    'ModuleItem' : mongoose.model('ModuleItem', new mongoose.Schema({
        group: String,
        title: String,
        contents: String,
        icon: String,
        image: String,
        result: {
            to: String,
            data: String
        },
        details: {
            start: Date,
            end: Date
        },
        show: Boolean,
        subgroups: [],
        color: String,
        priority: Number
    })),
    'AttendanceItem' : mongoose.model('AttendanceItem', new mongoose.Schema({
        group: String,
        title: String,
        description: String,
        datetime: Date,
        length: Number,
        code: String,
        subgroups: [String],
        requests: [{
            requester: String,
            final: String,
            datetime: Date
        }]
    })),
    'QuickLink' : mongoose.model('QuickLink', new mongoose.Schema({
        group: String,
        name: String,
        to: String,
        from: String,
        restricted: Boolean,
        visitors: [String]
    })),
    'Presentation': mongoose.model('Presentation', new mongoose.Schema({
        group: String,
        by: String,
        title: String,
        public: Boolean,
        slides: [{
            HTML: String,
            background: String
        }]
    }))
}

async function init(pw){
    await mongoose.connect('mongodb+srv://daviado:' + pw + '@lightningapp.remhn.mongodb.net/lightningapp', { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to mongodb');

    
    var groups = await getDocs('Group', {uniqueId: 'lightning-robotics'});
    if(groups.length == 0){
        await createDoc('Group', {name: 'Testing Environment', uniqueId: 'lightning-robotics', locked: false, affiliations: []});
    }

    var items = await getDocs('ModuleItem', {group: 'lightning-robotics'});
    if(items.length == 0){
        await createDoc('ModuleItem', {group: 'lightning-robotics', title: 'Test Item', contents: 'Here are some contents...', icon: 'favorite', image: '', result: {to: 'link', data: 'https://bit.ly/LRLanding'}, show: true});
    }

    var items = await getDocs('AttendanceItem', {group: 'lightning-robotics'});
    if(items.length == 0){
        await createDoc('AttendanceItem', {group: 'lightning-robotics', title: 'Very Important Meeting', description: 'Must Attend or Die', datetime: new Date(), length: 2, code: '12345'});
    }

    var items = await getDocs('QuickLink', {group: 'lightning-robotics'});
    if(items.length == 0){
        await createDoc('QuickLink', {group: 'lightning-robotics', name: 'Test Link',from: "landing", to: 'https://bit.ly/LRLanding', restricted: false});
    }

    

    

}

async function createDoc(type, data){
    var doc = new models[type](data);
    await doc.save();
    return doc;
}

async function getDocs(type, query){
    return await models[type].find(query);
}

async function updateDoc(type, query, data){
    await models[type].updateOne(query, {$set: data});
    return await getDocs(type, query);
}

async function deleteDoc(type, query){
    await models[type].deleteOne(query);
    return true;
}

module.exports = {
    init,createDoc,getDocs,updateDoc,deleteDoc
}